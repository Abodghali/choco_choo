import { getMenu, getSettings } from '@/lib/db';
import HomeClient from '@/components/HomeClient';

// Ensure the page is dynamic to fetch the latest settings and menu items from the admin updates
export const revalidate = 0;

export default async function HomePage() {
  const menuData = await getMenu();
  const settingsData = await getSettings();

  return (
    <HomeClient 
      initialMenu={menuData} 
      initialSettings={settingsData} 
    />
  );
}
