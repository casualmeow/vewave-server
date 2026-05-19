import { Elysia } from "elysia";
import type { MediaService } from "./media.service";
import {
  mediaErrorResponses,
  parsedMediaSourceSchema,
  parseUrlBodySchema,
} from "./media.schemas";

export const createMediaRoutes = (mediaService: MediaService) =>
  new Elysia({ prefix: "/api/media" }).post(
    "/parse-url",
    ({ body }) => mediaService.parseUrl(body.url),
    {
      body: parseUrlBodySchema,
      detail: {
        tags: ["Media"],
        summary: "Parse external video URL",
        description:
          "Normalizes a supported external video link without creating a room or fetching video bytes.",
      },
      response: {
        200: parsedMediaSourceSchema,
        ...mediaErrorResponses,
      },
    },
  );
