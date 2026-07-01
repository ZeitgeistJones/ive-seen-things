import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ADDRESS_RE,
  validateAddress,
  signSession,
  verifySession,
  parseSession,
  checkAccess,
  transferKey,
} from '../api/_shared.js';

describe('validateAddress', () => {
  it('accepts valid addresses', () => {
    assert.equal(
      validateAddress('0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'),
      true
    );
  });

  it('rejects invalid addresses', () => {
    assert.equal(validateAddress('0x123'), false);
    assert.equal(validateAddress(''), false);
    assert.equal(validateAddress(null), false);
  });
});

describe('session tokens', () => {
  it('signs and verifies a payload', () => {
    const token = signSession({ freeUses: 1, clawdVerified: false });
    const parsed = verifySession(token);
    assert.equal(parsed.freeUses, 1);
    assert.equal(parsed.clawdVerified, false);
  });

  it('rejects tampered tokens', () => {
    const token = signSession({ freeUses: 0, clawdVerified: false });
    const tampered = token.slice(0, -1) + (token.endsWith('a') ? 'b' : 'a');
    assert.equal(verifySession(tampered), null);
  });

  it('defaults to empty session when token missing', () => {
    const session = parseSession(null);
    assert.equal(session.freeUses, 0);
    assert.equal(session.clawdVerified, false);
  });
});

describe('checkAccess', () => {
  it('allows when under free limit', () => {
    const token = signSession({ freeUses: 1, clawdVerified: false });
    const res = { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(data) { this.body = data; return this; } };
    const session = checkAccess(token, res);
    assert.ok(session);
    assert.equal(res.statusCode, 200);
  });

  it('blocks when free limit exhausted without CLAWD', () => {
    const token = signSession({ freeUses: 2, clawdVerified: false });
    const res = { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(data) { this.body = data; return this; } };
    const session = checkAccess(token, res);
    assert.equal(session, null);
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.code, 'GATED');
  });

  it('allows when CLAWD verified', () => {
    const token = signSession({ freeUses: 5, clawdVerified: true });
    const res = { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(data) { this.body = data; return this; } };
    const session = checkAccess(token, res);
    assert.ok(session);
    assert.equal(session.clawdVerified, true);
  });
});

describe('transferKey', () => {
  it('deduplicates identical transfers', () => {
    const t = {
      hash: '0xabc',
      uniqueId: '1',
      blockNum: '0x100',
      from: '0xa',
      to: '0xb',
      asset: 'ETH',
    };
    assert.equal(transferKey(t), transferKey({ ...t }));
    assert.notEqual(transferKey(t), transferKey({ ...t, hash: '0xdef' }));
  });
});

describe('ADDRESS_RE', () => {
  it('matches standard addresses', () => {
    assert.match('0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045', ADDRESS_RE);
  });
});
