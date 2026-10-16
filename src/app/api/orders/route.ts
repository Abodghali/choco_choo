import { buildOrderItems, PREP_MINUTES } from '@/lib/order-options';
import { NextRequest, NextResponse } from 'next/server';
import { getOrders, getOrder, updateOrder, deleteOrders, createNewOrder, getMenu, withOrderLock, type OrderItem } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { mutationGuard, readJson, limited, siteOrigin } from '@/lib/security';
import { refreshPayment } from '@/lib/payment';
export async function GET(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id');
    const admin = await getAuthUser(req);
    if (!admin && (!id || req.cookies.get('order_access')?.value !== id || !id.startsWith('ORD-') || id.length < 40)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (id) {
      const order = await getOrder(id);
      if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return NextResponse.json({ ...await refreshPayment(order), serverNow: Date.now() });
    }
    const orders = await getOrders();
    // Reconcile outstanding payments even if the buyer never returned from SumUp.
    for (const order of orders.filter(o => o.sumupCheckoutId && o.paymentStatus !== 'paid')) await refreshPayment(order);
    return NextResponse.json((await getOrders()).sort((a,b) => b.createdAt.localeCompare(a.createdAt)));
  } catch { return NextResponse.json({ error: 'Unable to load orders' }, { status: 503 }); }
}
export async function POST(req: NextRequest) {
  const blocked = mutationGuard(req);
  if (blocked) return blocked;
  if (limited('orders', 30)) return NextResponse.json({ error: 'Try again later' }, { status: 429 });
  let body;
  try { body = await readJson(req); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const { items, paymentMethod, tableOrName, ref } = body || {};
  if (!Array.isArray(items) || !items.length || items.length > 50 || !['cash','credit','applepay'].includes(paymentMethod) || (tableOrName !== undefined && (typeof tableOrName !== 'string' || tableOrName.length > 100))) return NextResponse.json({ error: 'Invalid order' }, { status: 400 });
  try {
    let orderItems: OrderItem[];
    try { orderItems = buildOrderItems(items, await getMenu()); }
    catch { return NextResponse.json({ error: 'Invalid product, add-on, quantity or note' }, { status: 400 }); }
    const totalPrice = orderItems.reduce((sum,i) => sum + Math.round(i.price * 100) * i.quantity, 0) / 100;
    if (totalPrice > 100000) return NextResponse.json({ error: 'Order too large' }, { status: 400 });
    if (paymentMethod !== 'cash' && (!process.env.SUMUP_API_KEY || !process.env.SUMUP_MERCHANT_CODE)) return NextResponse.json({ error: 'Platba kartou není nakonfigurována. Zvolte hotovost.' }, { status: 503 });
    const order = await withOrderLock(() => createNewOrder({ items: orderItems, totalPrice, paymentMethod, tableOrName: tableOrName?.trim() || 'Pult / Takeaway' }));
    let paymentUrl = '';
    if (paymentMethod !== 'cash') {
      const redirect = new URL('/api/payment-callback', siteOrigin());
      redirect.searchParams.set('id', order.id);
      redirect.searchParams.set('ref', ref === 'qr' ? 'qr' : 'home');
      const response = await fetch('https://api.sumup.com/v0.1/checkouts', {
        method: 'POST', headers: { Authorization: `Bearer ${process.env.SUMUP_API_KEY}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(15000),
        body: JSON.stringify({ amount: totalPrice, currency: 'CZK', checkout_reference: order.id, merchant_code: process.env.SUMUP_MERCHANT_CODE, description: `Choco Choo ${order.customerNumber}`, hosted_checkout: { enabled: true }, redirect_url: redirect.toString() })
      });
      if (!response.ok) throw new Error('Payment provider unavailable');
      const checkout = await response.json();
      const url = new URL(checkout.hosted_checkout_url);
      if (typeof checkout.id !== 'string' || url.origin !== 'https://checkout.sumup.com' || url.username || url.password) throw new Error('Invalid checkout');
      if (!await updateOrder(order.id, { sumupCheckoutId: checkout.id })) throw new Error('Missing order');
      paymentUrl = url.toString();
    }
    const response = NextResponse.json({ success: true, order, paymentUrl });
    response.cookies.set('order_access', order.id, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 86400 });
    return response;
  } catch { return NextResponse.json({ error: 'Objednávku nebo platbu nelze dokončit. Zkuste to později.' }, { status: 502 }); }
}
export async function PUT(req: NextRequest) {
  const blocked = mutationGuard(req); if (blocked) return blocked;
  if (!await getAuthUser(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { orderId, status, prepMinutes } = await readJson(req);
    if ((status === 'preparing' && !PREP_MINUTES.includes(prepMinutes)) || (prepMinutes !== undefined && status !== 'preparing')) return NextResponse.json({ error: 'Choose 10, 15, 20, 25 or 30 minutes' }, { status: 400 });
    if (typeof orderId !== 'string' || !['pending','preparing','completed','cancelled'].includes(status)) return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    const order = await getOrder(orderId);
    if (!order) return NextResponse.json({ error:'Not found' }, { status:404 });
    if (order.paymentMethod !== 'cash' && order.paymentStatus !== 'paid' && ['preparing','completed'].includes(status)) return NextResponse.json({ error:'Payment not verified' }, { status:409 });
    if (!await updateOrder(orderId,{status,...(prepMinutes !== undefined ? {prepMinutes} : {})})) return NextResponse.json({error:'Not found'},{status:404});
    return NextResponse.json({success:true});
  } catch { return NextResponse.json({ error: 'Unable to update order' }, { status: 400 }); }
}
export async function DELETE(req: NextRequest) {
  const blocked = mutationGuard(req); if (blocked) return blocked;
  if (!await getAuthUser(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    await deleteOrders(req.nextUrl.searchParams.get('id') || undefined);
    return NextResponse.json({ success:true });
  } catch { return NextResponse.json({ error: 'Unable to delete orders' }, { status: 503 }); }
}
