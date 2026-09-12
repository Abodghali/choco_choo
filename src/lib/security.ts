import { NextRequest, NextResponse } from 'next/server';
export function siteOrigin() {
  const url = new URL(process.env.APP_URL || 'http://localhost:3000');
  if (process.env.NODE_ENV === 'production' && (!process.env.APP_URL || url.protocol !== 'https:')) throw new Error('APP_URL must use HTTPS');
  return url.origin;
}
const buckets = new Map<string, { count: number; expires: number }>();
export function limited(key: string, max: number, windowMs = 60000) {
  const now = Date.now();
  for (const [k, v] of buckets) if (v.expires <= now) buckets.delete(k);
  const bucket = buckets.get(key) || { count: 0, expires: now + windowMs };
  bucket.count++;
  buckets.set(key, bucket);
  return bucket.count > max;
}
export function mutationGuard(req: NextRequest) {
  let origin: string;
  try { origin = siteOrigin(); }
  catch { return NextResponse.json({ error: 'Site URL is not configured correctly', code: 'SITE_URL_CONFIGURATION' }, { status: 503 }); }
  if (req.headers.get('origin') !== origin) return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
  if (req.method !== 'DELETE' && !req.headers.get('content-type')?.startsWith('application/json')) return NextResponse.json({ error: 'JSON required' }, { status: 415 });
  return null;
}
export async function readJson(req: NextRequest, limit = 65536) {
  const reader = req.body?.getReader();
  if (!reader) throw new Error('Missing body');
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > limit) { await reader.cancel(); throw new Error('Body too large'); }
    chunks.push(value);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
