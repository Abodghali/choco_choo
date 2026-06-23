import { NextRequest, NextResponse } from 'next/server';
import { getSettings, saveSettings } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

// GET: Fetch store settings
export async function GET() {
  try {
    const settings = await getSettings();
    return NextResponse.json(settings);
  } catch (e) {
    return NextResponse.json({ error: 'Failed to fetch settings data' }, { status: 500 });
  }
}

// POST: Save/Update settings data (Protected)
export async function POST(req: NextRequest) {
  try {
    // Check authentication
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const newSettings = await req.json();
    if (!newSettings || typeof newSettings !== 'object') {
      return NextResponse.json({ error: 'Invalid settings format' }, { status: 400 });
    }

    const success = await saveSettings(newSettings);
    if (success) {
      return NextResponse.json({ success: true, message: 'Settings saved successfully' });
    } else {
      return NextResponse.json({ error: 'Failed to save settings data to disk' }, { status: 500 });
    }
  } catch (e) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
