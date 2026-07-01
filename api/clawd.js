import {
  setCors,
  handlePreflight,
  requirePost,
  validateAddress,
  checkRateLimit,
  parseSession,
  clawdSession,
  alchemyRpc,
} from './_shared.js';

const CLAWD_CONTRACT = '0x9f86dB9fc6f7c9408e8Fda3Ff8ce4e78ac7a6b07';
const CLAWD_REQUIRED = 10_000_000;

export default async function handler(req, res) {
  if (handlePreflight(req, res)) return;
  setCors(req, res);

  if (!requirePost(req, res)) return;
  if (!checkRateLimit(req, res)) return;

  const { address, sessionToken } = req.body || {};
  if (!validateAddress(address)) {
    return res.status(400).json({ error: 'Invalid wallet address' });
  }

  try {
    const paddedAddress = address.slice(2).padStart(64, '0');
    const data = '0x70a08231' + paddedAddress;

    const json = await alchemyRpc({
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_call',
      params: [{ to: CLAWD_CONTRACT, data }, 'latest'],
    });

    const hex = json.result;

    if (!hex || hex === '0x') {
      const session = parseSession(sessionToken);
      return res.status(200).json({ verified: false, balance: 0, sessionToken: sessionToken || null });
    }

    const rawBalance = BigInt(hex);
    const balance = Number(rawBalance / BigInt(10 ** 18));
    const verified = balance >= CLAWD_REQUIRED;
    const session = parseSession(sessionToken);

    return res.status(200).json({
      verified,
      balance,
      sessionToken: verified ? clawdSession(session) : sessionToken || null,
    });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Verification failed' });
  }
}
