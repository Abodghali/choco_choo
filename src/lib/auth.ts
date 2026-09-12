import { SignJWT, jwtVerify } from 'jose';
import { NextRequest } from 'next/server';
export function authConfigured() {
  const secret = process.env.JWT_SECRET || '';
  const password = process.env.ADMIN_PASSWORD || '';
  return secret.length >= 32 && secret !== 'choco-choo-premium-jwt-secret-key-12345' && password.length >= 12 && (process.env.NODE_ENV !== 'production' || password !== 'change-this-password');
}
function key() {
  if (!authConfigured()) throw new Error('Configure ADMIN_PASSWORD and JWT_SECRET');
  return new TextEncoder().encode(process.env.JWT_SECRET!);
}
export async function signToken(payload: { username: string }) {
  return new SignJWT(payload).setProtectedHeader({ alg: 'HS256' }).setIssuer('choco-choo').setAudience('admin').setIssuedAt().setExpirationTime('8h').sign(key());
}
export async function verifyToken(token: string): Promise<{ username: string } | null> {
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ['HS256'], issuer: 'choco-choo', audience: 'admin' });
    return payload.username === 'yaman' ? { username: 'yaman' } : null;
  } catch { return null; }
}
export async function getAuthUser(req: NextRequest) {
  const token = req.cookies.get('admin_token')?.value || req.headers.get('authorization')?.replace(/^Bearer /, '');
  return token ? verifyToken(token) : null;
}
