export type MediaProvider = "youtube" | "vimeo" | "tiktok";

export type ParsedMediaSource = {
  provider: MediaProvider;
  externalId: string;
  canonicalUrl: string;
  embedUrl?: string;
};

export type ProviderParser = {
  provider: MediaProvider;
  canParse(url: URL): boolean;
  parse(url: URL): ParsedMediaSource | null;
};

export const normalizeHostname = (url: URL) =>
  url.hostname.toLowerCase().replace(/^www\./, "");

export const isHttpUrl = (url: URL) =>
  url.protocol === "http:" || url.protocol === "https:";
