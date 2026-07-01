import {
  setCors,
  handlePreflight,
  requirePost,
  validateAddress,
  checkRateLimit,
  checkAccess,
  nextSession,
  alchemyRpc,
  transferKey,
} from './_shared.js';

async function fetchTransfers(address, direction) {
  const param =
    direction === 'out'
      ? { fromAddress: address }
      : { toAddress: address };

  const data = await alchemyRpc({
    jsonrpc: '2.0',
    id: 1,
    method: 'alchemy_getAssetTransfers',
    params: [
      {
        ...param,
        category: ['erc20', 'external', 'erc721'],
        maxCount: '0x28',
        withMetadata: true,
        order: 'desc',
      },
    ],
  });

  return data.result?.transfers || [];
}

export default async function handler(req, res) {
  if (handlePreflight(req, res)) return;
  setCors(req, res);

  if (!requirePost(req, res)) return;
  if (!checkRateLimit(req, res)) return;

  const { address, sessionToken } = req.body || {};
  if (!validateAddress(address)) {
    return res.status(400).json({ error: 'Invalid wallet address' });
  }

  const session = checkAccess(sessionToken, res);
  if (!session) return;

  try {
    const [inbound, outbound] = await Promise.all([
      fetchTransfers(address, 'in'),
      fetchTransfers(address, 'out'),
    ]);

    const seen = new Set();
    const transfers = [];
    for (const t of [...inbound, ...outbound]) {
      const key = transferKey(t);
      if (seen.has(key)) continue;
      seen.add(key);
      transfers.push(t);
    }

    transfers.sort((a, b) => parseInt(b.blockNum, 16) - parseInt(a.blockNum, 16));

    return res.status(200).json({
      result: { transfers },
      sessionToken: nextSession(session),
    });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Failed to fetch transfers' });
  }
}
