import { NextRequest, NextResponse } from 'next/server';
import { getOrders, saveOrders, createNewOrder, Order } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

// GET: Fetch all orders (Protected - Admin only)
// Returns orders sorted by createdAt descending (newest first)
export async function GET(req: NextRequest) {
  try {
    const orderId = req.nextUrl.searchParams.get('id');

    if (orderId) {
      // Anyone can fetch their own order by ID to see confirmation/status
      const orders = await getOrders();
      const order = orders.find(o => o.id === orderId);
      if (order) {
        return NextResponse.json(order);
      }
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // List all orders (Admin only)
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const orders = await getOrders();
    // Sort descending by creation date
    const sortedOrders = [...orders].sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return NextResponse.json(sortedOrders);
  } catch (e) {
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
  }
}

// POST: Place a new order (Public)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { items, paymentMethod, tableOrName } = body;

    // Validation
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Invalid items format or empty cart' }, { status: 400 });
    }

    if (paymentMethod !== 'cash' && paymentMethod !== 'credit' && paymentMethod !== 'applepay') {
      return NextResponse.json({ error: 'Invalid payment method' }, { status: 400 });
    }

    // Format items to save
    const orderItems = items.map((i: any) => ({
      id: i.item?.id || i.id,
      name: i.item?.name || i.name,
      price: Number(i.item?.price || i.price),
      quantity: Number(i.quantity)
    }));

    // Calculate total
    const totalPrice = orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    // Save using database sequence creator
    const newOrder = await createNewOrder({
      items: orderItems,
      totalPrice,
      paymentMethod,
      tableOrName: tableOrName?.trim() || 'Pult / Takeaway'
    });

    let paymentUrl = '';

    if (paymentMethod === 'credit' || paymentMethod === 'applepay') {
      const apiKey = process.env.SUMUP_API_KEY;
      const merchantCode = process.env.SUMUP_MERCHANT_CODE;

      if (apiKey && merchantCode) {
        try {
          const host = req.headers.get('host') || 'localhost:3000';
          const protocol = req.headers.get('x-forwarded-proto') || 'http';
          const baseUrl = `${protocol}://${host}`;
          const redirectUrl = `${baseUrl}/api/payment-callback?id=${newOrder.id}`;

          const sumupResponse = await fetch('https://api.sumup.com/v0.1/checkouts', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              amount: totalPrice,
              currency: 'CZK',
              checkout_reference: newOrder.id,
              merchant_code: merchantCode,
              description: `Objednávka č. ${newOrder.customerNumber} v Choco Choo`,
              hosted_checkout: {
                enabled: true
              },
              redirect_url: redirectUrl
            })
          });

          const sumupData = await sumupResponse.json();

          if (sumupResponse.ok && sumupData.id && sumupData.hosted_checkout_url) {
            // Update order with checkout id
            const orders = await getOrders();
            const idx = orders.findIndex(o => o.id === newOrder.id);
            if (idx !== -1) {
              orders[idx].sumupCheckoutId = sumupData.id;
              await saveOrders(orders);
            }
            paymentUrl = sumupData.hosted_checkout_url;
          } else {
            console.error('SumUp API error:', sumupData);
            // Fallback to mock payment since SumUp API failed (e.g. invalid key or parameters)
            paymentUrl = `/api/mock-payment?id=${newOrder.id}`;
          }
        } catch (err) {
          console.error('Failed to connect to SumUp:', err);
          // Fallback to mock payment on connection error
          paymentUrl = `/api/mock-payment?id=${newOrder.id}`;
        }
      } else {
        // Fallback to mock payment if credentials are not configured
        paymentUrl = `/api/mock-payment?id=${newOrder.id}`;
      }
    }

    return NextResponse.json({ success: true, order: newOrder, paymentUrl });
  } catch (e) {
    console.error('Error placing order:', e);
    return NextResponse.json({ error: 'Failed to place order' }, { status: 500 });
  }
}

// PUT: Update order status (Protected - Admin only)
export async function PUT(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orderId, status } = await req.json();
    const validStatuses = ['pending', 'preparing', 'completed', 'cancelled'];

    if (!orderId || !validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid order ID or status' }, { status: 400 });
    }

    const orders = await getOrders();
    const orderIndex = orders.findIndex(o => o.id === orderId);

    if (orderIndex === -1) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    orders[orderIndex] = {
      ...orders[orderIndex],
      status: status as any
    };

    const success = await saveOrders(orders);
    if (success) {
      return NextResponse.json({ success: true, message: 'Order status updated successfully' });
    } else {
      return NextResponse.json({ error: 'Failed to save order update' }, { status: 500 });
    }
  } catch (e) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// DELETE: Delete single order or clear all orders (Protected - Admin only)
export async function DELETE(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const orderId = req.nextUrl.searchParams.get('id');
    const orders = await getOrders();

    if (orderId) {
      // Delete specific order
      const updatedOrders = orders.filter(o => o.id !== orderId);
      const success = await saveOrders(updatedOrders);
      if (success) {
        return NextResponse.json({ success: true, message: `Order ${orderId} deleted` });
      }
    } else {
      // Clear all orders
      const success = await saveOrders([]);
      if (success) {
        return NextResponse.json({ success: true, message: 'All orders cleared' });
      }
    }

    return NextResponse.json({ error: 'Failed to complete delete operation' }, { status: 500 });
  } catch (e) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
