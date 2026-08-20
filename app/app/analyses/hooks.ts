"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import type { AnalysisListItemIndexed } from "@/lib/api/analyses/types";
import {
  CONTENT_KIND_OPTIONS,
  KEYWORD_DEBOUNCE_MS,
  PLATFORM_OPTIONS,
  STATUS_OPTIONS,
  TIER_OPTIONS,
} from "@/app/app/analyses/constants";
import {
  anyActive,
  buildFilterQueryString,
  matchesDimensions,
  matchesKeyword,
  parseFiltersFromParams,
} from "@/app/app/analyses/helpers";
import type { AnalysisFilters, FilterDimension, OptionCounts } from "@/app/app/analyses/types";

/**
 * Reads and writes analysis filter state from/to the URL. The URL is the single source of
 * truth — no filter state is mirrored in React state, so back/forward navigation, refresh, and
 * shared links all fall out for free.
 *
 * `setDimension`/`toggleValue`/`removeValue`/`clearAll` write immediately (checkbox toggles are
 * instant, per design). `setKeyword` debounces its own write by `KEYWORD_DEBOUNCE_MS`.
 */
export function useAnalysisFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filters = useMemo(() => parseFiltersFromParams(searchParams), [searchParams]);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // `setKeyword`'s pending timer must read the latest filters/searchParams at fire time, not
  // from the closure of the render that scheduled it — otherwise an interleaved immediate write
  // (e.g. a checkbox toggle inside the 300ms debounce window) gets silently clobbered by the
  // debounced write resolving stale state. See TDD §7.2. Synced in an effect (not during render)
  // per this repo's `react-hooks/refs` rule, which forbids mutating a ref in the render body.
  const latest = useRef({ filters, searchParams });
  useEffect(() => {
    latest.current = { filters, searchParams };
  });

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    [],
  );

  const writeFilters = useCallback(
    (next: AnalysisFilters) => {
      const qs = buildFilterQueryString(new URLSearchParams(searchParams), next);
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  const setDimension = useCallback(
    (dimension: FilterDimension, values: string[]) => {
      writeFilters({ ...filters, [dimension]: values } as AnalysisFilters);
    },
    [filters, writeFilters],
  );

  const toggleValue = useCallback(
    (dimension: FilterDimension, value: string) => {
      const current = filters[dimension] as string[];
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      setDimension(dimension, next);
    },
    [filters, setDimension],
  );

  const removeValue = useCallback(
    (dimension: FilterDimension, value: string) => {
      setDimension(
        dimension,
        (filters[dimension] as string[]).filter((v) => v !== value),
      );
    },
    [filters, setDimension],
  );

  const setKeyword = useCallback(
    (q: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        const { filters: f, searchParams: sp } = latest.current;
        const qs = buildFilterQueryString(new URLSearchParams(sp), { ...f, q });
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      }, KEYWORD_DEBOUNCE_MS);
    },
    [router, pathname],
  );

  // Explicit clear (the input's ✕, and the keyword chip's remove button) bypasses the debounce
  // entirely (design §6) — it cancels any pending timer and writes `q: ""` immediately, same as
  // every other immediate write. Distinct from `clearAll`, which also resets Account/Platform/
  // Status; this only touches the keyword, leaving other active dimensions untouched.
  const clearKeyword = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    writeFilters({ ...filters, q: "" });
  }, [filters, writeFilters]);

  const clearAll = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    writeFilters({ account: [], platform: [], contentKind: [], tier: [], status: [], q: "" });
  }, [writeFilters]);

  return {
    filters,
    setDimension,
    toggleValue,
    removeValue,
    setKeyword,
    clearKeyword,
    clearAll,
    anyActive: anyActive(filters),
  };
}

/**
 * Filters analyses against the active filter set and computes contextual per-option counts, in
 * a single pass over the in-memory dataset (there is no server-side filtering — see TDD §3.2).
 *
 * Counts are contextual and self-excluding (TDD §6.3): `count(X)` for option `X` in dimension
 * `D` matches every *other* dimension's active filters plus the keyword, ignoring `D`'s own
 * current selections. Without self-exclusion, every unselected option in an active dimension
 * would show 0, since within-dimension logic is OR.
 *
 * `accounts` is the full account list from the query response (not derived from `analyses`) so
 * that a zero-match account still emits a `0`-count option (design §10.4 — never hide options).
 *
 * Ticket #144 introduced server-side pagination (`ANALYSES_PAGE_SIZE`/page) for the future 3C
 * table, which would have silently capped this page's filters at one page. B4 (PR #196 review)
 * fixes that for THIS page specifically: the caller (`AnalysesContent`) fetches the full corpus
 * in one response — PR #203 review blocker 1 — via `useAnalysesQuery({ pageSize:
 * ANALYSES_FETCH_ALL_PAGE_SIZE })`, the same params `AnalysisDataTable` itself now builds (#266,
 * 2026-08-20 owner ruling, dropped `sortBy`/`sortDir` from that shape entirely), so `analyses`
 * here is the full corpus again, same as pre-#144, without a second independent fetch.
 * `totalCount` is still passed in separately from `pagination.total` rather than derived as
 * `analyses.length`, so this stays correct even if the caller's fetch strategy changes again.
 */
export function useFilteredAnalyses(
  analyses: AnalysisListItemIndexed[],
  filters: AnalysisFilters,
  accounts: string[],
  totalCount: number,
) {
  return useMemo(() => {
    const filtered = analyses.filter(
      (item) => matchesDimensions(item, filters) && matchesKeyword(item, filters.q),
    );

    const countFor = (
      dimension: FilterDimension,
      value: string,
      getValue: (item: AnalysisListItemIndexed) => string,
    ) =>
      analyses.filter(
        (item) =>
          getValue(item) === value &&
          matchesDimensions(item, filters, dimension) &&
          matchesKeyword(item, filters.q),
      ).length;

    const counts: OptionCounts = {
      account: accounts.map((account) => ({
        value: account,
        label: account,
        count: countFor("account", account, (item) => item.username),
      })),
      platform: PLATFORM_OPTIONS.map((option) => ({
        value: option.value,
        label: option.label,
        count: countFor("platform", option.value, (item) => item.platform),
      })),
      status: STATUS_OPTIONS.map((option) => ({
        value: option.value,
        label: option.label,
        count: countFor("status", option.value, (item) => item.status),
      })),
      contentKind: CONTENT_KIND_OPTIONS.map((option) => ({
        value: option.value,
        label: option.label,
        count: countFor("contentKind", option.value, (item) => item.mediaType),
      })),
      // Tier's `getValue` reads `performance.computed.tierUsed`, falling back to a sentinel
      // that matches no option's `value` for rows with no `performance` block at all — those
      // rows are excluded from every Tier count the same way `matchesDimensions` excludes them
      // from every Tier match (helpers.ts).
      tier: TIER_OPTIONS.map((option) => ({
        value: option.value,
        label: option.label,
        count: countFor("tier", option.value, (item) => item.performance?.computed.tierUsed ?? "__NONE__"),
      })),
    };

    return { filtered, counts, totalCount };
  }, [analyses, filters, accounts, totalCount]);
}
