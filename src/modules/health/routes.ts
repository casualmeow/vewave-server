import { Elysia, t } from "elysia";

export const healthRoutes = new Elysia({ prefix: "/api" }).get(
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
);
