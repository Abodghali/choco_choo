import { SignJWT, jwtVerify } from 'jose';
import { NextRequest } from 'next/server';

const DEFAULT_SECRET = 'choco-choo-premium-jwt-secret-key-12345';
const SECRET_KEY = new TextEncoder().encode(
  process.env.JWT_SECRET || DEFAULT_SECRET
);

export async function signToken(payload: { username: string }): Promise<string> {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1d') // Expires in 1 day
    .sign(SECRET_KEY);
}

export async function verifyToken(token: string): Promise<{ username: string } | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET_KEY);
    return payload as { username: string };
  } catch (e) {
    return null;
  }
}

export async function getAuthUser(req: NextRequest): Promise<{ username: string } | null> {
  // Try to read token from HTTP-only cookie 'admin_token'
  let token = req.cookies.get('admin_token')?.value;

  // Fallback to Authorization Header
  if (!token) {
    const authHeader = req.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
  }

  if (!token) return null;
  return await verifyToken(token);
}
