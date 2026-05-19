import { t } from "elysia";
import { apiErrorSchema } from "../../shared/http/schemas";

export const parseUrlBodySchema = t.Object({
  url: t.String({
    minLength: 1,
    maxLength: 2048,
    examples: ["https://www.youtube.com/watch?v=dQw4w9WgXcQ"],
  }),
});

export const parsedMediaSourceSchema = t.Object({
  provider: t.Union([
    t.Literal("youtube"),
    t.Literal("vimeo"),
    t.Literal("tiktok"),
  ]),
  externalId: t.String(),
  canonicalUrl: t.String({ format: "uri" }),
  embedUrl: t.Optional(t.String({ format: "uri" })),
});

export const mediaErrorResponses = {
  400: apiErrorSchema,
  422: apiErrorSchema,
  500: apiErrorSchema,
};
