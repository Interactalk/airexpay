import { MemorySessionStore, type SessionUser } from '@airexpay/config';

export interface AuthIdentity {
  userId: string;
  role: SessionUser['role'];
}

/**
 * Live Supabase Auth is not called. The owner has not approved a hosted project
 * change or a live auth client. Simulation stays inside this process.
 */
export interface AuthProvider {
  signUp(email: string, password: string): Promise<AuthIdentity>;
  signIn(email: string, password: string): Promise<AuthIdentity>;
  requestMagicLink(email: string): Promise<void>;
  consumeMagicLink(token: string): Promise<AuthIdentity | null>;
  exchangeOAuthCode(code: string): Promise<AuthIdentity | null>;
}

async function digest(value: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export class SimulationAuthProvider implements AuthProvider {
  private readonly passwords = new Map<
    string,
    { userId: string; passwordHash: string; role: SessionUser['role'] }
  >();
  private readonly magic = new Map<string, string>();
  readonly issuedMagicTokens: string[] = [];

  async signUp(email: string, password: string): Promise<AuthIdentity> {
    const key = email.trim().toLowerCase();
    if (this.passwords.has(key)) throw new Error('email_taken');
    if (password.length < 8) throw new Error('password_too_short');
    const userId = crypto.randomUUID();
    this.passwords.set(key, { userId, passwordHash: await digest(password), role: 'merchant' });
    return { userId, role: 'merchant' };
  }

  async signIn(email: string, password: string): Promise<AuthIdentity> {
    const row = this.passwords.get(email.trim().toLowerCase());
    if (!row || row.passwordHash !== (await digest(password)))
      throw new Error('invalid_credentials');
    return { userId: row.userId, role: row.role };
  }

  async requestMagicLink(email: string): Promise<void> {
    const key = email.trim().toLowerCase();
    const existing = this.passwords.get(key);
    const userId = existing?.userId ?? crypto.randomUUID();
    if (!existing) this.passwords.set(key, { userId, passwordHash: '', role: 'merchant' });
    const token = crypto.randomUUID();
    this.magic.set(token, userId);
    this.issuedMagicTokens.push(token);
  }

  async consumeMagicLink(token: string): Promise<AuthIdentity | null> {
    const userId = this.magic.get(token);
    if (!userId) return null;
    this.magic.delete(token);
    return { userId, role: 'merchant' };
  }

  async exchangeOAuthCode(code: string): Promise<AuthIdentity | null> {
    if (code !== 'sim_code') return null;
    return { userId: 'user_oauth_simulation', role: 'merchant' };
  }
}

export function createSimulationAuth(): {
  provider: SimulationAuthProvider;
  sessions: MemorySessionStore;
} {
  return { provider: new SimulationAuthProvider(), sessions: new MemorySessionStore() };
}
