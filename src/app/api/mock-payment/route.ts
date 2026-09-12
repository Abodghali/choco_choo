import { NextResponse } from 'next/server';
export function GET() {
  return NextResponse.json({ error: 'Payment simulator disabled. Use a SumUp sandbox account.' }, { status: 410 });
}
