import crypto from 'node:crypto';

export const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

const SESSION_SECRET =
  process.env.SESSION_SECRET || process.env.ANTHROPIC_KEY || 'dev-insecure-secret-change-me';

const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60_000;
const rateLimitMap = new Map();

export function setCors(req, res) {
  const origin = req.headers.origin;
  const allowed = process.env.ALLOWED_ORIGIN;
  if (allowed) {
    res.setHeader('Access-Control-Allow-Origin', allowed);
  } else if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Vary', 'Origin');
}

export function handlePreflight(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return true;
  }
  return false;
}

export function requirePost(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return false;
  }
  return true;
}

export function validateAddress(address) {
  return typeof address === 'string' && ADDRESS_RE.test(address);
}

export function checkRateLimit(req, res) {
  const ip =
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    req.socket?.remoteAddress ||
    'unknown';
  const now = Date.now();
  let entry = rateLimitMap.get(ip);
  if (!entry || now - entry.start > RATE_WINDOW_MS) {
    entry = { start: now, count: 0 };
  }
  entry.count++;
  rateLimitMap.set(ip, entry);
  if (entry.count > RATE_LIMIT) {
    res.status(429).json({ error: 'Too many requests. Try again later.' });
    return false;
  }
  return true;
}

export function signSession(payload) {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('base64url');
  return `${data}.${sig}`;
}

export function verifySession(token) {
  if (!token || typeof token !== 'string') return null;
  const dot = token.indexOf('.');
  if (dot === -1) return null;
  const data = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('base64url');
  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    return JSON.parse(Buffer.from(data, 'base64url').toString());
  } catch {
    return null;
  }
}

export function parseSession(token) {
  return verifySession(token) || { freeUses: 0, clawdVerified: false };
}

export function checkAccess(sessionToken, res) {
  const session = parseSession(sessionToken);
  if (session.freeUses >= 2 && !session.clawdVerified) {
    res.status(403).json({
      error: 'Free traces exhausted. Verify CLAWD holdings to continue.',
      code: 'GATED',
    });
    return null;
  }
  return session;
}

export function nextSession(session) {
  return signSession({
    freeUses: Math.min((session.freeUses || 0) + 1, 99),
    clawdVerified: !!session.clawdVerified,
  });
}

export function clawdSession(session) {
  return signSession({
    freeUses: session?.freeUses || 0,
    clawdVerified: true,
  });
}

export function alchemyUrl() {
  const key = process.env.ALCHEMY_KEY;
  if (!key) throw new Error('ALCHEMY_KEY is not configured');
  return `https://base-mainnet.g.alchemy.com/v2/${key}`;
}

export async function alchemyRpc(body) {
  const response = await fetch(alchemyUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || `Alchemy request failed (${response.status})`);
  }
  if (data.error) {
    throw new Error(data.error.message || 'Alchemy RPC error');
  }
  return data;
}

export function transferKey(t) {
  return `${t.hash || ''}:${t.uniqueId || ''}:${t.blockNum}:${t.from}:${t.to}:${t.asset}`;
}
