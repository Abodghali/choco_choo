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

  const categoryRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Filter out disabled items
  const activeMenu = menu.map(cat => ({
    ...cat,
    items: cat.items.filter(item => item.available)
  })).filter(cat => cat.items.length > 0);

  useEffect(() => {
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

  return (
    <div className="qr-menu-layout">
      {/* QR Welcome Header */}
      <div className="qr-menu-header">
        <img src="/logo.jpg" alt="Choco Choo" className="qr-menu-logo" style={{ borderRadius: '50%' }} />
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
        {activeMenu.map((cat) => (
          <div 
            key={cat.category} 
            className="category-block"
            ref={(el) => { categoryRefs.current[cat.category] = el; }}
            style={{ marginBottom: '35px', scrollMarginTop: '100px' }}
          >
            <h2 className="category-title" style={{ fontSize: '18px', marginBottom: '15px' }}>{cat.category}</h2>
            <div>
              {cat.items.map((item) => (
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
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        Zobrazit detail
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <polyline points="9 18 15 12 9 6"/>
                        </svg>
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
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
            <div className="modal-footer" style={{ padding: '15px' }}>
              <button className="btn btn-secondary" style={{ width: '100%' }} onClick={() => setSelectedItem(null)}>Zavřít</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
