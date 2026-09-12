import { NextRequest, NextResponse } from 'next/server';
import { getOrders } from '@/lib/db';
import { refreshPayment } from '@/lib/payment';
import { siteOrigin } from '@/lib/security';
export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.has('mock')) return NextResponse.json({ error: 'Simulator disabled' }, { status: 400 });
  const id = req.nextUrl.searchParams.get('id');
  if (!id || req.cookies.get('order_access')?.value !== id || id.length < 40) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const order = (await getOrders()).find(o => o.id === id);
    if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const verified = await refreshPayment(order);
    const url = new URL(req.nextUrl.searchParams.get('ref') === 'qr' ? '/menu-qr' : '/', siteOrigin());
    url.searchParams.set('id', id);
    url.searchParams.set('payment', verified.paymentStatus === 'paid' ? 'success' : verified.paymentStatus === 'failed' ? 'failed' : 'pending');
    return NextResponse.redirect(url);
  } catch { return NextResponse.json({ error: 'Verification unavailable' }, { status: 503 }); }
}
