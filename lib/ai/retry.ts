/**
 * Shared retry/backoff for the two upstream APIs this app leans on (Groq for
 * generation, Voyage for embeddings). Both are used on free tiers with tight
 * per-minute limits, and both fail in ways that are worth one more try:
 *
 *  - 429 rate limits (Groq: requests+tokens per minute; Voyage: 3 RPM without
 *    a card on file). Honour `retry-after` when the provider sends one.
 *  - 5xx / connection blips.
 *  - Groq structured-output rejections ("Generated JSON does not match the
 *    expected schema") — non-deterministic, so a fresh sample usually passes.
 */

const DEFAULT_MAX_ATTEMPTS = 4;
const BASE_DELAY_MS = 1_200;
const MAX_DELAY_MS = 30_000;

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface ErrorLike {
  statusCode?: number;
  status?: number;
  responseHeaders?: Record<string, string> | Headers;
  headers?: Record<string, string> | Headers;
  message?: string;
  cause?: unknown;
}

function asErrorLike(err: unknown): ErrorLike {
  return (err ?? {}) as ErrorLike;
}

/** HTTP status from whichever field the SDK in question happens to use. */
export function statusOf(err: unknown): number | undefined {
  const e = asErrorLike(err);
  const direct = e.statusCode ?? e.status;
  if (typeof direct === "number") return direct;
  if (e.cause) {
    const nested = asErrorLike(e.cause);
    const s = nested.statusCode ?? nested.status;
    if (typeof s === "number") return s;
  }
  return undefined;
}

function headerValue(err: unknown, name: string): string | null {
  const e = asErrorLike(err);
  for (const bag of [e.responseHeaders, e.headers]) {
    if (!bag) continue;
    if (typeof (bag as Headers).get === "function") {
      const v = (bag as Headers).get(name);
      if (v) return v;
    } else {
      const record = bag as Record<string, string>;
      const hit = Object.entries(record).find(
        ([k]) => k.toLowerCase() === name.toLowerCase(),
      );
      if (hit?.[1]) return hit[1];
    }
  }
  return null;
}

/**
 * `retry-after` is seconds per spec, but Groq also emits durations like
 * "2.5s" / "1m30s" in its rate-limit headers, so parse both shapes.
 */
export function retryAfterMs(err: unknown): number | null {
  const raw = headerValue(err, "retry-after") ?? headerValue(err, "x-ratelimit-reset-requests");
  if (!raw) return null;

  const asSeconds = Number(raw);
  if (Number.isFinite(asSeconds) && asSeconds >= 0) return asSeconds * 1000;

  const duration = /^(?:(\d+(?:\.\d+)?)m)?(?:(\d+(?:\.\d+)?)s)?$/.exec(raw.trim());
  if (duration && (duration[1] || duration[2])) {
    return (Number(duration[1] ?? 0) * 60 + Number(duration[2] ?? 0)) * 1000;
  }
  return null;
}

function messageOf(err: unknown): string {
  const e = asErrorLike(err);
  const own = typeof e.message === "string" ? e.message : "";
  const nested = e.cause ? (asErrorLike(e.cause).message ?? "") : "";
  return `${own}\n${nested}`.toLowerCase();
}

export function isRateLimit(err: unknown): boolean {
  return statusOf(err) === 429 || /rate limit|too many requests/.test(messageOf(err));
}

/** A schema/JSON failure from Groq's structured-output validator, or the AI SDK's parser. */
export function isSchemaFailure(err: unknown): boolean {
  const msg = messageOf(err);
  return (
    /does not match the expected schema|json_validate_failed|failed_generation|no object generated|could not parse/.test(
      msg,
    ) || (err as { name?: string })?.name === "AI_NoObjectGeneratedError"
  );
}

function isRetryable(err: unknown): boolean {
  const status = statusOf(err);
  if (status === 429 || status === 408 || status === 409 || (status && status >= 500)) return true;
  if (isRateLimit(err) || isSchemaFailure(err)) return true;
  // Undici/fetch level blips — no status, but transient.
  return /fetch failed|econnreset|etimedout|socket hang up|network/.test(messageOf(err));
}

export interface RetryOptions {
  /** Total attempts including the first. Default 4. */
  maxAttempts?: number;
  /** Label used in the thrown error + logs, e.g. "Groq (quiz)". */
  label?: string;
  /** Called before each retry sleep — useful for logging/telemetry. */
  onRetry?: (info: { attempt: number; waitMs: number; error: unknown }) => void;
}

/** Runs `fn`, retrying transient upstream failures with exponential backoff + jitter. */
export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const label = options.label ?? "AI request";

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt === maxAttempts || !isRetryable(err)) break;

      const suggested = retryAfterMs(err);
      const backoff = Math.min(BASE_DELAY_MS * 2 ** (attempt - 1), MAX_DELAY_MS);
      const jitter = Math.random() * 400;
      const waitMs = Math.min(Math.max(suggested ?? backoff, backoff) + jitter, MAX_DELAY_MS);

      options.onRetry?.({ attempt, waitMs, error: err });
      console.warn(
        `[ai-retry] ${label} attempt ${attempt}/${maxAttempts} failed (${
          statusOf(err) ?? "no status"
        }) — retrying in ${Math.round(waitMs)}ms`,
      );
      await sleep(waitMs);
    }
  }

  throw new Error(friendlyMessage(lastError, label), { cause: lastError });
}

/** Turns an upstream failure into something worth showing a student in the UI. */
export function friendlyMessage(err: unknown, label = "The AI service"): string {
  if (isRateLimit(err)) {
    return `${label} is rate limited right now (free-tier quota). Wait a minute and try again.`;
  }
  if (isSchemaFailure(err)) {
    return `${label} returned a malformed response a few times in a row. Try again — this usually clears on a retry.`;
  }
  const status = statusOf(err);
  if (status === 401 || status === 403) {
    return `${label} rejected the API key. Check GROQ_API_KEY / VOYAGE_API_KEY in .env.local.`;
  }
  if (status && status >= 500) {
    return `${label} is having an outage (${status}). Try again shortly.`;
  }
  const raw = asErrorLike(err).message;
  return raw ? `${label}: ${raw}` : `${label} failed for an unknown reason.`;
}
