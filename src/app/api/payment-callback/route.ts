import { NextRequest, NextResponse } from 'next/server';
import { getOrders, saveOrders } from '@/lib/db';

// GET: Handle redirect from SumUp payment gateway and verify transaction status
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const orderId = searchParams.get('id');
    const isMock = searchParams.get('mock') === 'true';
    const statusParam = searchParams.get('status');
    const ref = searchParams.get('ref') || 'home';

    if (!orderId) {
      return NextResponse.json({ error: 'Missing order ID parameter' }, { status: 400 });
    }

    const orders = await getOrders();
    const idx = orders.findIndex(o => o.id === orderId);

    if (idx === -1) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const order = orders[idx];
    let finalPaymentStatus: 'paid' | 'failed' | 'unpaid' = 'unpaid';

    if (isMock) {
      // Handle simulated payment callback
      if (statusParam === 'success') {
        finalPaymentStatus = 'paid';
      } else {
        finalPaymentStatus = 'failed';
      }
    } else {
      // Handle real SumUp payment validation
      const apiKey = process.env.SUMUP_API_KEY;
      const checkoutId = order.sumupCheckoutId;

      if (apiKey && checkoutId) {
        try {
          const sumupResponse = await fetch(`https://api.sumup.com/v0.1/checkouts/${checkoutId}`, {
            headers: {
              'Authorization': `Bearer ${apiKey}`
            }
          });

          if (sumupResponse.ok) {
            const sumupData = await sumupResponse.json();
            // SumUp statuses: PENDING, PAID, FAILED
            if (sumupData.status === 'PAID') {
              finalPaymentStatus = 'paid';
            } else if (sumupData.status === 'FAILED') {
              finalPaymentStatus = 'failed';
            }
          } else {
            console.error('SumUp verification responded with error code:', sumupResponse.status);
          }
        } catch (err) {
          console.error('Error during SumUp checkout verification call:', err);
        }
      }
    }

    // Update the database with the verified payment status
    orders[idx] = {
      ...order,
      paymentStatus: finalPaymentStatus
    };
    await saveOrders(orders);

    // Redirect the customer back to the storefront (Home page or QR Menu page)
    const redirectPath = ref === 'qr' ? '/menu-qr' : '/';
    const host = req.headers.get('host') || 'localhost:3000';
    const protocol = req.headers.get('x-forwarded-proto') || 'http';
    
    const redirectUrl = `${protocol}://${host}${redirectPath}?payment=${finalPaymentStatus === 'paid' ? 'success' : 'failed'}&id=${orderId}`;

    return NextResponse.redirect(redirectUrl);
  } catch (e) {
    console.error('Callback error:', e);
    return NextResponse.json({ error: 'Callback verification failed' }, { status: 500 });
  }
}
