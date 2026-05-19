import type { Cookie } from "elysia";
import type { AppEnv } from "../../config/env";

type CookieJar = Record<string, Cookie<unknown>>;

const refreshCookieOptions = (env: AppEnv) => ({
  httpOnly: true,
  secure: env.cookieSecure,
  sameSite: env.cookieSecure ? ("none" as const) : ("lax" as const),
  path: "/api/auth",
  maxAge: env.refreshTokenTtlSeconds,
  ...(env.cookieDomain ? { domain: env.cookieDomain } : {}),
});

export const setRefreshCookie = (
  cookies: CookieJar,
  env: AppEnv,
  token: string,
) => {
  cookies[env.refreshCookieName]?.set({
    ...refreshCookieOptions(env),
    value: token,
  });
};

export const clearRefreshCookie = (cookies: CookieJar, env: AppEnv) => {
  cookies[env.refreshCookieName]?.set({
    ...refreshCookieOptions(env),
    value: "",
    maxAge: 0,
    expires: new Date(0),
  });
};

export const getRefreshCookie = (cookies: CookieJar, env: AppEnv) => {
  const value = cookies[env.refreshCookieName]?.value;
  return typeof value === "string" && value ? value : null;
};
