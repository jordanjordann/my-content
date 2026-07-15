export const URL_REGEX =
  /^https?:\/\/(www\.)?(instagram\.com\/(reel|p)\/[\w-]+|youtube\.com\/shorts\/[\w-]+)/i;

export function validateUrl(url: string): string | null {
  if (!URL_REGEX.test(url.trim())) {
    return "Must be an Instagram Reel/Post or YouTube Short URL";
  }
  return null;
}

export function splitPastedUrls(text: string): string[] {
  return text
    .split(/[\s\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}
