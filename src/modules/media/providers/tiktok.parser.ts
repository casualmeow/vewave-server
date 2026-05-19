import {
  normalizeHostname,
  type ParsedMediaSource,
  type ProviderParser,
} from "./provider-parser";

const tiktokIdPattern = /^\d+$/;

export const isTikTokShortLink = (url: URL) => {
  const host = normalizeHostname(url);
  return host === "vm.tiktok.com" || host === "vt.tiktok.com";
};

export const tiktokParser: ProviderParser = {
  provider: "tiktok",

  canParse(url) {
    const host = normalizeHostname(url);
    return host === "tiktok.com";
  },

  parse(url) {
    const pathParts = url.pathname.split("/").filter(Boolean);
    const username = pathParts[0];
    const marker = pathParts[1];
    const externalId = pathParts[2] ?? "";

    if (!username?.startsWith("@") || marker !== "video") return null;
    if (!tiktokIdPattern.test(externalId)) return null;

    return {
      provider: "tiktok",
      externalId,
      canonicalUrl: `https://www.tiktok.com/${username}/video/${externalId}`,
      embedUrl: `https://www.tiktok.com/embed/v2/${externalId}`,
    };
  },
};
