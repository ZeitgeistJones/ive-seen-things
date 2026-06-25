export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { address } = req.body;
  if (!address) return res.status(400).json({ error: 'No address provided' });

  // CLAWD token contract on Base
  const CLAWD_CONTRACT = '0x9f86dB9fc6f7c9408e8Fda3Ff8ce4e78ac7a6b07';
  const CLAWD_REQUIRED = 10_000_000;

  const ALCHEMY_KEY = process.env.ALCHEMY_KEY;
  const url = `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`;

  try {
    // Call balanceOf(address) on the CLAWD token contract
    // balanceOf selector: 0x70a08231
    const paddedAddress = address.slice(2).padStart(64, '0');
    const data = '0x70a08231' + paddedAddress;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_call',
        params: [
          { to: CLAWD_CONTRACT, data },
          'latest'
        ]
      })
    });

    const json = await response.json();
    const hex = json.result;

    if (!hex || hex === '0x') {
      return res.status(200).json({ verified: false, balance: 0 });
    }

    // CLAWD has 18 decimals
    const rawBalance = BigInt(hex);
    const balance = Number(rawBalance / BigInt(10 ** 18));
    const verified = balance >= CLAWD_REQUIRED;

    return res.status(200).json({ verified, balance });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Verification failed' });
  }
}
