'use client';

import React, { useState, useEffect, useRef } from 'react';
import { MenuCategory, StoreSettings, MenuItem } from '@/lib/db';
import { isStoreCurrentlyOpen, formatPrice } from '@/lib/utils';

interface HomeClientProps {
  initialMenu: MenuCategory[];
  initialSettings: StoreSettings;
}

export default function HomeClient({ initialMenu, initialSettings }: HomeClientProps) {
  // Local state initialized with server-fetched SSR data
  const [menu] = useState<MenuCategory[]>(initialMenu);
  const [settings] = useState<StoreSettings>(initialSettings);
  
  // Cart state
  const [cart, setCart] = useState<{ item: MenuItem; quantity: number }[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  
  // Selected category tab state
  const [activeCategory, setActiveCategory] = useState<string>('');
  
  // Modal state for viewing single item details
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);

  // Store open status (calculated client-side to keep timezone accurate)
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setIsOpen(isStoreCurrentlyOpen(settings));
    const interval = setInterval(() => {
      setIsOpen(isStoreCurrentlyOpen(settings));
    }, 60000); // refresh every minute
    return () => clearInterval(interval);
  }, [settings]);

  // Sync category active tab based on window scroll
  const categoryRefs = useRef<Record<string, HTMLDivElement | null>>({});
  
  useEffect(() => {
    if (menu.length > 0 && !activeCategory) {
      setActiveCategory(menu[0].category);
    }

    const handleScroll = () => {
      const scrollPosition = window.scrollY + 180; // offset for sticky navs
      
      for (const cat of menu) {
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
  }, [menu, activeCategory]);

  // Scroll to category block
  const scrollToCategory = (categoryName: string) => {
    setActiveCategory(categoryName);
    const el = categoryRefs.current[categoryName];
    if (el) {
      const offset = el.offsetTop - 140; // sticky header + tab offset
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
    // Visual feedback (optional cart open or small toast)
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

  const cartTotal = cart.reduce((sum, item) => sum + (item.item.price * item.quantity), 0);
  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  // Filter out disabled items for display
  const activeMenu = menu.map(cat => ({
    ...cat,
    items: cat.items.filter(item => item.available)
  })).filter(cat => cat.items.length > 0);

  // Select 8 popular items for horizontal scroll (e.g. Nutella, Kinder Ecstasy, Berry Fairy, Dubai, Oreo)
  const popularItems: MenuItem[] = [];
  activeMenu.forEach(cat => {
    cat.items.forEach(item => {
      const isPopular = [
        'nutella', 'kinder-ecstasy', 'berry-fairy', 'all-in', 'king-oreo', 'i-love-choco-choo', 
        'viral-dubai-chocolate-crepe', 'cookie-dubai-chocolate-marshmallow', 'maki-rolls-mix', 'strawberry-dubai-chocolate-cup'
      ].some(slug => item.id.includes(slug));
      
      if (isPopular && popularItems.length < 9) {
        popularItems.push(item);
      }
    });
  });

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      
      {/* Announcement Banner */}
      {settings.announcement?.visible && settings.announcement?.text && (
        <div id="announcement-banner" className="announcement-banner">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <span>{settings.announcement.text}</span>
        </div>
      )}

      {/* Sticky Header */}
      <header className="header">
        <div className="container header-container">
          <a href="/" className="logo-link" id="header-logo-link">
            <img src="/assets/logo.png" alt="Choco Choo Logo" className="logo-img" onError={(e) => {
              // Fallback to /logo.jpg if assets logo png fails
              (e.target as HTMLImageElement).src = '/logo.jpg';
            }} />
          </a>
          
          <nav className="nav-links">
            <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="nav-link active">Menu</button>
            <button onClick={() => {
              const el = document.getElementById('footer-contact');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }} className="nav-link">Kontakt</button>
            <a href="/admin" className="nav-link">Admin</a>
          </nav>

          <div className="nav-actions">
            {/* Cart Trigger */}
            <button 
              id="cart-trigger-btn"
              onClick={() => setIsCartOpen(true)} 
              className="btn btn-secondary btn-circle"
              style={{ position: 'relative' }}
              aria-label="Nákupní košík"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/>
                <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>
              </svg>
              {cartItemCount > 0 && (
                <span className="cart-floating-badge">{cartItemCount}</span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main style={{ flexGrow: 1 }}>
        
        {/* Hero Section */}
        <section className="hero">
          <img src="/assets/hero.jpeg" alt="Choco Choo Banner" className="hero-bg" />
          <div className="hero-overlay"></div>
          <div className="container">
            <div className="hero-content">
              <span className="hero-badge">Zrozeno v Torontu 🇨🇦 · Vyrobeno v Praze s láskou ❤️</span>
              <h1 className="hero-title" id="main-hero-title">
                {settings.heroTitle.split('Choco Choo')[0]}
                <span>Choco Choo</span>
                {settings.heroTitle.split('Choco Choo')[1]}
              </h1>
              <p className="hero-subtitle" id="main-hero-subtitle">{settings.heroSubtitle}</p>
              
              <div className="hero-features">
                <div className="hero-feature">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
                    <line x1="3" y1="6" x2="21" y2="6"/>
                    <path d="M16 10a4 4 0 0 1-8 0"/>
                  </svg>
                  Objednávejte u pultu — na místě i s sebou
                </div>
                <div className="hero-feature">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <rect x="2" y="5" width="20" height="14" rx="2" ry="2"/>
                    <line x1="2" y1="10" x2="22" y2="10"/>
                  </svg>
                  Přijímáme hotovost i karty 💳
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Most Popular Scroll Section */}
        {popularItems.length > 0 && (
          <section className="popular-section">
            <div className="container">
              <h2 className="section-title">
                <span>⭐</span> Naše nejoblíbenější
              </h2>
              <div className="popular-scroll">
                {popularItems.map((item) => (
                  <div 
                    key={item.id} 
                    className="popular-card"
                    onClick={() => setSelectedItem(item)}
                  >
                    <div className="popular-img-wrapper">
                      {item.image ? (
                        <img src={item.image} alt={item.name} className="popular-img" loading="lazy" />
                      ) : (
                        <div className="placeholder-card-img">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                            <circle cx="8.5" cy="8.5" r="1.5"/>
                            <polyline points="21 15 16 10 5 21"/>
                          </svg>
                          <span>Sweets</span>
                        </div>
                      )}
                    </div>
                    <div className="popular-name">{item.name}</div>
                    <div className="popular-price">{formatPrice(item.price)}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Category sticky filter tabs */}
        <div className="category-nav-wrapper">
          <div className="container">
            <div className="category-nav">
              {activeMenu.map((cat) => (
                <button
                  key={cat.category}
                  className={`category-tab ${activeCategory === cat.category ? 'active' : ''}`}
                  onClick={() => scrollToCategory(cat.category)}
                >
                  {cat.category}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Products List section */}
        <section className="menu-section">
          <div className="container">
            {activeMenu.map((cat) => (
              <div 
                key={cat.category} 
                className="category-block"
                ref={(el) => { categoryRefs.current[cat.category] = el; }}
              >
                <h3 className="category-title">{cat.category}</h3>
                <div className="menu-grid">
                  {cat.items.map((item) => (
                    <div key={item.id} className="product-card">
                      <div className="product-img-wrapper" onClick={() => setSelectedItem(item)} style={{ cursor: 'pointer' }}>
                        {item.image ? (
                          <img src={item.image} alt={item.name} className="product-img" loading="lazy" />
                        ) : (
                          <div className="placeholder-card-img">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                              <circle cx="8.5" cy="8.5" r="1.5"/>
                              <polyline points="21 15 16 10 5 21"/>
                            </svg>
                            <span>Bez obrázku</span>
                          </div>
                        )}
                      </div>
                      <div className="product-info">
                        <div className="product-header">
                          <h4 className="product-name" onClick={() => setSelectedItem(item)} style={{ cursor: 'pointer' }}>{item.name}</h4>
                          <span className="product-price">{formatPrice(item.price)}</span>
                        </div>
                        <p className="product-desc">{item.description || 'Výtečný dezert z prémiových surovin.'}</p>
                        
                        <div className="product-actions">
                          <span className="product-tag">{cat.category}</span>
                          <button 
                            onClick={() => addToCart(item)}
                            className="btn btn-primary btn-sm"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <line x1="12" y1="5" x2="12" y2="19"/>
                              <line x1="5" y1="12" x2="19" y2="12"/>
                            </svg>
                            Přidat
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

      </main>

      {/* Cart Drawer Menu */}
      <div className={`cart-overlay ${isCartOpen ? 'open' : ''}`} onClick={() => setIsCartOpen(false)}></div>
      <div className={`cart-drawer ${isCartOpen ? 'open' : ''}`} id="cart-drawer-menu">
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
          <div className="cart-footer">
            <div className="cart-summary-row">
              <span>Položky</span>
              <span>{cartItemCount}x</span>
            </div>
            <div className="cart-summary-total">
              <span>Celkem k placení</span>
              <span>{formatPrice(cartTotal)}</span>
            </div>
            
            <button className="btn btn-primary" style={{ width: '100%', padding: '12px', fontSize: '15px' }} onClick={() => setIsCartOpen(false)}>
              Zavřít a ukázat u pokladny
            </button>
            
            <p className="cart-instruction">
              📢 <strong>Objednávejte prosím u pultu.</strong><br />
              Ukažte tento displej obsluze při placení pro rychlé vyřízení objednávky.
            </p>
          </div>
        )}
      </div>

      {/* Item Details Popup Modal */}
      {selectedItem && (
        <div className="modal-overlay" onClick={() => setSelectedItem(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{selectedItem.name}</h3>
              <button className="cart-close-btn" onClick={() => setSelectedItem(null)}>&times;</button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ position: 'relative', width: '100%', aspectRatio: '16/10', borderRadius: 'var(--radius-md)', overflow: 'hidden', backgroundColor: 'var(--bg-tertiary)' }}>
                {selectedItem.image ? (
                  <img src={selectedItem.image} alt={selectedItem.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div className="placeholder-card-img" style={{ height: '100%' }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: '48px', height: '48px' }}>
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                      <circle cx="8.5" cy="8.5" r="1.5"/>
                      <polyline points="21 15 16 10 5 21"/>
                    </svg>
                    <span>Bez obrázku</span>
                  </div>
                )}
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <span style={{ fontSize: '14px', color: 'var(--color-gold)', fontWeight: 700 }}>Cena</span>
                  <span style={{ fontSize: '20px', fontWeight: 800, color: 'var(--color-gold-hover)' }}>{formatPrice(selectedItem.price)}</span>
                </div>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  {selectedItem.description || 'Tento jedinečný sladký produkt je ručně vyráběn z těch nejlepších čokoládových surovin a čerstvých ingrediencí.'}
                </p>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setSelectedItem(null)}>Zavřít</button>
              <button 
                className="btn btn-primary"
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

      {/* Footer / Contact Details */}
      <footer className="footer" id="footer-contact">
        <div className="container">
          <div className="footer-grid">
            <div className="footer-info-brand">
              <h3 className="footer-title">Choco Choo</h3>
              <p className="footer-desc" style={{ marginBottom: '15px' }}>
                Palačinky · Vafle · Crofle · Belgická čokoláda. Zrozeno v Torontu, vyrobeno s láskou a řemeslnou péčí v Žižkově, Praha.
              </p>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <span className={`active-indicator ${isOpen ? 'open' : 'closed'}`} id="store-status-indicator">
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'currentColor' }}></span>
                  {isOpen ? 'Otevřeno' : 'Zavřeno'}
                </span>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Dnes: 16:00–02:00</span>
              </div>
            </div>

            <div>
              <h4 className="footer-column-title">Kde nás najdete</h4>
              <div className="footer-contact-item">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                  <circle cx="12" cy="10" r="3"/>
                </svg>
                <a href="https://maps.google.com/?q=Hartigova+77,+Praha+3" target="_blank" rel="noopener noreferrer">
                  {settings.address}
                </a>
              </div>
              <div className="footer-contact-item">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                </svg>
                <a href={`tel:${settings.phone}`}>{settings.phone}</a>
              </div>
              <div className="footer-contact-item">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
                  <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
                </svg>
                <a href={settings.instagramUrl} target="_blank" rel="noopener noreferrer">
                  @chocochoo.cz
                </a>
              </div>
            </div>

            <div>
              <h4 className="footer-column-title">Otevírací doba</h4>
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
                
                // Highlight current day
                const pragueTimeStr = new Date().toLocaleString("en-US", { timeZone: "Europe/Prague" });
                const currentDayName = new Date(pragueTimeStr).toLocaleDateString('en-US', { weekday: 'long' });
                const isToday = day === currentDayName;

                return (
                  <div key={day} className={`footer-hours-row ${isToday ? 'today' : ''}`}>
                    <span>{daysInCzech[day] || day}</span>
                    <span>{hours.closed ? 'Zavřeno' : `${hours.open} – ${hours.close}`}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="footer-bottom">
            <p className="footer-copy">&copy; {new Date().getFullYear()} Choco Choo Prague. Všechna práva vyhrazena.</p>
            <p className="footer-copy" style={{ fontSize: '11px' }}>Zrozeno v Torontu 🇨🇦 · Vyrobeno v Praze 🇨🇿</p>
          </div>
        </div>
      </footer>

    </div>
  );
}
