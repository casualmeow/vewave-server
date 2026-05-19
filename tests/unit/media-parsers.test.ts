import { describe, expect, test } from "bun:test";
import { AppError } from "../../src/shared/errors/app-error";
import { parseProviderUrl } from "../../src/modules/media/providers";
import type { ApiErrorCode } from "../../src/shared/errors/app-error";
import type { MediaProvider } from "../../src/modules/media/providers";

describe("provider URL parsing", () => {
  const successCases = [
    {
      url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      provider: "youtube",
      externalId: "dQw4w9WgXcQ",
      canonicalUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      embedUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
    },
    {
      url: "https://youtu.be/dQw4w9WgXcQ",
      provider: "youtube",
      externalId: "dQw4w9WgXcQ",
      canonicalUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      embedUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
    },
    {
      url: "https://www.youtube.com/shorts/dQw4w9WgXcQ",
      provider: "youtube",
      externalId: "dQw4w9WgXcQ",
      canonicalUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      embedUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
    },
    {
      url: "https://www.youtube.com/embed/dQw4w9WgXcQ",
      provider: "youtube",
      externalId: "dQw4w9WgXcQ",
      canonicalUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      embedUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
    },
    {
      url: "https://vimeo.com/123456789",
      provider: "vimeo",
      externalId: "123456789",
      canonicalUrl: "https://vimeo.com/123456789",
      embedUrl: "https://player.vimeo.com/video/123456789",
    },
    {
      url: "https://player.vimeo.com/video/123456789",
      provider: "vimeo",
      externalId: "123456789",
      canonicalUrl: "https://vimeo.com/123456789",
      embedUrl: "https://player.vimeo.com/video/123456789",
    },
    {
      url: "https://www.tiktok.com/@vewave/video/7351234567890123456",
      provider: "tiktok",
      externalId: "7351234567890123456",
      canonicalUrl: "https://www.tiktok.com/@vewave/video/7351234567890123456",
      embedUrl: "https://www.tiktok.com/embed/v2/7351234567890123456",
    },
  ] satisfies Array<{
    url: string;
    provider: MediaProvider;
    externalId: string;
    canonicalUrl: string;
    embedUrl: string;
  }>;

  test.each(successCases)("normalizes $url", (testCase) => {
    expect(parseProviderUrl(testCase.url)).toEqual({
      provider: testCase.provider,
      externalId: testCase.externalId,
      canonicalUrl: testCase.canonicalUrl,
      embedUrl: testCase.embedUrl,
    });
  });

  const failureCases: Array<{ url: string; code: ApiErrorCode }> = [
    ["notaurl", "MEDIA_PARSE_FAILED"],
    ["ftp://www.youtube.com/watch?v=dQw4w9WgXcQ", "UNSUPPORTED_MEDIA_URL"],
    ["https://example.com/video/1", "UNSUPPORTED_MEDIA_URL"],
    ["https://www.youtube.com/watch?v=bad", "MEDIA_PARSE_FAILED"],
    ["https://vm.tiktok.com/ZMabcdef", "UNSUPPORTED_MEDIA_URL"],
  ].map(([url, code]) => ({ url, code: code as ApiErrorCode }));

  test.each(failureCases)("rejects $url with $code", (testCase) => {
    expect(() => parseProviderUrl(testCase.url)).toThrow(AppError);

    try {
      parseProviderUrl(testCase.url);
    } catch (error) {
      expect((error as AppError).code).toBe(testCase.code);
    }
  });
});
