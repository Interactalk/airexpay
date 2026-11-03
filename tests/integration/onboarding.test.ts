import { encryptDocumentBytes, randomDocumentKey } from '@airexpay/payment-core';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../apps/api/src/app.ts';
import { MemoryDatabase } from '../../apps/api/src/db/memory.ts';

const PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x00,
]);

function harness() {
  const db = new MemoryDatabase();
  const documentKey = randomDocumentKey();
  const api = createApp({
    db,
    environment: 'dev',
    allowedModesRaw: 'mock',
    modeAEnv: 'false',
    ipnSecret: 'simulation-ipn-secret',
    checkoutBaseUrl: 'http://localhost:5173',
    documentKey,
    onboardingStore: db,
  });
  return { db, api, documentKey };
}

async function json(response: Response) {
  return (await response.json()) as Record<string, unknown>;
}

describe('onboarding tenancy', () => {
  it('keeps documents inside the owning organization and lets an admin read them', async () => {
    const { api, db, documentKey } = harness();
    const signup = await json(
      await api.request('/v1/onboarding/signup', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'owner-a@example.com', password: 'correct-horse' }),
      }),
    );
    expect(signup.simulation_code).toBe('000000');
    const verified = await json(
      await api.request('/v1/onboarding/verify-email', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'owner-a@example.com', code: '000000' }),
      }),
    );
    const tokenA = String(verified.token);
    const organizationA = String(signup.organization_id);

    const other = await json(
      await api.request('/v1/onboarding/signup', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'owner-b@example.com', password: 'correct-horse' }),
      }),
    );
    const verifiedB = await json(
      await api.request('/v1/onboarding/verify-email', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'owner-b@example.com', code: '000000' }),
      }),
    );
    const tokenB = String(verifiedB.token);

    const uploaded = await json(
      await api.request('/v1/onboarding/documents', {
        method: 'POST',
        headers: { authorization: `Bearer ${tokenA}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          kind: 'passport',
          data_base64: Buffer.from(PNG).toString('base64'),
        }),
      }),
    );
    const documentId = String(uploaded.id);
    const stored = db.onboarding.findDocument(documentId);
    expect(stored?.ciphertext.startsWith('v1.')).toBe(true);
    expect(stored?.ciphertext.includes(Buffer.from(PNG).toString('base64'))).toBe(false);
    const roundTrip = await encryptDocumentBytes(PNG, documentKey);
    expect(roundTrip).not.toBe(stored?.ciphertext);

    const foreign = await api.request(`/v1/onboarding/documents/${documentId}`, {
      headers: { authorization: `Bearer ${tokenB}` },
    });
    expect(foreign.status).toBe(404);

    const own = await api.request(`/v1/onboarding/documents/${documentId}`, {
      headers: { authorization: `Bearer ${tokenA}` },
    });
    expect(own.status).toBe(200);
    expect(new Uint8Array(await own.arrayBuffer())).toEqual(PNG);

    const adminSession = await json(
      await api.request('/api/dev/onboarding/admin-session', { method: 'POST' }),
    );
    const admin = await api.request(`/v1/onboarding/documents/${documentId}`, {
      headers: { authorization: `Bearer ${String(adminSession.token)}` },
    });
    expect(admin.status).toBe(200);
    expect(other.organization_id).not.toBe(organizationA);

    const blocked = await api.request('/v1/onboarding/steps/business', {
      method: 'PATCH',
      headers: { authorization: `Bearer ${tokenA}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        legal_name: 'Blocked Goods',
        country: 'US',
        entity_type: 'llc',
        website: 'https://example.com',
        category: 'gambling',
        expected_monthly_volume: '10.00',
      }),
    });
    expect(blocked.status).toBe(400);

    const production = createApp({
      db: new MemoryDatabase(),
      environment: 'production',
      allowedModesRaw: 'mock',
      livemode: false,
      checkoutBaseUrl: 'http://localhost:5173',
    });
    const hidden = await production.request('/v1/onboarding/signup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'x@example.com', password: 'correct-horse' }),
    });
    expect(hidden.status).toBe(404);
  });
});
