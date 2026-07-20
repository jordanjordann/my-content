export class ScrapeCreatorsError extends Error {
  status: number;
  upstreamMessage?: string;

  constructor(message: string, status: number, upstreamMessage?: string) {
    super(message);
    this.name = "ScrapeCreatorsError";
    this.status = status;
    this.upstreamMessage = upstreamMessage;
  }
}

function bodyLooksPrivate(body: string): boolean {
  const lower = body.toLowerCase();
  return (
    lower.includes("is_private") && lower.includes("true")
  ) || lower.includes("this account is private") || lower.includes("private account");
}

export function mapStatusToMessage(status: number, body?: string): string {
  if (body && bodyLooksPrivate(body)) {
    return "This content is private and cannot be analysed.";
  }

  if (status === 401 || status === 403) {
    return "ScrapeCreators authentication failed. Check SCRAPECREATORS_API_KEY.";
  }

  if (status === 404) {
    return "Content not found — it may be deleted or the URL is wrong.";
  }

  if (status === 429) {
    return "Rate limited by ScrapeCreators. Try again shortly.";
  }

  if (status >= 500) {
    return "ScrapeCreators is temporarily unavailable. Try again shortly.";
  }

  // Fallback: also used for network/timeout errors (status 0), which have
  // no upstream HTTP status of their own.
  return "Could not reach ScrapeCreators (timeout).";
}
