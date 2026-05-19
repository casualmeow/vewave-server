import { AppError } from "../../../shared/errors/app-error";
import { isTikTokShortLink, tiktokParser } from "./tiktok.parser";
import { youtubeParser } from "./youtube.parser";
import { vimeoParser } from "./vimeo.parser";
import {
  isHttpUrl,
  type ParsedMediaSource,
  type ProviderParser,
} from "./provider-parser";

export const providerParsers: ProviderParser[] = [
  youtubeParser,
  vimeoParser,
  tiktokParser,
];

export const parseProviderUrl = (rawUrl: string): ParsedMediaSource => {
  let url: URL;

  try {
    url = new URL(rawUrl);
  } catch {
    throw new AppError(
      "MEDIA_PARSE_FAILED",
      "The provided URL is malformed.",
      400,
      { url: rawUrl },
    );
  }

  if (!isHttpUrl(url)) {
    throw new AppError(
      "UNSUPPORTED_MEDIA_URL",
      "Only HTTP and HTTPS video URLs are supported.",
      400,
      { url: rawUrl },
    );
  }

  if (isTikTokShortLink(url)) {
    throw new AppError(
      "UNSUPPORTED_MEDIA_URL",
      "TikTok short links must be expanded before creating a room.",
      422,
      { url: rawUrl, reason: "short_link_expansion_deferred" },
    );
  }

  for (const parser of providerParsers) {
    if (!parser.canParse(url)) continue;

    const parsed = parser.parse(url);
    if (parsed) return parsed;

    throw new AppError(
      "MEDIA_PARSE_FAILED",
      "The URL matches a supported provider but could not be parsed.",
      400,
      { url: rawUrl, provider: parser.provider },
    );
  }

  throw new AppError(
    "UNSUPPORTED_MEDIA_URL",
    "This URL provider is not supported.",
    422,
    { url: rawUrl },
  );
};

export type { ParsedMediaSource, MediaProvider } from "./provider-parser";
