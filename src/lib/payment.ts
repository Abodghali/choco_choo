import { updateOrder, type Order } from './db';
const checked = new Map<string, number>();
export async function refreshPayment(order: Order): Promise<Order> {
  if (!order.sumupCheckoutId || order.paymentStatus === 'paid' || !process.env.SUMUP_API_KEY) return order;
  if (Date.now() - (checked.get(order.id) || 0) < 15000) return order;
  if (checked.size > 10000) checked.clear();
  checked.set(order.id, Date.now());
  try {
    const response = await fetch(`https://api.sumup.com/v0.1/checkouts/${encodeURIComponent(order.sumupCheckoutId)}`, { headers: { Authorization: `Bearer ${process.env.SUMUP_API_KEY}` }, cache: 'no-store', signal: AbortSignal.timeout(10000) });
    if (!response.ok) return order;
    const data = await response.json();
    if (data.id !== order.sumupCheckoutId || data.checkout_reference !== order.id || data.currency !== 'CZK' || data.merchant_code !== process.env.SUMUP_MERCHANT_CODE || typeof data.amount !== 'number' || Math.round(data.amount * 100) !== Math.round(order.totalPrice * 100)) return order;
    if (data.status !== 'PAID' && data.status !== 'FAILED') return order;
    return await updateOrder(order.id, { paymentStatus: data.status === 'PAID' ? 'paid' : 'failed' }) || order;
  } catch { return order; }
}
