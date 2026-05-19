import { t } from "elysia";
import { apiErrorSchema, isoDateSchema } from "../../shared/http/schemas";

export const roomCodeParamsSchema = t.Object({
  code: t.String({ minLength: 4, maxLength: 24 }),
});

export const createRoomBodySchema = t.Object({
  url: t.String({
    minLength: 1,
    maxLength: 2048,
    examples: ["https://www.youtube.com/watch?v=dQw4w9WgXcQ"],
  }),
  title: t.Optional(t.String({ minLength: 1, maxLength: 180 })),
});

export const roomSchema = t.Object({
  id: t.String({ format: "uuid" }),
  code: t.String(),
  title: t.Nullable(t.String()),
  visibility: t.Union([
    t.Literal("private"),
    t.Literal("unlisted"),
    t.Literal("public"),
  ]),
  status: t.Union([t.Literal("active"), t.Literal("ended")]),
  createdAt: isoDateSchema,
  endedAt: t.Nullable(isoDateSchema),
});

export const roomMediaSourceSchema = t.Object({
  provider: t.Union([
    t.Literal("youtube"),
    t.Literal("vimeo"),
    t.Literal("tiktok"),
    t.Literal("unknown"),
  ]),
  externalId: t.String(),
  canonicalUrl: t.String({ format: "uri" }),
  embedUrl: t.Optional(t.String({ format: "uri" })),
  title: t.Optional(t.String()),
  thumbnailUrl: t.Optional(t.String({ format: "uri" })),
});

export const playbackStateSchema = t.Object({
  status: t.Union([
    t.Literal("playing"),
    t.Literal("paused"),
    t.Literal("buffering"),
    t.Literal("ended"),
  ]),
  positionMs: t.Number({ minimum: 0 }),
  effectivePositionMs: t.Number({ minimum: 0 }),
  playbackRate: t.Number({ minimum: 0.25, maximum: 2 }),
  version: t.Number({ minimum: 0 }),
  updatedAt: isoDateSchema,
  serverTimeMs: t.Number(),
});

export const roomPermissionsSchema = t.Object({
  role: t.Union([t.Literal("owner"), t.Literal("host"), t.Literal("viewer")]),
  canControlPlayback: t.Boolean(),
});

export const createRoomResponseSchema = t.Object({
  room: roomSchema,
  media: roomMediaSourceSchema,
  playback: playbackStateSchema,
});

export const roomSnapshotResponseSchema = t.Object({
  room: roomSchema,
  media: roomMediaSourceSchema,
  playback: playbackStateSchema,
  permissions: roomPermissionsSchema,
});

export const playbackCommandPayloadSchema = t.Object({
  action: t.Union([
    t.Literal("play"),
    t.Literal("pause"),
    t.Literal("seek"),
    t.Literal("set_rate"),
  ]),
  positionMs: t.Optional(t.Number({ minimum: 0 })),
  playbackRate: t.Optional(t.Number({ minimum: 0.25, maximum: 2 })),
});

export const roomsErrorResponses = {
  400: apiErrorSchema,
  401: apiErrorSchema,
  403: apiErrorSchema,
  404: apiErrorSchema,
  409: apiErrorSchema,
  422: apiErrorSchema,
  500: apiErrorSchema,
};
