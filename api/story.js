import {
  setCors,
  handlePreflight,
  requirePost,
  validateAddress,
  checkRateLimit,
} from './_shared.js';

const MAX_EVENTS = 6;

function buildPrompt(address, topToken, events) {
  const eventSummary = events
    .slice(0, MAX_EVENTS)
    .map(
      (e) =>
        `  ${e.asset} from ${e.fromLabel} → ${e.toLabel}, value: ${e.value}, block: ${e.block}`
    )
    .join('\n');

  return `You are writing a short, dramatic, first-person biography of a crypto token on Base blockchain — told from the token's perspective. The tone should be darkly comedic, world-weary, and vivid. The coin has been through it — gambling, degen trades, MEV bots, shady wallets, bridges, swaps. It has seen things and has feelings about them. Reference real on-chain events from the data below.

Wallet: ${address}
Top token: ${topToken}
Recent transfers:
${eventSummary}

Write 4-6 sentences. First person. No markdown. Gambling and chaos should feature prominently if the data supports it. Make it feel like the coin lived a full, chaotic life before landing here. End with dark humor or quiet resignation. Be specific — name Uniswap, Aerodrome, Base Bridge etc. where relevant.`;
}

function sanitizeEvents(events) {
  if (!Array.isArray(events)) return [];
  return events.slice(0, MAX_EVENTS).map((e) => ({
    asset: String(e.asset || '?').slice(0, 64),
    fromLabel: String(e.fromLabel || '?').slice(0, 128),
    toLabel: String(e.toLabel || '?').slice(0, 128),
    value: String(e.value || '0').slice(0, 32),
    block: String(e.block || '').slice(0, 32),
  }));
}

export default async function handler(req, res) {
  if (handlePreflight(req, res)) return;
  setCors(req, res);

  if (!requirePost(req, res)) return;
  if (!checkRateLimit(req, res)) return;

  const { address, topToken, events, sessionToken } = req.body || {};
  if (!validateAddress(address)) {
    return res.status(400).json({ error: 'Invalid wallet address' });
  }
  if (!topToken || typeof topToken !== 'string') {
    return res.status(400).json({ error: 'Missing top token' });
  }

  const apiKey = process.env.ANTHROPIC_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_KEY is not configured' });
  }

  const safeEvents = sanitizeEvents(events);
  const prompt = buildPrompt(address, topToken.slice(0, 64), safeEvents);

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      const msg = data.error?.message || `Story generation failed (${response.status})`;
      return res.status(response.status >= 500 ? 502 : 400).json({ error: msg });
    }

    const story = data.content?.[0]?.text;
    if (!story) {
      return res.status(502).json({ error: 'Story generation returned empty content' });
    }

    return res.status(200).json({ story });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Story generation failed' });
  }
}
