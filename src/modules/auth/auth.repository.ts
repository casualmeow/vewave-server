import { eq } from "drizzle-orm";
import type { Database } from "../../db/client";
import {
  refreshSessions,
  type NewRefreshSessionRecord,
  type NewUserRecord,
  type RefreshSessionRecord,
  type UserRecord,
  users,
} from "../../db/schema";

export type AuthRepository = {
  createUser(input: NewUserRecord): Promise<UserRecord>;
  findUserByEmail(email: string): Promise<UserRecord | null>;
  findUserById(id: string): Promise<UserRecord | null>;
  createRefreshSession(
    input: NewRefreshSessionRecord,
  ): Promise<RefreshSessionRecord>;
  findRefreshSessionById(id: string): Promise<RefreshSessionRecord | null>;
  revokeRefreshSession(id: string, revokedAt: Date): Promise<void>;
  markRefreshSessionUsed(id: string, lastUsedAt: Date): Promise<void>;
};

export class DrizzleAuthRepository implements AuthRepository {
  constructor(private readonly db: Database) {}

  async createUser(input: NewUserRecord) {
    const [user] = await this.db.insert(users).values(input).returning();
    return user;
  }

  async findUserByEmail(email: string) {
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    return user ?? null;
  }

  async findUserById(id: string) {
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    return user ?? null;
  }

  async createRefreshSession(input: NewRefreshSessionRecord) {
    const [session] = await this.db
      .insert(refreshSessions)
      .values(input)
      .returning();
    return session;
  }

  async findRefreshSessionById(id: string) {
    const [session] = await this.db
      .select()
      .from(refreshSessions)
      .where(eq(refreshSessions.id, id))
      .limit(1);

    return session ?? null;
  }

  async revokeRefreshSession(id: string, revokedAt: Date) {
    await this.db
      .update(refreshSessions)
      .set({ revokedAt, lastUsedAt: revokedAt })
      .where(eq(refreshSessions.id, id));
  }

  async markRefreshSessionUsed(id: string, lastUsedAt: Date) {
    await this.db
      .update(refreshSessions)
      .set({ lastUsedAt })
      .where(eq(refreshSessions.id, id));
  }
}
