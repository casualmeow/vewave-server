import { Elysia, t } from "elysia";
import type { RealtimeGateway } from "./realtime.gateway";

export const createRealtimeRoutes = (gateway: RealtimeGateway) =>
  new Elysia().ws("/api/realtime/rooms/:code", {
    params: t.Object({
      code: t.String({ minLength: 4, maxLength: 24 }),
    }),
    query: t.Object({
      accessToken: t.Optional(t.String()),
    }),
    detail: {
      summary: "Room realtime websocket",
      description:
        "WebSocket endpoint for room presence and playback synchronization. See docs/realtime-protocol.md.",
    },
    open: (ws) => gateway.open(ws),
    message: (ws, message) => gateway.message(ws, message),
    close: (ws) => gateway.close(ws),
  });
