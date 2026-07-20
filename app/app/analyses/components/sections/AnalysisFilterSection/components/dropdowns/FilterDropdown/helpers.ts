import type { FilterOption } from "@/app/app/analyses/types";

/**
 * Client-side, case-insensitive substring filter for the Account panel's search-within-list
 * field. Purely local to the open panel — it never touches the main list or the URL, and the
 * caller is responsible for resetting the search text when the panel closes (design §5.4).
 */
export function filterOptionsBySearch(
  options: FilterOption[],
  search: string
): FilterOption[] {
  const query = search.trim().toLowerCase();
  if (!query) return options;
  return options.filter((option) => option.label.toLowerCase().includes(query));
}
