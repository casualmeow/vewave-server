import type { AppEnv } from "../../config/env";
import type { UserRecord } from "../../db/schema";
import { hashPassword, verifyPassword } from "../../shared/auth/password";
import {
  hashToken,
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from "../../shared/auth/tokens";
import { AppError } from "../../shared/errors/app-error";
import { getBearerToken, requireBearerToken } from "../../shared/http/auth";
import type { RequestContext } from "../../shared/http/request-context";
import type { AuthRepository } from "./auth.repository";
import type { AuthSessionResult, PublicUser } from "./auth.types";

type RegisterInput = {
  name: string;
  email: string;
  password: string;
};

type LoginInput = {
  email: string;
  password: string;
};

const toPublicUser = (user: UserRecord): PublicUser => ({
  id: user.id,
  name: user.name,
  email: user.email,
});

const normalizeEmail = (email: string) => email.trim().toLowerCase();

export class AuthService {
  constructor(
    private readonly env: AppEnv,
    private readonly repository: AuthRepository,
  ) {}

  async register(
    input: RegisterInput,
    context: RequestContext,
  ): Promise<AuthSessionResult> {
    const email = normalizeEmail(input.email);
    const existing = await this.repository.findUserByEmail(email);

    if (existing) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Email is already registered.",
        409,
      );
    }

    const now = new Date();
    const user = await this.repository.createUser({
      id: crypto.randomUUID(),
      email,
      name: input.name.trim(),
      passwordHash: await hashPassword(input.password),
      createdAt: now,
      updatedAt: now,
    });

    return this.createSession(user, context);
  }

  async login(input: LoginInput, context: RequestContext) {
    const user = await this.repository.findUserByEmail(
      normalizeEmail(input.email),
    );

    if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
      throw new AppError(
        "AUTH_INVALID_CREDENTIALS",
        "Invalid email or password.",
        401,
      );
    }

    return this.createSession(user, context);
  }

  async refresh(refreshToken: string | null, context: RequestContext) {
    if (!refreshToken) {
      throw new AppError(
        "AUTH_REFRESH_EXPIRED",
        "Refresh session is missing or expired.",
        401,
      );
    }

    const verified = await this.verifyRefresh(refreshToken);
    const session = await this.repository.findRefreshSessionById(
      verified.sessionId,
    );
    const tokenHash = await hashToken(refreshToken);
    const now = new Date();

    if (
      !session ||
      session.userId !== verified.userId ||
      session.revokedAt ||
      session.expiresAt <= now ||
      session.tokenHash !== tokenHash
    ) {
      throw new AppError(
        "AUTH_REFRESH_EXPIRED",
        "Refresh session is missing or expired.",
        401,
      );
    }

    const user = await this.repository.findUserById(session.userId);
    if (!user) {
      throw new AppError("AUTH_REFRESH_EXPIRED", "User no longer exists.", 401);
    }

    await this.repository.markRefreshSessionUsed(session.id, now);
    await this.repository.revokeRefreshSession(session.id, now);

    return this.createSession(user, context, session.id);
  }

  async logout(refreshToken: string | null) {
    if (!refreshToken) return;

    try {
      const verified = await this.verifyRefresh(refreshToken);
      await this.repository.revokeRefreshSession(verified.sessionId, new Date());
    } catch {
      return;
    }
  }

  async getUserFromAuthorization(authorizationHeader?: string) {
    const token = requireBearerToken(authorizationHeader);
    return this.getUserFromAccessToken(token);
  }

  async getOptionalUserFromAuthorization(authorizationHeader?: string) {
    const token = getBearerToken(authorizationHeader);
    if (!token) return null;

    try {
      return await this.getUserFromAccessToken(token);
    } catch {
      return null;
    }
  }

  async getUserFromAccessToken(token: string) {
    try {
      const { userId } = await verifyAccessToken(this.env, token);
      const user = await this.repository.findUserById(userId);

      if (!user) {
        throw new AppError("AUTH_UNAUTHORIZED", "Authentication is invalid.", 401);
      }

      return toPublicUser(user);
    } catch (error) {
      if (error instanceof AppError) throw error;

      throw new AppError("AUTH_UNAUTHORIZED", "Authentication is invalid.", 401);
    }
  }

  private async createSession(
    user: UserRecord,
    context: RequestContext,
    rotatedFromSessionId?: string,
  ): Promise<AuthSessionResult> {
    const now = new Date();
    const sessionId = crypto.randomUUID();
    const refreshToken = await signRefreshToken(this.env, {
      userId: user.id,
      sessionId,
    });

    await this.repository.createRefreshSession({
      id: sessionId,
      userId: user.id,
      tokenHash: await hashToken(refreshToken),
      expiresAt: new Date(now.getTime() + this.env.refreshTokenTtlSeconds * 1_000),
      revokedAt: null,
      rotatedFromSessionId: rotatedFromSessionId ?? null,
      userAgent: context.userAgent ?? null,
      ipAddress: context.ipAddress ?? null,
      createdAt: now,
      lastUsedAt: null,
    });

    return {
      user: toPublicUser(user),
      accessToken: await signAccessToken(this.env, user.id),
      refreshToken,
    };
  }

  private async verifyRefresh(refreshToken: string) {
    try {
      return await verifyRefreshToken(this.env, refreshToken);
    } catch {
      throw new AppError(
        "AUTH_REFRESH_EXPIRED",
        "Refresh session is missing or expired.",
        401,
      );
    }
  }
}
