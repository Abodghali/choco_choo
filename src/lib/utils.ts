import { StoreSettings } from './db';

/**
 * Checks if the store is open based on current local time and the stored settings.
 * Supports opening hours that cross midnight (e.g., 16:00 to 02:00).
 */
export function isStoreCurrentlyOpen(settings: StoreSettings): boolean {
  try {
    const pragueTimeStr = new Date().toLocaleString("en-US", {
      timeZone: "Europe/Prague"
    });
    const pragueDate = new Date(pragueTimeStr);
    
    // Get current day name (e.g. "Monday")
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const currentDay = days[pragueDate.getDay()];
    
    const todayHours = settings.openingHours?.[currentDay];
    if (!todayHours || todayHours.closed) return false;
    
    const currentHour = pragueDate.getHours();
    const currentMinute = pragueDate.getMinutes();
    const currentTimeVal = currentHour * 60 + currentMinute; // minutes since midnight
    
    const [openH, openM] = todayHours.open.split(':').map(Number);
    const [closeH, closeM] = todayHours.close.split(':').map(Number);
    
    const openTimeVal = openH * 60 + openM;
    let closeTimeVal = closeH * 60 + closeM;
    
    if (closeTimeVal < openTimeVal) {
      // Crosses midnight, e.g. 16:00 (960m) to 02:00 (120m)
      // Open if: time is >= 16:00 OR time is < 02:00
      return currentTimeVal >= openTimeVal || currentTimeVal < closeTimeVal;
    } else {
      // Normal hours, e.g. 10:00 to 22:00
      return currentTimeVal >= openTimeVal && currentTimeVal < closeTimeVal;
    }
  } catch (e) {
    console.error("Error calculating open status:", e);
    return false; // Fallback to closed
  }
}

/**
 * Formats a CZK price amount.
 */
export function formatPrice(price: number): string {
  return `${price} Kč`;
}
