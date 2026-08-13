/**
 * Issue #132 — the missing automated contrast-regression guard, added here per ticket #149's
 * instruction ("3C is the natural place to finally add it — do so if scope allows"). This is a
 * minimal, reusable helper implementing the RUNBOOK §8.4.6 gamma-encoded sRGB method exactly:
 * oklch -> linear sRGB -> gamma-encoded sRGB (0-255), alpha compositing done on the GAMMA-encoded
 * values (never linear — the exact bug class RUNBOOK §8.4 documents), then re-linearised for the
 * WCAG relative-luminance contrast formula. Any new badge/text-on-tint pattern in this table (or
 * elsewhere) can import `contrastRatio`/`oklchToSrgb255`/`compositeGamma` and assert its four
 * surface ratios in a real test, instead of a PR body claim nobody re-checks on the next change.
 */

export type Srgb255 = [number, number, number];

export function oklchToSrgb255(L: number, C: number, H: number): Srgb255 {
  const hRad = (H * Math.PI) / 180;
  const a = C * Math.cos(hRad);
  const b = C * Math.sin(hRad);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;
  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;
  const rLin = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const gLin = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const bLin = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;
  const toGamma = (c: number) => {
    const clamped = Math.min(1, Math.max(0, c));
    return clamped <= 0.0031308 ? 12.92 * clamped : 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055;
  };
  return [toGamma(rLin) * 255, toGamma(gLin) * 255, toGamma(bLin) * 255];
}

export function hexToSrgb255(hex: string): Srgb255 {
  const clean = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(clean.slice(i, i + 2), 16)) as Srgb255;
}

/** Composites `fg` over `bg` at `alpha` (0-1) — both GAMMA-encoded 0-255, per §8.4.6. */
export function compositeGamma(fg: Srgb255, bg: Srgb255, alpha: number): Srgb255 {
  return fg.map((c, i) => c * alpha + bg[i] * (1 - alpha)) as Srgb255;
}

function gammaToLinear(c255: number): number {
  const c = c255 / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function relativeLuminance(rgb255: Srgb255): number {
  const [r, g, b] = rgb255.map(gammaToLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two gamma-encoded sRGB colours (0-255 each channel). */
export function contrastRatio(a: Srgb255, b: Srgb255): number {
  const L1 = relativeLuminance(a);
  const L2 = relativeLuminance(b);
  const lighter = Math.max(L1, L2);
  const darker = Math.min(L1, L2);
  return (lighter + 0.05) / (darker + 0.05);
}

/** This app's real `.dark` tokens (`app/globals.css`) — re-derive here, never re-guess. */
export const DARK_TOKENS = {
  background: oklchToSrgb255(0.105, 0.026, 255),
  cardRaw: oklchToSrgb255(0.15, 0.032, 255), // --card carries its own 86% alpha
  primary: oklchToSrgb255(0.68, 0.18, 255),
  mutedOpaque: oklchToSrgb255(0.2, 0.038, 255),
  mutedForeground: oklchToSrgb255(0.72, 0.03, 250),
} as const;

export const CARD = compositeGamma(DARK_TOKENS.cardRaw, DARK_TOKENS.background, 0.86);
/** Row hover surface (`hover:bg-muted/50`), composited over the already-composited card. */
export const ROW_HOVER = compositeGamma(DARK_TOKENS.mutedOpaque, CARD, 0.5);

export const FOUR_SURFACES: Record<"background" | "card" | "hover" | "muted", Srgb255> = {
  background: DARK_TOKENS.background,
  card: CARD,
  hover: ROW_HOVER,
  muted: DARK_TOKENS.mutedOpaque,
};

/** Ratios of a `bg-{tint}/{alphaPercent} text-{tint}` badge pattern against all four surfaces. */
export function badgeRatiosOnAllSurfaces(tint: Srgb255, alpha: number): Record<keyof typeof FOUR_SURFACES, number> {
  const result = {} as Record<keyof typeof FOUR_SURFACES, number>;
  for (const [name, surface] of Object.entries(FOUR_SURFACES) as [keyof typeof FOUR_SURFACES, Srgb255][]) {
    result[name] = contrastRatio(tint, compositeGamma(tint, surface, alpha));
  }
  return result;
}
