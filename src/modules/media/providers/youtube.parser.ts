import {
  normalizeHostname,
  type ParsedMediaSource,
  type ProviderParser,
} from "./provider-parser";

const youtubeIdPattern = /^[A-Za-z0-9_-]{11}$/;

const buildYoutubeResult = (externalId: string): ParsedMediaSource | null => {
  if (!youtubeIdPattern.test(externalId)) return null;

  return {
    provider: "youtube",
    externalId,
    canonicalUrl: `https://www.youtube.com/watch?v=${externalId}`,
    embedUrl: `https://www.youtube.com/embed/${externalId}`,
  };
};

export const youtubeParser: ProviderParser = {
  provider: "youtube",

  canParse(url) {
    const host = normalizeHostname(url);
    return host === "youtube.com" || host === "m.youtube.com" || host === "youtu.be";
  },

  parse(url) {
    const host = normalizeHostname(url);
    const pathParts = url.pathname.split("/").filter(Boolean);

    if (host === "youtu.be") {
      return buildYoutubeResult(pathParts[0] ?? "");
    }

    if (pathParts[0] === "watch") {
      return buildYoutubeResult(url.searchParams.get("v") ?? "");
    }

    if (pathParts[0] === "shorts" || pathParts[0] === "embed") {
      return buildYoutubeResult(pathParts[1] ?? "");
    }

    return null;
  },
};
