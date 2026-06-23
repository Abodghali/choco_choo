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
let supabaseClient: any = null;

async function getSupabaseClient() {
  if (supabaseClient) return supabaseClient;
  
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (supabaseUrl && supabaseKey) {
    try {
      // Dynamically import @supabase/supabase-js to avoid crash if not installed
      const { createClient } = await import('@supabase/supabase-js');
      supabaseClient = createClient(supabaseUrl, supabaseKey);
      return supabaseClient;
    } catch (e) {
      console.error("Failed to load Supabase SDK, falling back to JSON storage:", e);
      return null;
    }
  }
  return null;
}

// -------------------------------------------------------------
// Core Database APIs
// -------------------------------------------------------------

export async function getMenu(): Promise<MenuCategory[]> {
  const supabase = await getSupabaseClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('choco_store')
        .select('value')
        .eq('key', 'menu')
        .single();
      
      if (data && data.value) {
        return data.value as MenuCategory[];
      }
      
      // If table exists but row doesn't, seed it from local file
      if (error && error.code === 'PGRST116') {
        const localMenu = await getLocalMenu();
        await saveMenu(localMenu);
        return localMenu;
      }
      console.warn("Supabase select error, using local fallback:", error);
    } catch (e) {
      console.error("Supabase connection failed, using local fallback:", e);
    }
  }
  return getLocalMenu();
}

export async function saveMenu(menu: MenuCategory[]): Promise<boolean> {
  const supabase = await getSupabaseClient();
  if (supabase) {
    try {
      const { error } = await supabase
        .from('choco_store')
        .upsert({ key: 'menu', value: menu });
      
      if (!error) return true;
      console.error("Failed to save menu to Supabase:", error);
    } catch (e) {
      console.error("Supabase upsert failed:", e);
    }
  }
  return saveLocalMenu(menu);
}

export async function getSettings(): Promise<StoreSettings> {
  const supabase = await getSupabaseClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('choco_store')
        .select('value')
        .eq('key', 'settings')
        .single();
      
      if (data && data.value) {
        return data.value as StoreSettings;
      }
      
      // Seed if empty in database
      if (error && error.code === 'PGRST116') {
        const localSettings = await getLocalSettings();
        await saveSettings(localSettings);
        return localSettings;
      }
      console.warn("Supabase settings error, using local fallback:", error);
    } catch (e) {
      console.error("Supabase settings connection failed:", e);
    }
  }
  return getLocalSettings();
}

export async function saveSettings(settings: StoreSettings): Promise<boolean> {
  const supabase = await getSupabaseClient();
  if (supabase) {
    try {
      const { error } = await supabase
        .from('choco_store')
        .upsert({ key: 'settings', value: settings });
      
      if (!error) return true;
      console.error("Failed to save settings to Supabase:", error);
    } catch (e) {
      console.error("Supabase settings upsert failed:", e);
    }
  }
  return saveLocalSettings(settings);
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
