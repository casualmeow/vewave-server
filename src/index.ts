import { createApp } from "./app";
import { loadEnv } from "./config/env";

const env = loadEnv();
const app = createApp({ env }).listen({
  hostname: env.apiHost,
  port: env.apiPort,
});

console.log(
  `Vewave API is running at http://${app.server?.hostname}:${app.server?.port}`,
);
