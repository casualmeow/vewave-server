export type AppEnv = {
  nodeEnv: string;
  isProduction: boolean;
  apiHost: string;
  apiPort: number;
  clientOrigins: string[];
  databaseUrl: string;
  jwtAccessSecret: string;
  jwtRefreshSecret: string;
  accessTokenTtl: string;
  refreshTokenTtl: string;
  refreshTokenTtlSeconds: number;
  cookieSecure: boolean;
  cookieDomain?: string;
  refreshCookieName: string;
};

type EnvSource = Record<string, string | undefined>;

const devAccessSecret = "dev-access-secret-change-me";
const devRefreshSecret = "dev-refresh-secret-change-me";

export const parseDurationMs = (value: string): number => {
  const match = /^(\d+)(ms|s|m|h|d)?$/.exec(value.trim());

  if (!match) {
    throw new Error(`Invalid duration: ${value}`);
  }

  const amount = Number(match[1]);
  const unit = match[2] ?? "ms";
  const multiplier: Record<string, number> = {
    ms: 1,
    s: 1_000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  };

  return amount * multiplier[unit];
};

const parseBoolean = (value: string | undefined, fallback: boolean) => {
  if (value === undefined || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
};

const parsePort = (value: string | undefined) => {
  const port = Number(value ?? "3001");
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("API_PORT must be a valid TCP port");
  }

  return port;
};

const parseOrigins = (value: string | undefined) =>
  (value ?? "http://localhost:3000,http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

const getSecret = (
  env: EnvSource,
  key: "JWT_ACCESS_SECRET" | "JWT_REFRESH_SECRET",
  fallback: string,
  isProduction: boolean,
) => {
  const value = env[key];

  if (value && value.length >= 32) return value;
  if (!isProduction) return value || fallback;

  throw new Error(`${key} must be set to at least 32 characters in production`);
};

export const loadEnv = (source: EnvSource = Bun.env): AppEnv => {
  const nodeEnv = source.NODE_ENV ?? "development";
  const isProduction = nodeEnv === "production";
  const databaseUrl =
    source.DATABASE_URL ??
    (isProduction
      ? ""
      : "postgres://postgres:postgres@localhost:5432/vewave");

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required in production");
  }

  const refreshTokenTtl = source.REFRESH_TOKEN_TTL ?? "30d";

  return {
    nodeEnv,
    isProduction,
    apiHost: source.API_HOST ?? "0.0.0.0",
    apiPort: parsePort(source.API_PORT),
    clientOrigins: parseOrigins(source.CLIENT_ORIGIN),
    databaseUrl,
    jwtAccessSecret: getSecret(
      source,
      "JWT_ACCESS_SECRET",
      devAccessSecret,
      isProduction,
    ),
    jwtRefreshSecret: getSecret(
      source,
      "JWT_REFRESH_SECRET",
      devRefreshSecret,
      isProduction,
    ),
    accessTokenTtl: source.ACCESS_TOKEN_TTL ?? "15m",
    refreshTokenTtl,
    refreshTokenTtlSeconds: Math.floor(parseDurationMs(refreshTokenTtl) / 1_000),
    cookieSecure: parseBoolean(source.COOKIE_SECURE, isProduction),
    cookieDomain: source.COOKIE_DOMAIN || undefined,
    refreshCookieName: source.REFRESH_COOKIE_NAME ?? "vewave_refresh",
  };
};
