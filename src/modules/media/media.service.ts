import { parseProviderUrl } from "./providers";

export class MediaService {
  parseUrl(url: string) {
    return parseProviderUrl(url);
  }
}
