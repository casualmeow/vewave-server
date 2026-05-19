import { Elysia, t } from "elysia";
import type { AppEnv } from "../../config/env";
import { checkDatabaseReadiness } from "../../db/readiness";

const dbHealthSchema = t.Object({
  status: t.Union([t.Literal("ok"), t.Literal("degraded")]),
  service: t.Literal("vewave-api"),
  database: t.Object({
    ok: t.Boolean(),
    missingTables: t.Array(t.String()),
    error: t.Optional(
      t.Object({
        name: t.String(),
        message: t.String(),
        cause: t.Optional(
          t.Object({
            name: t.String(),
            message: t.String(),
          }),
        ),
      }),
    ),
  }),
});

export const createHealthRoutes = (env: AppEnv) =>
  new Elysia({ prefix: "/api" })
    .get(
      "/health",
      () => ({
        status: "ok",
        service: "vewave-api",
      } as const),
      {
        detail: {
          tags: ["Health"],
          summary: "Health check",
        },
        response: {
          200: t.Object({
            status: t.Literal("ok"),
            service: t.Literal("vewave-api"),
          }),
        },
      },
    )
    .get(
      "/health/db",
      async ({ set }) => {
        const database = await checkDatabaseReadiness(env.databaseUrl);

        if (!database.ok) {
          set.status = 503;
        }

        return {
          status: database.ok ? "ok" : "degraded",
          service: "vewave-api",
          database,
        };
      },
      {
        detail: {
          tags: ["Health"],
          summary: "Database health check",
          description:
            "Reports PostgreSQL connectivity and missing required tables without leaking credentials.",
        },
        response: {
          200: dbHealthSchema,
          503: dbHealthSchema,
        },
      },
    );
