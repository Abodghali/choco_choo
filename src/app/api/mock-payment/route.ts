import { NextRequest, NextResponse } from 'next/server';
import { getOrders } from '@/lib/db';

// GET: Render the mock payment checkout simulator page
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const orderId = searchParams.get('id') || '';
    const ref = searchParams.get('ref') || 'home';

    const orders = await getOrders();
    const order = orders.find(o => o.id === orderId);

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const html = `
      <!DOCTYPE html>
      <html lang="cs">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>SumUp Simulator Platby | Choco Choo</title>
        <style>
          body {
            background-color: #150e0b;
            color: #f6f3f0;
            font-family: system-ui, -apple-system, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            padding: 20px;
            box-sizing: border-box;
          }
          .card {
            background-color: #221612;
            border: 1px solid #38251e;
            border-radius: 12px;
            padding: 30px;
            max-width: 420px;
            width: 100%;
            box-shadow: 0 10px 25px rgba(0,0,0,0.5);
            text-align: center;
          }
          .logo {
            width: 80px;
            height: 80px;
            border-radius: 50%;
            margin-bottom: 15px;
            border: 2px solid #d4a373;
          }
          h1 {
            font-size: 20px;
            margin: 0 0 5px 0;
            color: #d4a373;
          }
          p {
            color: #c2b3aa;
            font-size: 13px;
            margin: 0 0 20px 0;
          }
          .order-info {
            background-color: #2e1e19;
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 25px;
            text-align: left;
            font-size: 13px;
            border-left: 3px solid #d4a373;
          }
          .order-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 8px;
          }
          .order-row:last-child {
            margin-bottom: 0;
            font-weight: bold;
            font-size: 15px;
            color: #d4a373;
            border-top: 1px solid rgba(255,255,255,0.05);
            padding-top: 8px;
          }
          .form-group {
            text-align: left;
            margin-bottom: 15px;
          }
          label {
            display: block;
            font-size: 11px;
            color: #8c7a70;
            text-transform: uppercase;
            margin-bottom: 5px;
            font-weight: bold;
          }
          input {
            width: 100%;
            padding: 10px;
            background-color: #2e1e19;
            border: 1px solid #52372c;
            border-radius: 6px;
            color: white;
            box-sizing: border-box;
            font-size: 14px;
          }
          input::placeholder {
            color: #8c7a70;
          }
          .btn {
            width: 100%;
            padding: 12px;
            border-radius: 6px;
            font-weight: bold;
            font-size: 14px;
            cursor: pointer;
            border: none;
            margin-bottom: 10px;
            transition: background-color 0.2s ease;
          }
          .btn-pay {
            background-color: #d4a373;
            color: #150e0b;
          }
          .btn-pay:hover {
            background-color: #e9c46a;
          }
          .btn-cancel {
            background-color: transparent;
            border: 1px solid #e76f51;
            color: #e76f51;
          }
          .btn-cancel:hover {
            background-color: rgba(231,111,81,0.1);
          }
          .badge {
            background-color: rgba(212,163,115,0.15);
            color: #d4a373;
            padding: 3px 8px;
            border-radius: 12px;
            font-size: 11px;
            font-weight: bold;
            display: inline-block;
            margin-bottom: 20px;
          }
          .apple-pay-btn {
            background-color: white;
            color: black;
            border-radius: 6px;
            font-weight: bold;
            font-size: 15px;
            cursor: pointer;
            border: none;
            margin-bottom: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            width: 100%;
            padding: 12px;
            transition: background-color 0.2s ease;
          }
          .apple-pay-btn:hover {
            background-color: #e5e5e5;
          }
          .apple-pay-sheet {
            background-color: #0b0705;
            border: 1px solid #38251e;
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 25px;
            text-align: left;
            font-size: 13px;
          }
          .apple-pay-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 10px;
            border-bottom: 1px dashed rgba(212,163,115,0.1);
            padding-bottom: 8px;
          }
          .apple-pay-row:last-child {
            border-bottom: none;
            margin-bottom: 0;
            padding-bottom: 0;
          }
        </style>
      </head>
      <body>
        <div class="card">
          <span class="badge">SumUp Online Sandbox</span>
          <h1>SumUp Simulator Platby</h1>
          <p>Tato stránka simuluje platební bránu SumUp pro účely testování.</p>
          
          <div class="order-info">
            <div class="order-row">
              <span>Číslo objednávky:</span>
              <span>#${order.customerNumber}</span>
            </div>
            <div class="order-row">
              <span>Identifikátor:</span>
              <span>${order.id}</span>
            </div>
            <div class="order-row">
              <span>Částka k úhradě:</span>
              <span>${order.totalPrice} Kč</span>
            </div>
          </div>

          <form onsubmit="event.preventDefault();">
            ${order.paymentMethod === 'applepay' ? `
              <div class="apple-pay-sheet">
                <div class="apple-pay-row">
                  <span style="color: #8c7a70;">Metoda</span>
                  <span style="font-weight: bold; display: flex; align-items: center; gap: 4px; color: #f6f3f0;"> Pay (Visa •••• 4242)</span>
                </div>
                <div class="apple-pay-row">
                  <span style="color: #8c7a70;">Kontakt</span>
                  <span style="color: #f6f3f0;">Choco Choo Host</span>
                </div>
                <div class="apple-pay-row">
                  <span style="color: #8c7a70;">Celkem</span>
                  <span style="font-weight: bold; color: #d4a373;">${order.totalPrice} Kč</span>
                </div>
              </div>

              <button class="apple-pay-btn" onclick="window.location.href='/api/payment-callback?id=${orderId}&mock=true&status=success&ref=${ref}'">
                Zaplatit s  Pay
              </button>
              <button class="btn btn-cancel" onclick="window.location.href='/api/payment-callback?id=${orderId}&mock=true&status=failed&ref=${ref}'">
                Zrušit / Cancel ❌
              </button>
            ` : `
              <div class="form-group">
                <label>Číslo karty</label>
                <input type="text" placeholder="4242 4242 4242 4242" value="4242 4242 4242 4242" disabled>
              </div>
              <div style="display: flex; gap: 15px;">
                <div class="form-group" style="flex: 1;">
                  <label>Platnost do</label>
                  <input type="text" placeholder="12/28" value="12/28" disabled>
                </div>
                <div class="form-group" style="flex: 1;">
                  <label>CVC / CVV</label>
                  <input type="text" placeholder="123" value="123" disabled>
                </div>
              </div>

              <button class="btn btn-pay" onclick="window.location.href='/api/payment-callback?id=${orderId}&mock=true&status=success&ref=${ref}'">
                Simulovat úspěšnou platbu 💳
              </button>
              <button class="btn btn-cancel" onclick="window.location.href='/api/payment-callback?id=${orderId}&mock=true&status=failed&ref=${ref}'">
                Simulovat selhání / Zrušit ❌
              </button>
            `}
          </form>
        </div>
      </body>
      </html>
    `;

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8'
      }
    });
  } catch (e) {
    console.error('Mock payment error:', e);
    return NextResponse.json({ error: 'Failed to generate mock payment page' }, { status: 500 });
  }
}
