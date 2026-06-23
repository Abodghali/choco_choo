import { NextRequest, NextResponse } from 'next/server';
import { getMenu, saveMenu } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

// GET: Fetch menu data
export async function GET() {
  try {
    const menu = await getMenu();
    return NextResponse.json(menu);
  } catch (e) {
    return NextResponse.json({ error: 'Failed to fetch menu data' }, { status: 500 });
  }
}

// POST: Save/Update menu data (Protected)
export async function POST(req: NextRequest) {
  try {
    // Check authentication
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const newMenu = await req.json();
    if (!Array.isArray(newMenu)) {
      return NextResponse.json({ error: 'Invalid menu format' }, { status: 400 });
    }

    const success = await saveMenu(newMenu);
    if (success) {
      return NextResponse.json({ success: true, message: 'Menu saved successfully' });
    } else {
      return NextResponse.json({ error: 'Failed to save menu data to disk' }, { status: 500 });
    }
  } catch (e) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
