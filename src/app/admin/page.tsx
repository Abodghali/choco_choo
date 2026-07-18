'use client';

import React, { useState, useEffect } from 'react';
import { MenuItem, MenuCategory, StoreSettings, OpeningHours, Order } from '@/lib/db';
import { formatPrice } from '@/lib/utils';

export default function AdminPage() {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  
  // Login form state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // Tab navigation
  const [activeTab, setActiveTab] = useState<'orders' | 'products' | 'categories' | 'settings'>('orders');

  // Orders State
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersFilter, setOrdersFilter] = useState<'all' | 'pending' | 'preparing' | 'completed' | 'cancelled'>('all');
  const [soundEnabled, setSoundEnabled] = useState(true);

  // DB Data
  const [menu, setMenu] = useState<MenuCategory[]>([]);
  const [settings, setSettings] = useState<StoreSettings | null>(null);

  // UI States
  const [toastMessage, setToastMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  // Modals
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<(MenuItem & { categoryName: string }) | null>(null);
  
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<{ originalName: string; newName: string } | null>(null);

  // Form states for Product Modal
  const [prodCategory, setProdCategory] = useState('');
  const [prodName, setProdName] = useState('');
  const [prodEngName, setProdEngName] = useState('');
  const [prodDesc, setProdDesc] = useState('');
  const [prodEngDesc, setProdEngDesc] = useState('');
  const [prodPrice, setProdPrice] = useState(0);
  const [prodImage, setProdImage] = useState('');
  const [prodAvailable, setProdAvailable] = useState(true);

  // Form states for Category Modal
  const [catNameInput, setCatNameInput] = useState('');

  // Check auth on load
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth');
      if (res.status === 200) {
        setAuthenticated(true);
        fetchData();
        fetchOrders();
      } else {
        setAuthenticated(false);
        setLoading(false);
      }
    } catch (e) {
      setAuthenticated(false);
      setLoading(false);
    }
  };

  const playNotificationSound = () => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      const playNote = (frequency: number, startTime: number, duration: number) => {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.connect(gain);
        gain.connect(audioContext.destination);
        
        osc.frequency.setValueAtTime(frequency, startTime);
        gain.gain.setValueAtTime(0.1, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration - 0.05);
        
        osc.start(startTime);
        osc.stop(startTime + duration);
      };
      
      const now = audioContext.currentTime;
      playNote(523.25, now, 0.15); // C5
      playNote(783.99, now + 0.15, 0.3); // G5
    } catch (err) {
      console.warn("Failed to play order sound notification:", err);
    }
  };

  const fetchOrders = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch('/api/orders');
      if (res.ok) {
        const data = await res.json();
        
        // Play notification sound if a new order arrives and sound is enabled
        setOrders(prevOrders => {
          if (soundEnabled && prevOrders.length > 0 && data.length > prevOrders.length) {
            // Check if there are any new pending orders that weren't there before
            const newOrders = data.filter((o: any) => o.status === 'pending' && !prevOrders.some(po => po.id === o.id));
            if (newOrders.length > 0) {
              playNotificationSound();
            }
          }
          return data;
        });
      }
    } catch (e) {
      console.error("Failed to fetch orders:", e);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // Polling for orders every 10 seconds
  useEffect(() => {
    if (!authenticated) return;
    
    const interval = setInterval(() => {
      fetchOrders(true);
    }, 10000);
    
    return () => clearInterval(interval);
  }, [authenticated, soundEnabled]);

  const updateOrderStatus = async (orderId: string, status: string) => {
    try {
      const res = await fetch('/api/orders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, status })
      });
      if (res.ok) {
        showToast('Stav objednávky aktualizován');
        fetchOrders(true);
      } else {
        showToast('Chyba při aktualizaci stavu');
      }
    } catch (e) {
      showToast('Chyba komunikace při aktualizaci stavu');
    }
  };

  const deleteOrder = async (orderId: string) => {
    if (!confirm('Opravdu chcete smazat tuto objednávku?')) return;
    try {
      const res = await fetch(`/api/orders?id=${orderId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        showToast('Objednávka smazána');
        fetchOrders(true);
      } else {
        showToast('Chyba při mazání objednávky');
      }
    } catch (e) {
      showToast('Chyba komunikace při mazání objednávky');
    }
  };

  const clearAllOrders = async () => {
    if (!confirm('Opravdu chcete smazat VŠECHNY objednávky z historie? Tento krok nelze vrátit.')) return;
    try {
      const res = await fetch('/api/orders', {
        method: 'DELETE'
      });
      if (res.ok) {
        showToast('Všechny objednávky byly smazány');
        fetchOrders(true);
      } else {
        showToast('Chyba při mazání historie objednávek');
      }
    } catch (e) {
      showToast('Chyba komunikace');
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const menuRes = await fetch('/api/menu');
      const settingsRes = await fetch('/api/settings');
      
      if (menuRes.ok && settingsRes.ok) {
        const menuData = await menuRes.json();
        const settingsData = await settingsRes.json();
        setMenu(menuData);
        setSettings(settingsData);
      }
    } catch (e) {
      showToast('Chyba při načítání dat ze serveru');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (data.success) {
        setAuthenticated(true);
        fetchData();
      } else {
        setLoginError(data.message || 'Nesprávné přihlašovací údaje');
      }
    } catch (e) {
      setLoginError('Chyba při pokusu o přihlášení');
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth', { method: 'DELETE' });
      setAuthenticated(false);
      setUsername('');
      setPassword('');
    } catch (e) {
      showToast('Chyba při odhlašování');
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage('');
    }, 3000);
  };

  // -------------------------------------------------------------
  // Product Operations
  // -------------------------------------------------------------
  
  const openAddProductModal = () => {
    setEditingProduct(null);
    setProdCategory(menu[0]?.category || '');
    setProdName('');
    setProdEngName('');
    setProdDesc('');
    setProdEngDesc('');
    setProdPrice(100);
    setProdImage('');
    setProdAvailable(true);
    setProductModalOpen(true);
  };

  const openEditProductModal = (item: MenuItem, categoryName: string) => {
    setEditingProduct({ ...item, categoryName });
    setProdCategory(categoryName);
    setProdName(item.name);
    setProdEngName(item.englishName || '');
    setProdDesc(item.description || '');
    setProdEngDesc(item.englishDescription || '');
    setProdPrice(item.price);
    setProdImage(item.image || '');
    setProdAvailable(item.available);
    setProductModalOpen(true);
  };

  const saveProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const formattedProduct: MenuItem = {
      id: editingProduct ? editingProduct.id : prodName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      name: prodName,
      englishName: prodEngName || prodName,
      description: prodDesc,
      englishDescription: prodEngDesc || prodDesc,
      price: Number(prodPrice),
      image: prodImage,
      available: prodAvailable
    };

    let updatedMenu = [...menu];

    if (editingProduct) {
      // Edit mode
      // Remove from original category first
      updatedMenu = updatedMenu.map(cat => {
        if (cat.category === editingProduct.categoryName) {
          return {
            ...cat,
            items: cat.items.filter(i => i.id !== editingProduct.id)
          };
        }
        return cat;
      });

      // Insert into target category
      updatedMenu = updatedMenu.map(cat => {
        if (cat.category === prodCategory) {
          return {
            ...cat,
            items: [...cat.items, formattedProduct]
          };
        }
        return cat;
      });
    } else {
      // Add mode
      updatedMenu = updatedMenu.map(cat => {
        if (cat.category === prodCategory) {
          return {
            ...cat,
            items: [...cat.items, formattedProduct]
          };
        }
        return cat;
      });
    }

    const success = await saveMenuToServer(updatedMenu);
    if (success) {
      setProductModalOpen(false);
      showToast(editingProduct ? 'Produkt byl upraven' : 'Produkt byl vytvořen');
    }
  };

  const deleteProduct = async (itemId: string, categoryName: string) => {
    if (!confirm('Opravdu chcete smazat tento produkt?')) return;

    const updatedMenu = menu.map(cat => {
      if (cat.category === categoryName) {
        return {
          ...cat,
          items: cat.items.filter(i => i.id !== itemId)
        };
      }
      return cat;
    });

    const success = await saveMenuToServer(updatedMenu);
    if (success) {
      showToast('Produkt byl smazán');
    }
  };

  const toggleProductAvailability = async (itemId: string, categoryName: string, currentStatus: boolean) => {
    const updatedMenu = menu.map(cat => {
      if (cat.category === categoryName) {
        return {
          ...cat,
          items: cat.items.map(i => i.id === itemId ? { ...i, available: !currentStatus } : i)
        };
      }
      return cat;
    });

    const success = await saveMenuToServer(updatedMenu);
    if (success) {
      showToast(currentStatus ? 'Produkt byl skryt' : 'Produkt je nyní viditelný');
    }
  };

  const moveProductOrder = async (categoryName: string, index: number, direction: 'up' | 'down') => {
    const updatedMenu = [...menu];
    const catIndex = updatedMenu.findIndex(c => c.category === categoryName);
    if (catIndex === -1) return;

    const items = [...updatedMenu[catIndex].items];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    
    if (targetIndex < 0 || targetIndex >= items.length) return;

    // Swap items
    const temp = items[index];
    items[index] = items[targetIndex];
    items[targetIndex] = temp;

    updatedMenu[catIndex] = {
      ...updatedMenu[catIndex],
      items
    };

    const success = await saveMenuToServer(updatedMenu);
    if (success) {
      showToast('Pořadí produktů uloženo');
    }
  };

  const saveMenuToServer = async (newMenu: MenuCategory[]): Promise<boolean> => {
    try {
      const res = await fetch('/api/menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newMenu)
      });
      if (res.ok) {
        setMenu(newMenu);
        return true;
      }
      showToast('Chyba při ukládání menu');
      return false;
    } catch (e) {
      showToast('Chyba komunikace při ukládání menu');
      return false;
    }
  };

  // -------------------------------------------------------------
  // Category Operations
  // -------------------------------------------------------------

  const openAddCategoryModal = () => {
    setEditingCategory(null);
    setCatNameInput('');
    setCategoryModalOpen(true);
  };

  const openEditCategoryModal = (categoryName: string) => {
    setEditingCategory({ originalName: categoryName, newName: categoryName });
    setCatNameInput(categoryName);
    setCategoryModalOpen(true);
  };

  const saveCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!catNameInput.trim()) return;

    let updatedMenu = [...menu];

    if (editingCategory) {
      // Edit / Rename Category
      updatedMenu = updatedMenu.map(cat => {
        if (cat.category === editingCategory.originalName) {
          return {
            ...cat,
            category: catNameInput.trim()
          };
        }
        return cat;
      });
    } else {
      // Add Category
      const exists = menu.some(c => c.category.toLowerCase() === catNameInput.trim().toLowerCase());
      if (exists) {
        alert('Tato kategorie již existuje');
        return;
      }
      updatedMenu.push({
        category: catNameInput.trim(),
        items: []
      });
    }

    const success = await saveMenuToServer(updatedMenu);
    if (success) {
      setCategoryModalOpen(false);
      showToast(editingCategory ? 'Kategorie byla přejmenována' : 'Kategorie byla přidána');
    }
  };

  const deleteCategory = async (categoryName: string) => {
    const cat = menu.find(c => c.category === categoryName);
    if (cat && cat.items.length > 0) {
      if (!confirm(`Tato kategorie obsahuje ${cat.items.length} produktů. Smazáním kategorie smažete i tyto produkty. Opravdu chcete pokračovat?`)) {
        return;
      }
    } else {
      if (!confirm('Opravdu chcete smazat tuto kategorii?')) return;
    }

    const updatedMenu = menu.filter(c => c.category !== categoryName);
    const success = await saveMenuToServer(updatedMenu);
    if (success) {
      showToast('Kategorie byla smazána');
    }
  };

  const moveCategoryOrder = async (index: number, direction: 'up' | 'down') => {
    const updatedMenu = [...menu];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;

    if (targetIndex < 0 || targetIndex >= updatedMenu.length) return;

    // Swap
    const temp = updatedMenu[index];
    updatedMenu[index] = updatedMenu[targetIndex];
    updatedMenu[targetIndex] = temp;

    const success = await saveMenuToServer(updatedMenu);
    if (success) {
      showToast('Pořadí kategorií uloženo');
    }
  };

  // -------------------------------------------------------------
  // Settings Operations
  // -------------------------------------------------------------

  const handleSettingsFieldChange = (field: keyof StoreSettings | string, value: any) => {
    if (!settings) return;

    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      setSettings({
        ...settings,
        [parent]: {
          ...(settings[parent as keyof StoreSettings] as any),
          [child]: value
        }
      });
    } else {
      setSettings({
        ...settings,
        [field as keyof StoreSettings]: value
      });
    }
  };

  const handleHoursChange = (day: string, field: keyof OpeningHours, value: any) => {
    if (!settings) return;

    const updatedHours = {
      ...settings.openingHours,
      [day]: {
        ...settings.openingHours[day],
        [field]: value
      }
    };

    setSettings({
      ...settings,
      openingHours: updatedHours
    });
  };

  const saveSettingsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;

    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      
      if (res.ok) {
        showToast('Nastavení bylo uloženo');
      } else {
        showToast('Chyba při ukládání nastavení');
      }
    } catch (e) {
      showToast('Nastavení se nepodařilo uložit');
    }
  };

  // -------------------------------------------------------------
  // Data Filtering for Products Tab
  // -------------------------------------------------------------
  const allProductsList: (MenuItem & { categoryName: string; index: number })[] = [];
  menu.forEach(cat => {
    cat.items.forEach((item, idx) => {
      allProductsList.push({
        ...item,
        categoryName: cat.category,
        index: idx
      });
    });
  });

  const filteredProducts = allProductsList.filter(prod => {
    const matchesSearch = prod.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (prod.description && prod.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
                          prod.englishName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === '' || prod.categoryName === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  if (loading && !authenticated) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ fontSize: '18px', color: 'var(--color-gold)' }}>Načítání administrace...</p>
      </div>
    );
  }

  // -------------------------------------------------------------
  // LOGIN SCREEN
  // -------------------------------------------------------------
  if (!authenticated) {
    return (
      <div className="login-screen">
        <div className="login-card">
          <div style={{ textAlign: 'center' }}>
            <img src="/logo.jpg" alt="Choco Choo" className="login-logo" style={{ borderRadius: '50%' }} />
            <h1 className="login-title">Administrace Choco Choo</h1>
          </div>
          
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label className="form-label" htmlFor="username-input">Uživatelské jméno</label>
              <input 
                id="username-input"
                type="text" 
                className="form-input" 
                value={username} 
                onChange={(e) => setUsername(e.target.value)} 
                required 
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="password-input">Heslo</label>
              <input 
                id="password-input"
                type="password" 
                className="form-input" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                required 
              />
            </div>
            
            {loginError && (
              <p style={{ color: 'var(--color-accent)', fontSize: '13px', marginBottom: '15px', fontWeight: 600 }}>
                ⚠️ {loginError}
              </p>
            )}

            <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '12px' }}>
              Přihlásit se
            </button>
          </form>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // MAIN ADMIN DASHBOARD
  // -------------------------------------------------------------
  return (
    <div className="admin-layout">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="toast">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          {toastMessage}
        </div>
      )}

      {/* Admin Top Header */}
      <header className="admin-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <img src="/logo.jpg" alt="Choco Choo" style={{ height: '40px', width: 'auto', borderRadius: '50%' }} />
          <h1 style={{ fontSize: '18px', fontWeight: 800 }}>Choco Choo Panel</h1>
        </div>
        <div className="admin-user">
          <span>Uživatel: <strong>admin</strong></span>
          <button onClick={handleLogout} className="btn btn-secondary btn-sm">Odhlásit</button>
          <a href="/" target="_blank" className="btn btn-outline btn-sm">Zobrazit web</a>
        </div>
      </header>

      <div className="admin-container">
        {/* Sidebar Nav */}
        <aside className="admin-sidebar">
          <button 
            className={`admin-nav-btn ${activeTab === 'orders' ? 'active' : ''}`}
            onClick={() => setActiveTab('orders')}
            style={{ position: 'relative' }}
          >
            📦 <span>Objednávky</span>
            {orders.filter(o => o.status === 'pending').length > 0 && (
              <span style={{ 
                position: 'absolute', 
                top: '5px', 
                right: '10px', 
                backgroundColor: 'var(--color-accent)', 
                color: '#fff', 
                borderRadius: '50%', 
                padding: '2px 6px', 
                fontSize: '10px', 
                fontWeight: 'bold' 
              }}>
                {orders.filter(o => o.status === 'pending').length}
              </span>
            )}
          </button>
          <button 
            className={`admin-nav-btn ${activeTab === 'products' ? 'active' : ''}`}
            onClick={() => setActiveTab('products')}
          >
            🍔 <span>Produkty</span>
          </button>
          <button 
            className={`admin-nav-btn ${activeTab === 'categories' ? 'active' : ''}`}
            onClick={() => setActiveTab('categories')}
          >
            📁 <span>Kategorie</span>
          </button>
          <button 
            className={`admin-nav-btn ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            ⚙️ <span>Nastavení</span>
          </button>
        </aside>

        {/* Content Panel */}
        <main className="admin-content">
          
          {/* TAB 0: ORDERS MANAGER */}
          {activeTab === 'orders' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px', marginBottom: '25px' }}>
                <h2 style={{ fontSize: '20px', fontWeight: 700 }}>Správa objednávek</h2>
                
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <button 
                    onClick={() => setSoundEnabled(!soundEnabled)}
                    className="btn btn-secondary btn-sm"
                    style={{ display: 'flex', alignItems: 'center', gap: '5px' }}
                    title={soundEnabled ? "Vypnout zvukové upozornění" : "Zapnout zvukové upozornění"}
                  >
                    {soundEnabled ? "🔊 Zvuk zapnut" : "🔇 Zvuk vypnut"}
                  </button>
                  
                  <button 
                    className="btn btn-outline btn-sm" 
                    style={{ borderColor: 'var(--color-accent)', color: 'var(--color-accent)' }}
                    onClick={clearAllOrders}
                  >
                    🗑️ Smazat historii
                  </button>
                </div>
              </div>

              {/* Order Stats Overview */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '15px', marginBottom: '25px' }}>
                <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '15px', textAlign: 'center' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '5px' }}>Celkem</div>
                  <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)' }}>{orders.length}</div>
                </div>
                <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '15px', textAlign: 'center', borderLeft: '4px solid var(--color-accent)' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '5px' }}>Nové (Čekající)</div>
                  <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--color-accent)' }}>
                    {orders.filter(o => o.status === 'pending').length}
                  </div>
                </div>
                <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '15px', textAlign: 'center', borderLeft: '4px solid var(--color-gold)' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '5px' }}>V přípravě</div>
                  <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--color-gold)' }}>
                    {orders.filter(o => o.status === 'preparing').length}
                  </div>
                </div>
                <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '15px', textAlign: 'center', borderLeft: '4px solid #2ec4b6' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '5px' }}>Dokončené</div>
                  <div style={{ fontSize: '22px', fontWeight: 800, color: '#2ec4b6' }}>
                    {orders.filter(o => o.status === 'completed').length}
                  </div>
                </div>
              </div>

              {/* Status Filters Tab Row */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '25px', overflowX: 'auto', paddingBottom: '5px' }}>
                {(['all', 'pending', 'preparing', 'completed', 'cancelled'] as const).map((filter) => {
                  const labelMap = {
                    all: 'Všechny',
                    pending: 'Nové 🛎️',
                    preparing: 'V přípravě 🍳',
                    completed: 'Dokončené ✅',
                    cancelled: 'Zrušené ❌'
                  };
                  return (
                    <button
                      key={filter}
                      className={`category-tab ${ordersFilter === filter ? 'active' : ''}`}
                      style={{ padding: '6px 14px', fontSize: '13px', whiteSpace: 'nowrap' }}
                      onClick={() => setOrdersFilter(filter)}
                    >
                      {labelMap[filter]} ({filter === 'all' ? orders.length : orders.filter(o => o.status === filter).length})
                    </button>
                  );
                })}
              </div>

              {/* Orders Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
                {orders.filter(o => ordersFilter === 'all' || o.status === ordersFilter).length === 0 ? (
                  <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '50px 20px', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                    📭 Žádné objednávky v této sekci.
                  </div>
                ) : (
                  orders.filter(o => ordersFilter === 'all' || o.status === ordersFilter).map((order) => {
                    const statusBadgeColors = {
                      pending: { bg: 'rgba(231, 111, 81, 0.15)', text: 'var(--color-accent)', label: 'Nová' },
                      preparing: { bg: 'rgba(212, 163, 115, 0.15)', text: 'var(--color-gold)', label: 'V přípravě' },
                      completed: { bg: 'rgba(46, 196, 182, 0.15)', text: '#2ec4b6', label: 'Dokončeno' },
                      cancelled: { bg: 'rgba(255,255,255,0.05)', text: 'var(--text-muted)', label: 'Zrušeno' }
                    }[order.status] || { bg: 'rgba(255,255,255,0.05)', text: 'var(--text-muted)', label: order.status };

                    const formattedTime = new Date(order.createdAt).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
                    const formattedDate = new Date(order.createdAt).toLocaleDateString('cs-CZ');

                    return (
                      <div 
                        key={order.id} 
                        style={{ 
                          backgroundColor: 'var(--bg-secondary)', 
                          border: '1px solid var(--border-color)', 
                          borderRadius: 'var(--radius-md)', 
                          padding: '20px', 
                          display: 'flex', 
                          flexDirection: 'column', 
                          justifyContent: 'space-between',
                          boxShadow: 'var(--shadow-sm)',
                          borderTop: `4px solid ${statusBadgeColors.text}`
                        }}
                      >
                        <div>
                          {/* Card Header */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15px' }}>
                            <div>
                              <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--color-gold)', lineHeight: 1.1 }}>
                                #{order.customerNumber}
                              </div>
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                ID: {order.id}
                              </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <span style={{ 
                                display: 'inline-block', 
                                backgroundColor: statusBadgeColors.bg, 
                                color: statusBadgeColors.text, 
                                padding: '4px 10px', 
                                borderRadius: 'var(--radius-full)', 
                                fontSize: '11px', 
                                fontWeight: 700 
                              }}>
                                {statusBadgeColors.label}
                              </span>
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                {formattedTime} ({formattedDate})
                              </div>
                            </div>
                          </div>

                          {/* Table or Name Info */}
                          <div style={{ backgroundColor: 'var(--bg-tertiary)', padding: '10px 15px', borderRadius: 'var(--radius-sm)', marginBottom: '15px', fontSize: '13px', fontWeight: 600, borderLeft: '3px solid var(--color-gold)' }}>
                            📍 {order.tableOrName}
                          </div>

                          {/* Order Items */}
                          <div style={{ marginBottom: '20px' }}>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '4px' }}>
                              Objednané položky
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              {order.items.map((item, idx) => (
                                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                                  <span>
                                    <strong style={{ color: 'var(--color-gold)' }}>{item.quantity}x</strong> {item.name}
                                  </span>
                                  <span style={{ color: 'var(--text-secondary)' }}>
                                    {formatPrice(item.price * item.quantity)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div>
                          {/* Total and Payment */}
                          <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '12px', marginBottom: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              Platba: {order.paymentMethod === 'cash' ? (
                                <span>💵 Hotovost</span>
                              ) : order.paymentMethod === 'applepay' ? (
                                <span style={{ 
                                  color: order.paymentStatus === 'paid' ? '#2ec4b6' : order.paymentStatus === 'failed' ? '#e76f51' : '#f4a261',
                                  fontWeight: 600
                                }}>
                                  🍎 Apple Pay ({order.paymentStatus === 'paid' ? 'Zaplaceno ✅' : order.paymentStatus === 'failed' ? 'Chyba platby ❌' : 'Nezaplaceno ⏳'})
                                </span>
                              ) : (
                                <span style={{ 
                                  color: order.paymentStatus === 'paid' ? '#2ec4b6' : order.paymentStatus === 'failed' ? '#e76f51' : '#f4a261',
                                  fontWeight: 600
                                }}>
                                  💳 Karta ({order.paymentStatus === 'paid' ? 'Zaplaceno ✅' : order.paymentStatus === 'failed' ? 'Chyba platby ❌' : 'Nezaplaceno ⏳'})
                                </span>
                              )}
                            </span>
                            <span style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)' }}>
                              {formatPrice(order.totalPrice)}
                            </span>
                          </div>

                          {/* Actions */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              {order.status === 'pending' && (
                                <button 
                                  className="btn btn-primary" 
                                  style={{ flex: 1, padding: '8px 12px', fontSize: '13px' }}
                                  onClick={() => updateOrderStatus(order.id, 'preparing')}
                                >
                                  🍳 Vařit / Připravit
                                </button>
                              )}
                              {order.status === 'preparing' && (
                                <button 
                                  className="btn btn-primary" 
                                  style={{ flex: 1, padding: '8px 12px', fontSize: '13px', backgroundColor: '#2ec4b6', borderColor: '#2ec4b6' }}
                                  onClick={() => updateOrderStatus(order.id, 'completed')}
                                >
                                  ✅ Dokončit
                                </button>
                              )}
                              {order.status !== 'completed' && order.status !== 'cancelled' && (
                                <button 
                                  className="btn btn-outline btn-sm" 
                                  style={{ padding: '8px 12px', fontSize: '13px', borderColor: 'var(--color-accent)', color: 'var(--color-accent)' }}
                                  onClick={() => updateOrderStatus(order.id, 'cancelled')}
                                >
                                  Zrušit
                                </button>
                              )}
                            </div>
                            
                            <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                              <select 
                                className="form-select"
                                style={{ flex: 2, padding: '6px', fontSize: '11px', height: 'auto', minHeight: '30px' }}
                                value={order.status}
                                onChange={(e) => updateOrderStatus(order.id, e.target.value)}
                              >
                                <option value="pending">Nová (Čekající)</option>
                                <option value="preparing">V přípravě</option>
                                <option value="completed">Dokončená</option>
                                <option value="cancelled">Zrušená</option>
                              </select>
                              
                              <button
                                className="btn btn-outline"
                                style={{ flex: 1, padding: '6px', fontSize: '11px', borderColor: 'rgba(255,255,255,0.1)', color: 'var(--text-muted)', minHeight: '30px' }}
                                onClick={() => deleteOrder(order.id)}
                              >
                                Smazat
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* TAB 1: PRODUCTS MANAGER */}
          {activeTab === 'products' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px', marginBottom: '25px' }}>
                <h2 style={{ fontSize: '20px', fontWeight: 700 }}>Správa produktů</h2>
                <button className="btn btn-primary" onClick={openAddProductModal}>
                  ➕ Přidat produkt
                </button>
              </div>

              {/* Filters */}
              <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
                <input 
                  type="text" 
                  className="form-input" 
                  style={{ maxWidth: '250px' }}
                  placeholder="Vyhledat produkt..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                
                <select 
                  className="form-select" 
                  style={{ maxWidth: '200px' }}
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                >
                  <option value="">Všechny kategorie</option>
                  {menu.map(c => (
                    <option key={c.category} value={c.category}>{c.category}</option>
                  ))}
                </select>
              </div>

              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Obrázek</th>
                    <th>Název (CZ)</th>
                    <th>Kategorie</th>
                    <th>Cena</th>
                    <th>Stav</th>
                    <th>Pořadí</th>
                    <th style={{ textAlign: 'right' }}>Akce</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                        Nenalezeny žádné produkty.
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map((prod) => (
                      <tr key={prod.id} style={{ opacity: prod.available ? 1 : 0.6 }}>
                        <td>
                          <img 
                            src={prod.image || '/logo.jpg'} 
                            alt={prod.name} 
                            style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px', backgroundColor: 'var(--bg-tertiary)' }} 
                          />
                        </td>
                        <td>
                          <strong>{prod.name}</strong>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{prod.englishName}</div>
                        </td>
                        <td>{prod.categoryName}</td>
                        <td style={{ fontWeight: 700, color: 'var(--color-gold)' }}>{formatPrice(prod.price)}</td>
                        <td>
                          <button 
                            onClick={() => toggleProductAvailability(prod.id, prod.categoryName, prod.available)}
                            className={`badge ${prod.available ? 'badge-success' : 'badge-warning'}`}
                            style={{ border: 'none', cursor: 'pointer' }}
                          >
                            {prod.available ? 'Zobrazit' : 'Skrýt'}
                          </button>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '3px' }}>
                            <button 
                              className="btn btn-secondary" 
                              style={{ padding: '3px 6px', fontSize: '10px' }}
                              disabled={prod.index === 0}
                              onClick={() => moveProductOrder(prod.categoryName, prod.index, 'up')}
                            >
                              ▲
                            </button>
                            <button 
                              className="btn btn-secondary" 
                              style={{ padding: '3px 6px', fontSize: '10px' }}
                              disabled={prod.index === (menu.find(c => c.category === prod.categoryName)?.items.length || 0) - 1}
                              onClick={() => moveProductOrder(prod.categoryName, prod.index, 'down')}
                            >
                              ▼
                            </button>
                          </div>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '8px' }}>
                            <button 
                              className="btn btn-secondary btn-sm" 
                              onClick={() => openEditProductModal(prod, prod.categoryName)}
                            >
                              Upravit
                            </button>
                            <button 
                              className="btn btn-outline btn-sm" 
                              style={{ borderColor: 'var(--color-accent)', color: 'var(--color-accent)' }}
                              onClick={() => deleteProduct(prod.id, prod.categoryName)}
                            >
                              Smazat
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 2: CATEGORIES MANAGER */}
          {activeTab === 'categories' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
                <h2 style={{ fontSize: '20px', fontWeight: 700 }}>Správa kategorií</h2>
                <button className="btn btn-primary" onClick={openAddCategoryModal}>
                  ➕ Přidat kategorii
                </button>
              </div>

              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Název kategorie</th>
                    <th>Počet produktů</th>
                    <th>Pořadí</th>
                    <th style={{ textAlign: 'right' }}>Akce</th>
                  </tr>
                </thead>
                <tbody>
                  {menu.map((cat, idx) => (
                    <tr key={cat.category}>
                      <td style={{ fontSize: '16px', fontWeight: 700 }}>{cat.category}</td>
                      <td>{cat.items.length} produktů</td>
                      <td>
                        <div style={{ display: 'flex', gap: '3px' }}>
                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: '3px 6px', fontSize: '10px' }}
                            disabled={idx === 0}
                            onClick={() => moveCategoryOrder(idx, 'up')}
                          >
                            ▲
                          </button>
                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: '3px 6px', fontSize: '10px' }}
                            disabled={idx === menu.length - 1}
                            onClick={() => moveCategoryOrder(idx, 'down')}
                          >
                            ▼
                          </button>
                        </div>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '8px' }}>
                          <button 
                            className="btn btn-secondary btn-sm" 
                            onClick={() => openEditCategoryModal(cat.category)}
                          >
                            Přejmenovat
                          </button>
                          <button 
                            className="btn btn-outline btn-sm" 
                            style={{ borderColor: 'var(--color-accent)', color: 'var(--color-accent)' }}
                            onClick={() => deleteCategory(cat.category)}
                          >
                            Smazat
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 3: SETTINGS MANAGER */}
          {activeTab === 'settings' && settings && (
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '25px' }}>Nastavení webu</h2>
              
              <form onSubmit={saveSettingsSubmit}>
                {/* Announcement Section */}
                <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '20px', marginBottom: '25px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '15px', color: 'var(--color-gold)' }}>Oznamovací banner</h3>
                  
                  <div className="form-group">
                    <label className="form-checkbox-label">
                      <input 
                        type="checkbox" 
                        className="form-checkbox"
                        checked={settings.announcement.visible}
                        onChange={(e) => handleSettingsFieldChange('announcement.visible', e.target.checked)}
                      />
                      Zobrazit oznamovací banner na webu
                    </label>
                  </div>
                  
                  <div className="form-group">
                    <label className="form-label" htmlFor="announcement-text-input">Text oznámení</label>
                    <input 
                      id="announcement-text-input"
                      type="text" 
                      className="form-input" 
                      value={settings.announcement.text}
                      onChange={(e) => handleSettingsFieldChange('announcement.text', e.target.value)}
                    />
                  </div>
                </div>

                {/* Hero Section */}
                <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '20px', marginBottom: '25px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '15px', color: 'var(--color-gold)' }}>Úvodní sekce (Hero)</h3>
                  
                  <div className="form-group">
                    <label className="form-label" htmlFor="hero-title-input">Hlavní nadpis (musí obsahovat slovo "Choco Choo" pro zvýraznění)</label>
                    <input 
                      id="hero-title-input"
                      type="text" 
                      className="form-input" 
                      value={settings.heroTitle}
                      onChange={(e) => handleSettingsFieldChange('heroTitle', e.target.value)}
                      required
                    />
                  </div>
                  
                  <div className="form-group">
                    <label className="form-label" htmlFor="hero-subtitle-input">Podnadpis (popis kavárny)</label>
                    <textarea 
                      id="hero-subtitle-input"
                      className="form-textarea" 
                      value={settings.heroSubtitle}
                      onChange={(e) => handleSettingsFieldChange('heroSubtitle', e.target.value)}
                      required
                    />
                  </div>
                </div>

                {/* Contact Section */}
                <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '20px', marginBottom: '25px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '15px', color: 'var(--color-gold)' }}>Kontaktní informace</h3>
                  
                  <div className="form-group">
                    <label className="form-label" htmlFor="address-input">Adresa provozovny</label>
                    <input 
                      id="address-input"
                      type="text" 
                      className="form-input" 
                      value={settings.address}
                      onChange={(e) => handleSettingsFieldChange('address', e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="phone-input">Telefonní číslo</label>
                    <input 
                      id="phone-input"
                      type="text" 
                      className="form-input" 
                      value={settings.phone}
                      onChange={(e) => handleSettingsFieldChange('phone', e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="instagram-url-input">Odkaz na Instagram</label>
                    <input 
                      id="instagram-url-input"
                      type="text" 
                      className="form-input" 
                      value={settings.instagramUrl}
                      onChange={(e) => handleSettingsFieldChange('instagramUrl', e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="email-input">Kontaktní E-mail</label>
                    <input 
                      id="email-input"
                      type="email" 
                      className="form-input" 
                      value={settings.email}
                      onChange={(e) => handleSettingsFieldChange('email', e.target.value)}
                      required
                    />
                  </div>
                </div>

                {/* Opening Hours Section */}
                <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '20px', marginBottom: '25px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '15px', color: 'var(--color-gold)' }}>Otevírací doba</h3>
                  
                  {Object.entries(settings.openingHours).map(([day, hours]) => {
                    const daysInCzech: Record<string, string> = {
                      Monday: 'Pondělí',
                      Tuesday: 'Úterý',
                      Wednesday: 'Středa',
                      Thursday: 'Čtvrtek',
                      Friday: 'Pátek',
                      Saturday: 'Sobota',
                      Sunday: 'Neděle'
                    };

                    return (
                      <div key={day} style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.02)', flexWrap: 'wrap' }}>
                        <span style={{ width: '100px', fontWeight: 600 }}>{daysInCzech[day] || day}</span>
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <label className="form-checkbox-label">
                            <input 
                              type="checkbox" 
                              className="form-checkbox"
                              checked={hours.closed}
                              onChange={(e) => handleHoursChange(day, 'closed', e.target.checked)}
                            />
                            Zavřeno
                          </label>
                        </div>

                        {!hours.closed && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <input 
                              type="text" 
                              className="form-input" 
                              style={{ width: '80px', padding: '6px' }}
                              value={hours.open}
                              placeholder="16:00"
                              onChange={(e) => handleHoursChange(day, 'open', e.target.value)}
                              required
                            />
                            <span>do</span>
                            <input 
                              type="text" 
                              className="form-input" 
                              style={{ width: '80px', padding: '6px' }}
                              value={hours.close}
                              placeholder="02:00"
                              onChange={(e) => handleHoursChange(day, 'close', e.target.value)}
                              required
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '30px' }}>
                  <button type="submit" className="btn btn-primary" style={{ padding: '14px 28px' }}>
                    💾 Uložit všechna nastavení
                  </button>
                </div>
              </form>
            </div>
          )}

        </main>
      </div>

      {/* MODAL: ADD / EDIT PRODUCT */}
      {productModalOpen && (
        <div className="modal-overlay" onClick={() => setProductModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{editingProduct ? 'Upravit produkt' : 'Přidat produkt'}</h3>
              <button className="cart-close-btn" onClick={() => setProductModalOpen(false)}>&times;</button>
            </div>
            <form onSubmit={saveProductSubmit}>
              <div className="modal-body">
                
                <div className="form-group">
                  <label className="form-label" htmlFor="prod-category-select">Kategorie</label>
                  <select 
                    id="prod-category-select"
                    className="form-select" 
                    value={prodCategory} 
                    onChange={(e) => setProdCategory(e.target.value)}
                    required
                  >
                    {menu.map(c => (
                      <option key={c.category} value={c.category}>{c.category}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="prod-name-input">Název produktu (česky)</label>
                  <input 
                    id="prod-name-input"
                    type="text" 
                    className="form-input" 
                    value={prodName}
                    onChange={(e) => setProdName(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="prod-eng-name-input">Název produktu (anglicky)</label>
                  <input 
                    id="prod-eng-name-input"
                    type="text" 
                    className="form-input" 
                    value={prodEngName}
                    onChange={(e) => setProdEngName(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="prod-desc-input">Popis produktu (česky)</label>
                  <textarea 
                    id="prod-desc-input"
                    className="form-textarea" 
                    value={prodDesc}
                    onChange={(e) => setProdDesc(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="prod-eng-desc-input">Popis produktu (anglicky)</label>
                  <textarea 
                    id="prod-eng-desc-input"
                    className="form-textarea" 
                    value={prodEngDesc}
                    onChange={(e) => setProdEngDesc(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="prod-price-input">Cena (Kč)</label>
                  <input 
                    id="prod-price-input"
                    type="number" 
                    className="form-input" 
                    value={prodPrice}
                    onChange={(e) => setProdPrice(Number(e.target.value))}
                    required
                    min={0}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="prod-image-input">URL adresa obrázku (např. `/menu/nutella.jpg` nebo externí link)</label>
                  <input 
                    id="prod-image-input"
                    type="text" 
                    className="form-input" 
                    value={prodImage}
                    onChange={(e) => setProdImage(e.target.value)}
                    placeholder="/menu/nazev.jpg"
                  />
                </div>

                <div className="form-group">
                  <label className="form-checkbox-label">
                    <input 
                      type="checkbox" 
                      className="form-checkbox"
                      checked={prodAvailable}
                      onChange={(e) => setProdAvailable(e.target.checked)}
                    />
                    Produkt je viditelný na webu (Zobrazit)
                  </label>
                </div>

              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setProductModalOpen(false)}>Zrušit</button>
                <button type="submit" className="btn btn-primary">Uložit produkt</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD / EDIT CATEGORY */}
      {categoryModalOpen && (
        <div className="modal-overlay" onClick={() => setCategoryModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3 className="modal-title">{editingCategory ? 'Upravit kategorii' : 'Přidat kategorii'}</h3>
              <button className="cart-close-btn" onClick={() => setCategoryModalOpen(false)}>&times;</button>
            </div>
            <form onSubmit={saveCategorySubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label" htmlFor="cat-name-input">Název kategorie</label>
                  <input 
                    id="cat-name-input"
                    type="text" 
                    className="form-input" 
                    value={catNameInput}
                    onChange={(e) => setCatNameInput(e.target.value)}
                    required
                    placeholder="Např. Palačinky, Káva"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setCategoryModalOpen(false)}>Zrušit</button>
                <button type="submit" className="btn btn-primary">Uložit kategorii</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
