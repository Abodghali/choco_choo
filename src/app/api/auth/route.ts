import { NextRequest, NextResponse } from 'next/server';
import { signToken, getAuthUser } from '@/lib/auth';

// SHA-256 helper for password hashing
async function sha256(text: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// POST: Login
export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();

    let isValid = false;

    if (username === 'admin') {
      const adminPassword = process.env.ADMIN_PASSWORD || 'change-this-password';
      isValid = password === adminPassword;
    } else if (username === 'yaman') {
      const targetHash = 'a968f88813904746746dae3a20a96c347b4da683b7bb71eb29eed9bcb799e407';
      const inputHash = await sha256(password);
      isValid = inputHash === targetHash;
    }

    if (isValid) {
      const token = await signToken({ username });
      
      const response = NextResponse.json({ success: true, message: 'Logged in successfully' });
      
      // Set token as secure, HTTP-only cookie
      response.cookies.set('admin_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 60 * 60 * 24, // 1 day in seconds
        path: '/'
      });

      return response;
    }

    return NextResponse.json({ success: false, message: 'Nesprávné uživatelské jméno nebo heslo' }, { status: 401 });
  } catch (e) {
    return NextResponse.json({ success: false, message: 'Server error during login' }, { status: 500 });
  }
}

// GET: Check Auth Status
export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (user) {
    return NextResponse.json({ authenticated: true, username: user.username });
  }
  return NextResponse.json({ authenticated: false }, { status: 401 });
}

// DELETE: Logout
export async function DELETE() {
  const response = NextResponse.json({ success: true, message: 'Logged out successfully' });
  
  // Clear cookie
  response.cookies.set('admin_token', '', {
    httpOnly: true,
    expires: new Date(0),
    path: '/'
  });

  return response;
}
