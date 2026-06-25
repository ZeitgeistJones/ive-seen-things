export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { address } = req.body;
  if (!address) return res.status(400).json({ error: 'No address provided' });

  const ALCHEMY_KEY = process.env.ALCHEMY_KEY;
  const url = `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'alchemy_getAssetTransfers',
      params: [{
        toAddress: address,
        category: ['erc20', 'external', 'erc721'],
        maxCount: '0x28',
        withMetadata: true,
        order: 'desc'
      }]
    })
  });

  const data = await response.json();
  return res.status(200).json(data);
}
