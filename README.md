# I've Seen Things

Paste a Base wallet address and get an AI-written biography of its most interesting token, plus a transfer timeline. Blade Runner vibes included.

## Setup

1. Install [Vercel CLI](https://vercel.com/docs/cli): `npm i -g vercel`
2. Copy env template: `cp .env.example .env.local`
3. Fill in API keys (see below)
4. Run locally: `npm run dev`
5. Open `http://localhost:3000`

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ALCHEMY_KEY` | Yes | Alchemy API key for Base mainnet |
| `ANTHROPIC_KEY` | Yes | Anthropic API key for story generation |
| `SESSION_SECRET` | Recommended | HMAC secret for signed session tokens (defaults to `ANTHROPIC_KEY` if unset) |
| `ALLOWED_ORIGIN` | Optional | Lock CORS to a single origin (e.g. `https://your-app.vercel.app`) |

Set these in Vercel project settings for production, or in `.env.local` for local dev.

## Deploy

Push to GitHub and connect the repo in Vercel, or run `vercel` from this directory. Add the env vars in the Vercel dashboard.

## Usage

- **Trace** — enter any Base wallet (`0x` + 40 hex chars) or try a demo address
- **Free tier** — 2 traces per browser session (enforced server-side via signed tokens)
- **CLAWD gate** — after 2 traces, verify 10M+ CLAWD on Base to continue
- **Share** — append `?address=0x...` to the URL to pre-fill a wallet

## API routes

| Route | Body | Description |
|-------|------|-------------|
| `POST /api/trace` | `{ address, sessionToken? }` | Fetch inbound + outbound transfers |
| `POST /api/story` | `{ address, topToken, events, sessionToken? }` | Generate token story (prompt built server-side) |
| `POST /api/clawd` | `{ address, sessionToken? }` | Verify CLAWD balance |

All routes require POST, validate addresses, and apply per-IP rate limiting (30 req/min).

## Tests

```bash
npm test
```

## Architecture

- **Frontend** — single-page `index.html` (HTML/CSS/JS, no build step)
- **Backend** — Vercel serverless functions in `api/`
- **Shared logic** — `api/_shared.js` (CORS, validation, rate limits, session tokens)
