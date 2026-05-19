import {
  normalizeHostname,
  type ParsedMediaSource,
  type ProviderParser,
} from "./provider-parser";

const vimeoIdPattern = /^\d+$/;

const buildVimeoResult = (externalId: string): ParsedMediaSource | null => {
  if (!vimeoIdPattern.test(externalId)) return null;

  return {
    provider: "vimeo",
    externalId,
    canonicalUrl: `https://vimeo.com/${externalId}`,
    embedUrl: `https://player.vimeo.com/video/${externalId}`,
  };
};

export const vimeoParser: ProviderParser = {
  provider: "vimeo",

  canParse(url) {
    const host = normalizeHostname(url);
    return host === "vimeo.com" || host === "player.vimeo.com";
  },

  parse(url) {
    const host = normalizeHostname(url);
    const pathParts = url.pathname.split("/").filter(Boolean);

    if (host === "player.vimeo.com" && pathParts[0] === "video") {
      return buildVimeoResult(pathParts[1] ?? "");
    }

    if (host === "vimeo.com") {
      return buildVimeoResult(pathParts[0] ?? "");
    }

    return null;
  },
};
