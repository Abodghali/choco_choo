import type { MenuCategory, StoreSettings } from './db';
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown, max = 2000): v is string => typeof v === 'string' && v.length <= max;
function safeUrl(v: unknown, local = false) {
  if (!str(v)) return false;
  if (v === '') return true;
  if (local && /^\/(?!\/)/.test(v) && !v.includes('\\')) return true;
  try { const u = new URL(v); return u.protocol === 'https:' && !u.username && !u.password; } catch { return false; }
}
export function validMenu(v: unknown): v is MenuCategory[] {
  if (!Array.isArray(v) || v.length > 100) return false;
  const ids = new Set();
  return v.every(c => record(c) && str(c.category, 100) && Array.isArray(c.items) && c.items.length <= 200 && c.items.every((i: unknown) => {
    if (!record(i) || !str(i.id,100) || !i.id || ids.has(i.id)) return false;
    ids.add(i.id);
    return ['name','englishName','description','englishDescription'].every(k => str(i[k])) && typeof i.price === 'number' && Number.isFinite(i.price) && i.price > 0 && i.price <= 100000 && typeof i.available === 'boolean' && safeUrl(i.image,true);
  }));
}
export function validSettings(v: unknown): v is StoreSettings {
  if (!record(v) || !['address','phone','email','heroTitle','heroSubtitle'].every(k => str(v[k])) || !safeUrl(v.instagramUrl) || !record(v.announcement) || !str(v.announcement.text) || typeof v.announcement.visible !== 'boolean' || !record(v.openingHours)) return false;
  const hours = v.openingHours;
  return ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].every(day => {
    const h = hours[day];
    return record(h) && typeof h.closed === 'boolean' && typeof h.open === 'string' && typeof h.close === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(h.open) && /^([01]\d|2[0-3]):[0-5]\d$/.test(h.close);
  });
}
