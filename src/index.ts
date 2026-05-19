import { createApp } from "./app";
import { loadEnv } from "./config/env";
import { logDatabaseReadiness } from "./db/readiness";

const env = loadEnv();
const app = createApp({ env }).listen({
  hostname: env.apiHost,
  port: env.apiPort,
});

console.log(
  `Vewave API is running at http://${app.server?.hostname}:${app.server?.port}`,
);

if (!env.isProduction) {
  void logDatabaseReadiness(env.databaseUrl);
}
