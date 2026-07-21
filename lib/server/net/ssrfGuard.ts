import dns from "node:dns";
import type { LookupFunction as NetLookupFunction } from "node:net";

// --- SSRF guard -------------------------------------------------------

const PRIVATE_IPV4_RANGES: [base: string, prefix: number][] = [
  ["127.0.0.0", 8], // loopback
  ["10.0.0.0", 8], // private
  ["172.16.0.0", 12], // private
  ["192.168.0.0", 16], // private
  ["169.254.0.0", 16], // link-local
  ["0.0.0.0", 8], // "this network"
];

function ipv4ToInt(ip: string): number {
  return (
    ip
      .split(".")
      .reduce((acc, octet) => (acc << 8) + Number(octet), 0) >>> 0
  );
}

function isIpv4InRange(ip: string, base: string, prefix: number): boolean {
  const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
  return (ipv4ToInt(ip) & mask) === (ipv4ToInt(base) & mask);
}

function isPrivateIpv4(ip: string): boolean {
  return PRIVATE_IPV4_RANGES.some(([base, prefix]) => isIpv4InRange(ip, base, prefix));
}

function isPrivateIpv6(ip: string): boolean {
  const normalized = ip.toLowerCase();

  if (normalized === "::1") {
    return true; // loopback
  }

  if (normalized.startsWith("fc") || normalized.startsWith("fd")) {
    return true; // fc00::/7 (unique local)
  }

  if (normalized.startsWith("fe80")) {
    return true; // link-local
  }

  if (normalized.startsWith("::ffff:")) {
    const mapped = normalized.slice("::ffff:".length);
    if (/^\d+\.\d+\.\d+\.\d+$/.test(mapped)) {
      return isPrivateIpv4(mapped);
    }
  }

  return false;
}

function isPrivateOrLoopbackIp(ip: string): boolean {
  return ip.includes(":") ? isPrivateIpv6(ip) : isPrivateIpv4(ip);
}

/**
 * The outcome of validating a URL's hostname: the specific IP address that
 * was checked against the private/loopback/link-local blocklist. This must
 * be pinned to the actual connection (see `pinnedLookup` below) — resolving
 * the hostname a second time at connect-time would reopen a DNS-rebinding
 * hole, since nothing guarantees the second lookup returns the same address
 * as the first.
 */
export interface SafeAddress {
  address: string;
  family: 4 | 6;
}

/**
 * Rejects non-https URLs and hosts that resolve to a private/loopback/
 * link-local address, and returns the validated address to pin to the real
 * connection. Must be called before connecting AND again on every redirect
 * hop, since the redirect target is just as attacker-influenceable as the
 * original URL.
 */
export async function assertSafeUrl(url: URL): Promise<SafeAddress> {
  if (url.protocol !== "https:") {
    throw new Error(`Refusing to download non-https URL (protocol: ${url.protocol})`);
  }

  let addresses: { address: string; family: number }[];
  try {
    addresses = await dns.promises.lookup(url.hostname, { all: true });
  } catch {
    throw new Error(`Could not resolve host: ${url.hostname}`);
  }

  if (addresses.length === 0) {
    throw new Error(`Could not resolve host: ${url.hostname}`);
  }

  for (const { address } of addresses) {
    if (isPrivateOrLoopbackIp(address)) {
      throw new Error(`Refusing to download from private/loopback host: ${url.hostname}`);
    }
  }

  // Pin to the first validated address so the connection that actually gets
  // made is guaranteed to be the one we just checked, not whatever a second,
  // independent DNS resolution happens to return.
  const [{ address, family }] = addresses;
  return { address, family: family === 6 ? 6 : 4 };
}

/**
 * Builds a `lookup` function for `https.request` that ignores whatever
 * hostname it's asked to resolve and always returns the already-validated
 * address. This is what actually closes the DNS-rebinding TOCTOU: without
 * it, `https.request` re-resolves the hostname itself at connect time,
 * which can return a different (attacker-controlled) address than the one
 * `assertSafeUrl` validated a moment earlier.
 */
export function pinnedLookup(safeAddress: SafeAddress): NetLookupFunction {
  return (
    _hostname: string,
    options: dns.LookupOptions,
    callback: (error: NodeJS.ErrnoException | null, address: string | dns.LookupAddress[], family?: number) => void,
  ): void => {
    // Node's `autoSelectFamily` (Happy Eyeballs, on by default) calls the
    // lookup function with `{ all: true }` and expects an address array
    // back, rather than the single-address form. Handle both shapes so the
    // pin holds regardless of which calling convention net.js uses.
    if (options && options.all) {
      callback(null, [{ address: safeAddress.address, family: safeAddress.family }]);
      return;
    }
    callback(null, safeAddress.address, safeAddress.family);
  };
}
