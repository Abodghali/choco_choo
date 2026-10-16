import { PREP_MINUTES } from './order-options';
import { randomUUID } from 'node:crypto';
import fs from 'fs';
import path from 'path';

// Define structures
export interface MenuItem {
  id: string;
  name: string;
  englishName: string;
  description: string;
  englishDescription: string;
  price: number;
  image: string;
  available: boolean;
}

export interface MenuCategory {
  category: string;
  items: MenuItem[];
}

export interface OpeningHours {
  open: string;
  close: string;
  closed: boolean;
}

export interface StoreSettings {
  address: string;
  phone: string;
  instagramUrl: string;
  email: string;
  openingHours: Record<string, OpeningHours>;
  heroTitle: string;
  heroSubtitle: string;
  announcement: {
    text: string;
    visible: boolean;
  };
}

const MENU_FILE_PATH = path.join(process.cwd(), 'src/data/menu.json');
const SETTINGS_FILE_PATH = path.join(process.cwd(), 'src/data/settings.json');

// Helper to get Supabase client dynamically if configured
let supabaseClient: import('@supabase/supabase-js').SupabaseClient | null = null;

async function getSupabaseClient() {
  if (supabaseClient) return supabaseClient;
  
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!!supabaseUrl !== !!supabaseKey) throw new Error('Configure both Supabase URL and server key');
  if (process.env.VERCEL && !supabaseUrl) throw new Error('Supabase is required on Vercel');

  if (supabaseUrl && supabaseKey) {
    try {
      // Dynamically import @supabase/supabase-js to avoid crash if not installed
      const { createClient } = await import('@supabase/supabase-js');
      supabaseClient = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false, autoRefreshToken: false } });
      return supabaseClient;
    } catch (e) {
      throw new Error("Unable to initialize configured storage", { cause: e });
    }
  }
  return null;
}

// -------------------------------------------------------------
// Core Database APIs
// -------------------------------------------------------------

export async function getMenu(): Promise<MenuCategory[]> {
  const client = await getSupabaseClient();
  if (!client) return getLocalMenu();
  const { data, error } = await client.from('choco_store').select('value').eq('key','menu').maybeSingle();
  if (error) throw new Error('Unable to load menu', { cause: error });
  if (data) return data.value as MenuCategory[];
  const initial = await getLocalMenu();
  const seeded = await client.from('choco_store').upsert({ key:'menu', value:initial }, { onConflict:'key', ignoreDuplicates:true });
  if (seeded.error) throw new Error('Unable to initialize menu', { cause: seeded.error });
  const saved = await client.from('choco_store').select('value').eq('key','menu').single();
  if (saved.error) throw new Error('Unable to load menu', { cause: saved.error });
  return saved.data.value as MenuCategory[];
}
export async function saveMenu(value: MenuCategory[]): Promise<boolean> {
  const client = await getSupabaseClient();
  if (!client) return saveLocalMenu(value);
  const { error } = await client.from('choco_store').upsert({ key:'menu', value });
  if (error) throw new Error('Unable to save menu', { cause: error });
  return true;
}

export async function getSettings(): Promise<StoreSettings> {
  const client = await getSupabaseClient();
  if (!client) return getLocalSettings();
  const { data, error } = await client.from('choco_store').select('value').eq('key','settings').maybeSingle();
  if (error) throw new Error('Unable to load settings', { cause: error });
  if (data) return data.value as StoreSettings;
  const initial = await getLocalSettings();
  const seeded = await client.from('choco_store').upsert({ key:'settings', value:initial }, { onConflict:'key', ignoreDuplicates:true });
  if (seeded.error) throw new Error('Unable to initialize settings', { cause: seeded.error });
  const saved = await client.from('choco_store').select('value').eq('key','settings').single();
  if (saved.error) throw new Error('Unable to load settings', { cause: saved.error });
  return saved.data.value as StoreSettings;
}
export async function saveSettings(value: StoreSettings): Promise<boolean> {
  const client = await getSupabaseClient();
  if (!client) return saveLocalSettings(value);
  const { error } = await client.from('choco_store').upsert({ key:'settings', value });
  if (error) throw new Error('Unable to save settings', { cause: error });
  return true;
}

// -------------------------------------------------------------
// Local JSON File Fallbacks
// -------------------------------------------------------------

async function getLocalMenu(): Promise<MenuCategory[]> {
  try {
    if (fs.existsSync(MENU_FILE_PATH)) {
      const content = fs.readFileSync(MENU_FILE_PATH, 'utf8');
      return JSON.parse(content);
    }
  } catch (e) {
    console.error("Error reading local menu file:", e);
  }
  return [];
}

async function saveLocalMenu(menu: MenuCategory[]): Promise<boolean> {
  try {
    fs.mkdirSync(path.dirname(MENU_FILE_PATH), { recursive: true });
    fs.writeFileSync(MENU_FILE_PATH, JSON.stringify(menu, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error("Error writing local menu file:", e);
    return false;
  }
}

async function getLocalSettings(): Promise<StoreSettings> {
  try {
    if (fs.existsSync(SETTINGS_FILE_PATH)) {
      const content = fs.readFileSync(SETTINGS_FILE_PATH, 'utf8');
      return JSON.parse(content);
    }
  } catch (e) {
    console.error("Error reading local settings file:", e);
  }
  // Default fallback if file is somehow missing
  return {
    address: "Hartigova 77, 130 00 Praha 3-Žižkov",
    phone: "+420 222 000 000",
    instagramUrl: "https://instagram.com/chocochoo.prague",
    email: "praha@chocochoo.com",
    openingHours: {},
    heroTitle: "Vítejte v Choco Choo",
    heroSubtitle: "Ručně dělané palačinky, vafle, crofle a další — z prémiové belgické čokolády.",
    announcement: { text: "Právě jsme otevřeli!", visible: true }
  };
}

async function saveLocalSettings(settings: StoreSettings): Promise<boolean> {
  try {
    fs.mkdirSync(path.dirname(SETTINGS_FILE_PATH), { recursive: true });
    fs.writeFileSync(SETTINGS_FILE_PATH, JSON.stringify(settings, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error("Error writing local settings file:", e);
    return false;
  }
}

// -------------------------------------------------------------
// Orders Management System
// -------------------------------------------------------------

export interface OrderItem {
  addOns?: { id: string; name: string; price: number }[];
  note?: string;
  id: string;
  name: string;
  price: number;
  quantity: number;
}

export interface Order {
  prepMinutes?: number;
  acceptedAt?: string;
  readyAt?: string;
  id: string;             // Seller Order ID (e.g. ORD-20260711-0001)
  customerNumber: number; // Customer Order Number (e.g. 1, 2, 3...)
  items: OrderItem[];
  totalPrice: number;
  paymentMethod: 'cash' | 'credit' | 'applepay';
  status: 'pending' | 'preparing' | 'completed' | 'cancelled';
  createdAt: string;      // ISO Date string
  tableOrName?: string;   // Table number or customer name
  paymentStatus?: 'unpaid' | 'paid' | 'failed';
  sumupCheckoutId?: string;
}

const ORDERS_FILE_PATH = path.join(process.cwd(), 'src/data/orders.json');

export async function getOrders(): Promise<Order[]> {
  const client = await getSupabaseClient();
  if (!client) return getLocalOrders();
  const result: Order[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await client.from('choco_orders').select('value').order('id').range(offset,offset+499);
    if (error) throw new Error('Unable to load orders', { cause:error });
    result.push(...data.map(row => row.value as Order));
    if (data.length < 500) return result;
  }
}
export async function getOrder(id: string): Promise<Order | undefined> {
  const client = await getSupabaseClient();
  if (!client) return (await getLocalOrders()).find(o => o.id === id);
  const { data, error } = await client.from('choco_orders').select('value').eq('id',id).maybeSingle();
  if (error) throw new Error('Unable to load order', { cause:error });
  return data?.value as Order | undefined;
}
export async function saveOrders(orders: Order[]): Promise<boolean> {
  if (await getSupabaseClient()) throw new Error('Bulk replacement of remote orders is disabled');
  return saveLocalOrders(orders);
}
export async function updateOrder(id: string, patch: Partial<Pick<Order,'status'|'paymentStatus'|'sumupCheckoutId'|'prepMinutes'>>): Promise<Order | undefined> {
  const client = await getSupabaseClient();
  if (client) {
    const { data,error } = await client.rpc('choco_update_order',{ p_id:id, p_patch:patch });
    if (error) throw new Error('Unable to update order', { cause:error });
    return data || undefined;
  }
  return withOrderLock(async () => {
    const orders = await getLocalOrders(); const order = orders.find(o => o.id === id);
    if (!order) return undefined;
    const updates: Partial<Order> = { ...patch };
    if (patch.prepMinutes !== undefined) {
      if (patch.status !== 'preparing' || !PREP_MINUTES.includes(patch.prepMinutes) || !['pending','preparing'].includes(order.status)) throw new Error('Invalid preparation time');
      updates.acceptedAt = order.acceptedAt || new Date().toISOString();
      updates.readyAt = new Date(Date.now() + patch.prepMinutes * 60000).toISOString();
    }
    if (patch.status === 'preparing' && !order.readyAt && patch.prepMinutes === undefined) throw new Error('Choose preparation time');
    if (order.paymentStatus === 'paid') delete updates.paymentStatus;
    if (order.sumupCheckoutId && updates.sumupCheckoutId && order.sumupCheckoutId !== updates.sumupCheckoutId) throw new Error('Checkout already attached');
    const merged = { ...order, ...updates };
    if (merged.paymentMethod !== 'cash' && merged.paymentStatus !== 'paid' && ['preparing','completed'].includes(merged.status)) throw new Error('Payment not verified');
    Object.assign(order, merged);
    if (!await saveLocalOrders(orders)) throw new Error('Save failed');
    return order;
  });
}
export async function deleteOrders(id?: string): Promise<void> {
  const client = await getSupabaseClient();
  if (client) {
    const query = client.from('choco_orders').delete();
    const { error } = await (id ? query.eq('id',id) : query.not('id','is',null));
    if (error) throw new Error('Unable to delete orders', { cause:error });
    return;
  }
  await withOrderLock(async () => {
    const orders = await getLocalOrders();
    if (!await saveLocalOrders(id ? orders.filter(o => o.id !== id) : [])) throw new Error('Delete failed');
  });
}

async function getLocalOrders(): Promise<Order[]> {
  try {
    if (fs.existsSync(ORDERS_FILE_PATH)) {
      const content = fs.readFileSync(ORDERS_FILE_PATH, 'utf8');
      return JSON.parse(content);
    }
  } catch (e) {
    throw new Error("Unable to read orders", { cause: e });
  }
  return [];
}

async function saveLocalOrders(orders: Order[]): Promise<boolean> {
  try {
    fs.mkdirSync(path.dirname(ORDERS_FILE_PATH), { recursive: true });
    const temp = `${ORDERS_FILE_PATH}.${randomUUID()}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(orders, null, 2), { encoding: 'utf8', mode: 0o600 });
    fs.renameSync(temp, ORDERS_FILE_PATH);
    return true;
  } catch (e) {
    console.error("Error writing local orders file:", e);
    return false;
  }
}

export async function createNewOrder(orderData: Omit<Order, 'id' | 'customerNumber' | 'createdAt' | 'status'>): Promise<Order> {
  const client = await getSupabaseClient();
  if (client) {
    const { data, error } = await client.rpc('choco_create_order', { p_order: orderData });
    if (error) throw new Error('Unable to create order', { cause: error });
    return data as Order;
  }
  const orders = await getOrders();
  
  // Get current date in Europe/Prague timezone for resetting customer number daily
  const pragueDateStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Prague' }); // 'YYYY-MM-DD'
  
  // Filter today's orders
  const todaysOrders = orders.filter(o => {
    try {
      const orderDate = new Date(o.createdAt).toLocaleDateString('en-CA', { timeZone: 'Europe/Prague' });
      return orderDate === pragueDateStr;
    } catch (err) {
      return false;
    }
  });
  
  // Next customer sequence number
  const nextCustomerNumber = todaysOrders.length > 0 
    ? Math.max(...todaysOrders.map(o => o.customerNumber)) + 1 
    : 1;
    
  // Format seller order ID: ORD-YYYYMMDD-XXXX where XXXX is padded customer number
  const yyyymmdd = pragueDateStr.replace(/-/g, '');
  const paddedSeq = String(nextCustomerNumber).padStart(4, '0');
  const nextOrderId = `ORD-${yyyymmdd}-${paddedSeq}-${randomUUID()}`;
  
  const newOrder: Order = {
    ...orderData,
    id: nextOrderId,
    customerNumber: nextCustomerNumber,
    createdAt: new Date().toISOString(),
    status: 'pending',
    paymentStatus: 'unpaid'
  };
  
  orders.push(newOrder);
  if (!await saveOrders(orders)) throw new Error('Failed to persist order');
  return newOrder;
}

// Filesystem lock serializes read/modify/write across local Next.js workers.
// Remote multi-instance hosting requires transactional order rows instead.
export async function withOrderLock<T>(work: () => Promise<T>): Promise<T> {
  if (await getSupabaseClient()) return work(); // Remote mutations are atomic SQL operations.
  await fs.promises.mkdir(path.dirname(ORDERS_FILE_PATH), { recursive: true });
  const lockPath = ORDERS_FILE_PATH + '.lock';
  const deadline = Date.now() + 10000;
  let handle;
  while (!handle) {
    try { handle = await fs.promises.open(lockPath, 'wx'); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST' || Date.now() > deadline) throw error;
      await new Promise(resolve => setTimeout(resolve, 25));
    }
  }
  try { return await work(); }
  finally { await handle.close(); await fs.promises.unlink(lockPath); }
}
