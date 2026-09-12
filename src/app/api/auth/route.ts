import { NextRequest, NextResponse } from 'next/server';
import { createHash, timingSafeEqual } from 'node:crypto';
import { signToken, getAuthUser, authConfigured } from '@/lib/auth';
import { mutationGuard, readJson, limited } from '@/lib/security';
export async function POST(req: NextRequest) {
  const blocked = mutationGuard(req);
  if (blocked) return blocked;
  if (!authConfigured()) return NextResponse.json({ error: 'Configure ADMIN_PASSWORD (12+ characters) and JWT_SECRET (32+ random characters).' }, { status: 503 });
  if (limited('login', 10, 60000)) return NextResponse.json({ error: 'Try again later' }, { status: 429 });
  try {
    const { username, password } = await readJson(req, 4096);
    if (typeof password !== 'string' || password.length > 1024) return NextResponse.json({ error: 'Invalid credentials' }, { status: 400 });
    const hash = (s: string) => createHash('sha256').update(s).digest();
    if (username !== 'yaman' || !timingSafeEqual(hash(password), hash(process.env.ADMIN_PASSWORD!))) return NextResponse.json({ message: 'Invalid credentials' }, { status: 401 });
    const response = NextResponse.json({ success: true });
    response.cookies.set('admin_token', await signToken({ username: 'yaman' }), { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', maxAge: 28800, path: '/' });
    return response;
  } catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }); }
}
export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  return NextResponse.json(user ? { authenticated: true, username: user.username } : { authenticated: false }, { status: user ? 200 : 401 });
}
export async function DELETE(req: NextRequest) {
  const blocked = mutationGuard(req);
  if (blocked) return blocked;
  const response = NextResponse.json({ success: true });
  response.cookies.set('admin_token', '', { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', expires: new Date(0), path: '/' });
  return response;
}
