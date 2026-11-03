import { timingSafeEqualString } from './timing.ts';

export const ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000;
export const REFRESH_TOKEN_TTL_MS = 14 * 24 * 60 * 60 * 1000;

export interface SessionUser {
  userId: string;
  role: 'merchant' | 'admin';
}

interface SessionRow {
  sessionId: string;
  userId: string;
  role: SessionUser['role'];
  refreshHash: string;
  refreshExpiresAt: number;
  accessHash: string;
  accessExpiresAt: number;
  revoked: boolean;
  previousRefreshHashes: string[];
}

export interface IssuedSession {
  sessionId: string;
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: string;
  refreshExpiresAt: string;
  role: SessionUser['role'];
  userId: string;
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function randomToken(bytes = 32): string {
  const buffer = new Uint8Array(bytes);
  crypto.getRandomValues(buffer);
  return [...buffer].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Short-lived access tokens rotate with the refresh token.
 * A reused refresh token revokes the session. Only hashes are stored.
 */
export class MemorySessionStore {
  private readonly rows = new Map<string, SessionRow>();

  async issue(user: SessionUser, now = Date.now()): Promise<IssuedSession> {
    const sessionId = randomToken(16);
    const accessToken = randomToken();
    const refreshToken = randomToken();
    const accessExpiresAt = now + ACCESS_TOKEN_TTL_MS;
    const refreshExpiresAt = now + REFRESH_TOKEN_TTL_MS;
    this.rows.set(sessionId, {
      sessionId,
      userId: user.userId,
      role: user.role,
      refreshHash: await sha256(refreshToken),
      refreshExpiresAt,
      accessHash: await sha256(accessToken),
      accessExpiresAt,
      revoked: false,
      previousRefreshHashes: [],
    });
    return {
      sessionId,
      accessToken,
      refreshToken,
      accessExpiresAt: new Date(accessExpiresAt).toISOString(),
      refreshExpiresAt: new Date(refreshExpiresAt).toISOString(),
      role: user.role,
      userId: user.userId,
    };
  }

  async verifyAccess(accessToken: string, now = Date.now()): Promise<SessionUser | null> {
    const hash = await sha256(accessToken);
    for (const row of this.rows.values()) {
      if (row.revoked || row.accessExpiresAt <= now) continue;
      if (timingSafeEqualString(row.accessHash, hash)) {
        return { userId: row.userId, role: row.role };
      }
    }
    return null;
  }

  async verifyRefresh(refreshToken: string, now = Date.now()): Promise<SessionUser | null> {
    const hash = await sha256(refreshToken);
    for (const row of this.rows.values()) {
      if (row.revoked || row.refreshExpiresAt <= now) continue;
      if (timingSafeEqualString(row.refreshHash, hash)) {
        return { userId: row.userId, role: row.role };
      }
    }
    return null;
  }

  async rotate(refreshToken: string, now = Date.now()): Promise<IssuedSession | null> {
    const hash = await sha256(refreshToken);
    const row = [...this.rows.values()].find(
      (candidate) =>
        timingSafeEqualString(candidate.refreshHash, hash) ||
        candidate.previousRefreshHashes.some((previous) => timingSafeEqualString(previous, hash)),
    );
    if (!row) return null;
    const reused = row.previousRefreshHashes.some((previous) =>
      timingSafeEqualString(previous, hash),
    );
    if (row.revoked || reused || row.refreshExpiresAt <= now) {
      row.revoked = true;
      return null;
    }
    const accessToken = randomToken();
    const nextRefresh = randomToken();
    row.previousRefreshHashes.push(row.refreshHash);
    row.refreshHash = await sha256(nextRefresh);
    row.accessHash = await sha256(accessToken);
    row.accessExpiresAt = now + ACCESS_TOKEN_TTL_MS;
    return {
      sessionId: row.sessionId,
      accessToken,
      refreshToken: nextRefresh,
      accessExpiresAt: new Date(row.accessExpiresAt).toISOString(),
      refreshExpiresAt: new Date(row.refreshExpiresAt).toISOString(),
      role: row.role,
      userId: row.userId,
    };
  }

  async revoke(refreshToken: string): Promise<void> {
    const hash = await sha256(refreshToken);
    for (const row of this.rows.values()) {
      if (timingSafeEqualString(row.refreshHash, hash)) row.revoked = true;
    }
  }

  async revokeAll(userId: string): Promise<void> {
    for (const row of this.rows.values()) {
      if (row.userId === userId) row.revoked = true;
    }
  }
}
