'use client';

import React, { useState, useEffect, useRef } from 'react';
import { MenuCategory, StoreSettings, MenuItem } from '@/lib/db';
import { formatPrice } from '@/lib/utils';

interface QrMenuClientProps {
  initialMenu: MenuCategory[];
  initialSettings: StoreSettings;
}

export default function QrMenuClient({ initialMenu, initialSettings }: QrMenuClientProps) {
  const [menu] = useState<MenuCategory[]>(initialMenu);
  const [settings] = useState<StoreSettings>(initialSettings);
  const [activeCategory, setActiveCategory] = useState<string>('');
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);

  // Cart & Order Placement State
  const [cart, setCart] = useState<{ item: MenuItem; quantity: number }[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'credit' | 'applepay'>('cash');
  const [tableOrName, setTableOrName] = useState('');
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [placedOrder, setPlacedOrder] = useState<any | null>(null);

  const categoryRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Filter out disabled items
  const activeMenu = menu.map(cat => ({
    ...cat,
    items: cat.items.filter(item => item.available)
  })).filter(cat => cat.items.length > 0);

  // Display success only after an authenticated server status check.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    if (!id || !params.has('payment')) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    let attempts = 0;
    const check = async () => {
      try {
        const response = await fetch('/api/orders?id=' + encodeURIComponent(id));
        if (!response.ok) throw new Error('Verification unavailable');
        const order = await response.json();
        if (cancelled) return;
        if (order.paymentStatus === 'paid') {
          setPlacedOrder(order);
          window.history.replaceState({}, document.title, window.location.pathname);
          return;
        }
        if (order.paymentStatus === 'failed') {
          alert('Platba se nezdařila. Obraťte se na obsluhu.');
          window.history.replaceState({}, document.title, window.location.pathname);
          return;
        }
      } catch { if (cancelled) return; }
      if (++attempts < 20) timer = setTimeout(check, 3000);
      else alert('Platba zatím není potvrzena. Nevytvářejte další objednávku; obraťte se na obsluhu.');
    };
    void check();
    return () => { cancelled = true; clearTimeout(timer); };
  }, []); useEffect(() => {
    if (activeMenu.length > 0 && !activeCategory) {
      setActiveCategory(activeMenu[0].category);
    }

    const handleScroll = () => {
      const scrollPosition = window.scrollY + 120; // offset for sticky quick navigation
      
      for (const cat of activeMenu) {
        const el = categoryRefs.current[cat.category];
        if (el) {
          const top = el.offsetTop;
          const height = el.offsetHeight;
          if (scrollPosition >= top && scrollPosition < top + height) {
            setActiveCategory(cat.category);
            break;
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [activeMenu, activeCategory]);

  const scrollToCategory = (categoryName: string) => {
    setActiveCategory(categoryName);
    const el = categoryRefs.current[categoryName];
    if (el) {
      const offset = el.offsetTop - 100; // sticky header offset
      window.scrollTo({
        top: offset,
        behavior: 'smooth'
      });
    }
  };

  // Cart operations
  const addToCart = (item: MenuItem) => {
    setCart(prev => {
      const existing = prev.find(i => i.item.id === item.id);
      if (existing) {
        return prev.map(i => i.item.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { item, quantity: 1 }];
    });
  };

  const updateQuantity = (itemId: string, delta: number) => {
    setCart(prev => {
      return prev.map(i => {
        if (i.item.id === itemId) {
          const newQty = i.quantity + delta;
          return newQty > 0 ? { ...i, quantity: newQty } : null;
        }
        return i;
      }).filter(Boolean) as { item: MenuItem; quantity: number }[];
    });
  };

  const removeFromCart = (itemId: string) => {
    setCart(prev => prev.filter(i => i.item.id !== itemId));
  };

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) return;
    
    setIsSubmittingOrder(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cart.map(i => ({
            id: i.item.id,
            name: i.item.name,
            price: i.item.price,
            quantity: i.quantity
          })),
          paymentMethod,
          tableOrName,
          ref: 'qr'
        })
      });
      
      const data = await res.json();
      if (res.ok && data.success) {
        if (data.paymentUrl) {
          window.location.href = data.paymentUrl;
        } else {
          setPlacedOrder(data.order);
          setCart([]); // Clear cart
          setIsCartOpen(false); // Close cart drawer
        }
      } else {
        alert(data.error || 'Nastala chyba při odesílání objednávky.');
      }
    } catch (err) {
      console.error(err);
      alert('Chyba komunikace se serverem.');
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.item.price * item.quantity), 0);
  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="qr-menu-layout">
      {/* QR Welcome Header */}
      <div className="qr-menu-header">
        <img src="/logo.jpg" alt="Choco Choo" className="qr-menu-logo" />
        <h1 className="qr-menu-title">Choco Choo Prague</h1>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
          Palačinky · Vafle · Crofle · Belgická čokoláda
        </p>
        <span className="qr-menu-table">Objednávka u pultu 🛎️</span>
      </div>

      {/* Sticky category navigation */}
      <div className="qr-category-bar">
        <div style={{ display: 'flex', overflowX: 'auto', gap: '8px', padding: '5px 10px', scrollbarWidth: 'none' }}>
          {activeMenu.map((cat) => (
            <button
              key={cat.category}
              className={`category-tab ${activeCategory === cat.category ? 'active' : ''}`}
              style={{ padding: '6px 14px', fontSize: '12px' }}
              onClick={() => scrollToCategory(cat.category)}
            >
              {cat.category}
            </button>
          ))}
        </div>
      </div>

      {/* Product List */}
      <div style={{ marginTop: '20px', paddingBottom: '60px' }}>
        {activeMenu.map((cat) => {
          const categoryNameLower = cat.category.toLowerCase().trim();
          const isAddonCategory = categoryNameLower === 'add ons' || categoryNameLower === 'addons' || categoryNameLower === 'add-ons';
          
          return (
            <div 
              key={cat.category} 
              className="category-block"
              ref={(el) => { categoryRefs.current[cat.category] = el; }}
              style={{ marginBottom: '35px', scrollMarginTop: '100px' }}
            >
              <h2 className="category-title" style={{ fontSize: '18px', marginBottom: '15px' }}>{cat.category}</h2>
              <div className={isAddonCategory ? "qr-addons-grid" : "qr-items-grid"}>
                {cat.items.map((item) => {
                  if (isAddonCategory) {
                    return (
                      <div 
                        key={item.id} 
                        className="qr-addon-card"
                        onClick={() => setSelectedItem(item)}
                        style={{ cursor: 'pointer' }}
                      >
                        <span className="qr-addon-name">{item.name}</span>
                        <span className="qr-addon-price">{formatPrice(item.price)}</span>
                      </div>
                    );
                  }

                  return (
                    <div 
                      key={item.id} 
                      className="qr-item-card"
                      onClick={() => setSelectedItem(item)}
                      style={{ cursor: 'pointer' }}
                    >
                      {item.image && (
                        <img src={item.image} alt={item.name} className="qr-item-img" loading="lazy" />
                      )}
                      <div className="qr-item-info">
                        <div>
                          <h3 className="qr-item-name">{item.name}</h3>
                          <p className="qr-item-desc">{item.description || 'Čerstvě vyrobený dezert z belgické čokolády.'}</p>
                        </div>
                        <div className="qr-item-footer">
                          <span className="qr-item-price">{formatPrice(item.price)}</span>
                          <span className="qr-item-detail-btn">
                            <span>Detail</span>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <polyline points="9 18 15 12 9 6"/>
                            </svg>
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Floating Info */}
      <div style={{
        position: 'fixed',
        bottom: '15px',
        left: '50%',
        transform: 'translateX(-50%)',
        backgroundColor: 'rgba(34, 22, 18, 0.95)',
        border: '1px solid var(--border-color-light)',
        borderRadius: 'var(--radius-full)',
        padding: '10px 20px',
        fontSize: '12px',
        color: 'var(--text-primary)',
        boxShadow: 'var(--shadow-lg)',
        zIndex: 50,
        whiteSpace: 'nowrap',
        backdropFilter: 'blur(8px)'
      }}>
        📍 {settings.address} | 💳 Hotovost i karty
      </div>

      {/* Detail Modal */}
      {selectedItem && (
        <div className="modal-overlay" onClick={() => setSelectedItem(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '450px' }}>
            <div className="modal-header">
              <h3 className="modal-title">{selectedItem.name}</h3>
              <button className="cart-close-btn" onClick={() => setSelectedItem(null)}>&times;</button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div style={{ position: 'relative', width: '100%', aspectRatio: '16/10', borderRadius: 'var(--radius-md)', overflow: 'hidden', backgroundColor: 'var(--bg-tertiary)' }}>
                {selectedItem.image ? (
                  <img src={selectedItem.image} alt={selectedItem.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div className="placeholder-card-img" style={{ height: '100%' }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: '40px', height: '40px' }}>
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                      <polyline points="21 15 16 10 5 21"/>
                    </svg>
                    <span>Bez obrázku</span>
                  </div>
                )}
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Cena</span>
                  <span style={{ fontSize: '18px', fontWeight: 800, color: 'var(--color-gold)' }}>{formatPrice(selectedItem.price)}</span>
                </div>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {selectedItem.description || 'Sladký pokrm připravovaný z belgické čokolády a prémiových ingrediencí.'}
                </p>
              </div>
            </div>
            <div className="modal-footer" style={{ padding: '15px', display: 'flex', gap: '10px' }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setSelectedItem(null)}>Zavřít</button>
              <button 
                className="btn btn-primary"
                style={{ flex: 2 }}
                onClick={() => {
                  addToCart(selectedItem);
                  setSelectedItem(null);
                }}
              >
                Přidat do košíku
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Cart Trigger */}
      {cartItemCount > 0 && (
        <button 
          id="cart-trigger-btn"
          onClick={() => setIsCartOpen(true)} 
          className="btn btn-primary"
          style={{ 
            position: 'fixed', 
            bottom: '75px', 
            right: '20px', 
            borderRadius: '50%', 
            width: '60px', 
            height: '60px', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            boxShadow: 'var(--shadow-lg)',
            zIndex: 100
          }}
          aria-label="Nákupní košík"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/>
            <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>
          </svg>
          <span className="cart-floating-badge" style={{ position: 'absolute', top: '-5px', right: '-5px', backgroundColor: 'var(--color-accent)', color: '#fff', borderRadius: '50%', width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 800 }}>
            {cartItemCount}
          </span>
        </button>
      )}

      {/* Cart Drawer Menu */}
      <div className={`cart-overlay ${isCartOpen ? 'open' : ''}`} onClick={() => setIsCartOpen(false)}></div>
      <div className={`cart-drawer ${isCartOpen ? 'open' : ''}`} id="cart-drawer-menu" style={{ zIndex: 101 }}>
        <div className="cart-header">
          <h3 className="cart-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/>
              <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>
            </svg>
            Váš výběr ({cartItemCount})
          </h3>
          <button className="cart-close-btn" onClick={() => setIsCartOpen(false)}>&times;</button>
        </div>

        <div className="cart-items">
          {cart.length === 0 ? (
            <div className="cart-empty-message">
              <p>Košík je prázdný</p>
              <p style={{ fontSize: '12px', marginTop: '10px' }}>Vyberte si ze sladkého menu Choco Choo!</p>
            </div>
          ) : (
            cart.map(({ item, quantity }) => (
              <div key={item.id} className="cart-item">
                <img src={item.image || '/logo.jpg'} alt={item.name} className="cart-item-img" />
                <div className="cart-item-details">
                  <h4 className="cart-item-name">{item.name}</h4>
                  <div className="cart-item-price">{formatPrice(item.price * quantity)}</div>
                  <div className="cart-item-controls">
                    <div className="quantity-control">
                      <button className="quantity-btn" onClick={() => updateQuantity(item.id, -1)}>-</button>
                      <span className="quantity-val">{quantity}</span>
                      <button className="quantity-btn" onClick={() => updateQuantity(item.id, 1)}>+</button>
                    </div>
                    <button className="cart-item-remove" onClick={() => removeFromCart(item.id)}>Odebrat</button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {cart.length > 0 && (
          <div className="cart-footer" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '15px' }}>
            <div className="cart-summary-row" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span>Položky</span>
              <span>{cartItemCount}x</span>
            </div>
            <div className="cart-summary-total" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', fontSize: '18px', fontWeight: 800, color: 'var(--color-gold)' }}>
              <span>Celkem k placení</span>
              <span>{formatPrice(cartTotal)}</span>
            </div>
            
            <form onSubmit={handleSubmitOrder} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <label className="form-label" style={{ display: 'block', fontSize: '13px', marginBottom: '6px', color: 'var(--text-secondary)' }}>
                  Metoda platby *
                </label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    className={`btn ${paymentMethod === 'cash' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ flex: 1, padding: '10px', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                    onClick={() => setPaymentMethod('cash')}
                  >
                    💵 Hotovost
                  </button>
                  <button
                    type="button"
                    className={`btn ${paymentMethod === 'credit' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ flex: 1, padding: '10px', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                    onClick={() => setPaymentMethod('credit')}
                  >
                    💳 Karta
                  </button>
                  <button
                    type="button"
                    className={`btn ${paymentMethod === 'applepay' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ flex: 1, padding: '10px', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                    onClick={() => setPaymentMethod('applepay')}
                  >
                    🍎 Apple Pay
                  </button>
                </div>
              </div>
              
              <div>
                <label className="form-label" htmlFor="qr-table-or-name-input" style={{ display: 'block', fontSize: '13px', marginBottom: '6px', color: 'var(--text-secondary)' }}>
                  Číslo stolu / Jméno
                </label>
                <input
                  id="qr-table-or-name-input"
                  type="text"
                  className="form-input"
                  style={{ width: '100%', padding: '10px', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color-light)', color: 'var(--text-primary)', borderRadius: 'var(--radius-sm)' }}
                  placeholder="Např. Stůl 5, Yaman..."
                  value={tableOrName}
                  onChange={(e) => setTableOrName(e.target.value)}
                />
              </div>
              
              <button 
                type="submit" 
                className="btn btn-primary" 
                style={{ width: '100%', padding: '12px', fontSize: '15px', fontWeight: 700 }}
                disabled={isSubmittingOrder}
              >
                {isSubmittingOrder ? 'Odesílání...' : 'Odeslat objednávku 🛎️'}
              </button>
            </form>
            
            <p className="cart-instruction" style={{ marginTop: '15px', fontSize: '11px', color: 'var(--text-secondary)', textAlign: 'center', lineHeight: '1.4' }}>
              📢 Vaše objednávka se odešle přímo do kuchyně. Zaplatíte na místě zvolenou metodou.
            </p>
          </div>
        )}
      </div>

      {/* Placed Order Confirmation Modal */}
      {placedOrder && (
        <div className="modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="modal-content" style={{ maxWidth: '450px', width: '90%', textAlign: 'center', padding: '30px' }}>
            <div style={{ fontSize: '50px', marginBottom: '15px' }}>🎉</div>
            <h3 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--color-gold)', marginBottom: '10px' }}>
              Objednávka odeslána!
            </h3>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
              Děkujeme! Vaše objednávka byla odeslána a začínáme ji připravovat.
            </p>
            
            <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '20px', marginBottom: '25px', display: 'flex', flexDirection: 'column', gap: '12px', textAlign: 'left' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Číslo pro Vás:</span>
                <span style={{ fontSize: '18px', fontWeight: 800, color: 'var(--color-gold)' }}>#{placedOrder.customerNumber}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Kód prodejce:</span>
                <span style={{ fontSize: '13px', fontWeight: 600 }}>{placedOrder.id}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Platební metoda:</span>
                <span style={{ fontSize: '13px', fontWeight: 600 }}>
                  {placedOrder.paymentMethod === 'cash' 
                    ? '💵 Hotovost' 
                    : placedOrder.paymentMethod === 'applepay' 
                    ? '🍎 Apple Pay' 
                    : '💳 Karta'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Celkem k úhradě:</span>
                <span style={{ fontSize: '15px', fontWeight: 800, color: 'var(--color-gold)' }}>{formatPrice(placedOrder.totalPrice)}</span>
              </div>
            </div>
            
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '25px', lineHeight: 1.5 }}>
              📢 Zapamatujte si číslo objednávky <strong>(#{placedOrder.customerNumber})</strong>. Obsluha jej použije pro doručení nebo k vyzvání u pokladny.
            </p>
            
            <button className="btn btn-primary" style={{ width: '100%', padding: '12px' }} onClick={() => setPlacedOrder(null)}>
              Rozumím
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
