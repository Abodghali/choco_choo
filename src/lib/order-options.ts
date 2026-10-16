import type { MenuCategory, MenuItem, OrderItem } from './db';
export const WEEKDAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
export const PREP_MINUTES = [10,15,20,25,30];
export function getAddOns(menu: MenuCategory[]) {
  return menu.filter(c => /add[\s_-]*ons?/i.test(c.category)).flatMap(c => c.items).filter(i => i.available);
}
export type CartLine = { item: MenuItem; quantity: number; addOnIds?: string[]; note?: string };
export function linePrice(line: CartLine, addOns: MenuItem[]) {
  return (Math.round(line.item.price * 100) + (line.addOnIds || []).reduce((sum,id) => sum + Math.round((addOns.find(a => a.id === id)?.price || 0) * 100),0)) / 100;
}
export function buildOrderItems(items: unknown[], menu: MenuCategory[]): OrderItem[] {
  const products = menu.flatMap(c => c.items);
  const addOns = getAddOns(menu);
  const seen = new Set<string>();
  return items.map(raw => {
    if (!raw || typeof raw !== 'object') throw new Error('Invalid item');
    const entry = raw as Record<string, unknown>;
    const product = products.find(p => p.id === entry.id);
    const quantity = entry.quantity;
    if (!product || !product.available || seen.has(product.id) || !Number.isInteger(quantity) || (quantity as number) < 1 || (quantity as number) > 50 || !Number.isFinite(product.price) || product.price <= 0) throw new Error('Invalid product or quantity');
    seen.add(product.id);
    if (entry.note !== undefined && (typeof entry.note !== 'string' || entry.note.length > 500)) throw new Error('Invalid note');
    const ids = entry.addOnIds ?? [];
    if (!Array.isArray(ids) || ids.length > 30 || new Set(ids).size !== ids.length || (ids.length && addOns.some(a => a.id === product.id))) throw new Error('Invalid add-ons');
    const extras = ids.map(id => {
      const extra = addOns.find(a => a.id === id);
      if (!extra || !Number.isFinite(extra.price) || extra.price <= 0) throw new Error('Unavailable add-on');
      return { id:extra.id, name:extra.name, price:extra.price };
    });
    const price = (Math.round(product.price * 100) + extras.reduce((sum,a) => sum + Math.round(a.price*100),0))/100;
    return { id:product.id,name:product.name,price,quantity:quantity as number,addOns:extras,note:(entry.note as string || '').trim() };
  });
}
