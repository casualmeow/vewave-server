import { cors } from "@elysia/cors";
import { openapi } from "@elysia/openapi";
import { Elysia } from "elysia";
import { loadEnv, type AppEnv } from "./config/env";
import { createAuthRoutes } from "./modules/auth/auth.routes";
import { createHealthRoutes } from "./modules/health/routes";
import { createMediaRoutes } from "./modules/media/media.routes";
import { createRealtimeRoutes } from "./modules/realtime/realtime.routes";
import { createRoomsRoutes } from "./modules/rooms/rooms.routes";
import { openApiTags } from "./openapi/tags";
import { createProductionServices, type AppServices } from "./services";
import { handleHttpError } from "./shared/errors/http";

export type AppDependencies = {
  env: AppEnv;
  services: AppServices;
};

export const createApp = (dependencies?: Partial<AppDependencies>) => {
  const env = dependencies?.env ?? loadEnv();
  const services = dependencies?.services ?? createProductionServices(env);
  const allowedOrigins = new Set(env.clientOrigins);

  return new Elysia()
    .use(
      cors({
        origin: ({ headers }) => {
          const origin = headers.get("origin");
          return origin ? allowedOrigins.has(origin) : false;
        },
        credentials: true,
        allowedHeaders: ["Content-Type", "Authorization"],
        methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
      }),
    )
    .use(
      openapi({
        path: "/openapi",
        documentation: {
          info: {
            title: "Vewave API",
            version: "1.0.0",
            description:
              "Backend API for Vewave watch-together rooms and playback synchronization.",
          },
          tags: [...openApiTags],
          components: {
            securitySchemes: {
              bearerAuth: {
                type: "http",
                scheme: "bearer",
                bearerFormat: "JWT",
              },
            },
          },
        },
      }),
    )
    .onError(handleHttpError)
    .use(createHealthRoutes(env))
    .use(createAuthRoutes(services.auth, env))
    .use(createMediaRoutes(services.media))
    .use(createRoomsRoutes(services.rooms, services.auth))
    .use(createRealtimeRoutes(services.realtime));
};

export type VewaveApp = ReturnType<typeof createApp>;
