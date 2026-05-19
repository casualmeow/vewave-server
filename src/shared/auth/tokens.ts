import { SignJWT, jwtVerify } from "jose";
import type { AppEnv } from "../../config/env";

type AccessTokenPayload = {
  typ: "access";
  sub: string;
};

type RefreshTokenPayload = {
  typ: "refresh";
  sub: string;
  sid: string;
};

const encoder = new TextEncoder();

const getSecretKey = (secret: string) => encoder.encode(secret);

export const signAccessToken = async (env: AppEnv, userId: string) =>
  new SignJWT({ typ: "access" } satisfies Omit<AccessTokenPayload, "sub">)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(env.accessTokenTtl)
    .sign(getSecretKey(env.jwtAccessSecret));

export const signRefreshToken = async (
  env: AppEnv,
  input: { userId: string; sessionId: string },
) =>
  new SignJWT({
    typ: "refresh",
    sid: input.sessionId,
  } satisfies Omit<RefreshTokenPayload, "sub">)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(input.userId)
    .setJti(crypto.randomUUID())
    .setIssuedAt()
    .setExpirationTime(env.refreshTokenTtl)
    .sign(getSecretKey(env.jwtRefreshSecret));

export const verifyAccessToken = async (env: AppEnv, token: string) => {
  const { payload } = await jwtVerify(token, getSecretKey(env.jwtAccessSecret));

  if (payload.typ !== "access" || typeof payload.sub !== "string") {
    throw new Error("Invalid access token");
  }

  return {
    userId: payload.sub,
  };
};

export const verifyRefreshToken = async (env: AppEnv, token: string) => {
  const { payload } = await jwtVerify(token, getSecretKey(env.jwtRefreshSecret));

  if (
    payload.typ !== "refresh" ||
    typeof payload.sub !== "string" ||
    typeof payload.sid !== "string"
  ) {
    throw new Error("Invalid refresh token");
  }

  return {
    userId: payload.sub,
    sessionId: payload.sid,
  };
};

export const hashToken = async (token: string) => {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(token));
  return Buffer.from(digest).toString("base64url");
};
