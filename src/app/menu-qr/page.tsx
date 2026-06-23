import { getMenu, getSettings } from '@/lib/db';
import QrMenuClient from '@/components/QrMenuClient';

export const revalidate = 0;

export default async function QrMenuPage() {
  const menuData = await getMenu();
  const settingsData = await getSettings();

  return (
    <QrMenuClient 
      initialMenu={menuData} 
      initialSettings={settingsData} 
    />
  );
}
