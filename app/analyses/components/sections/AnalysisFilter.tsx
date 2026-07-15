"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AnalysisFilterProps } from "@/app/analyses/types";

/** Dropdown filter for selecting analyses by account. */
export function AnalysisFilter({
  accounts,
  selectedAccount,
  onSelect,
}: AnalysisFilterProps) {
  if (accounts.length === 0) return null;

  return (
    <Select
      value={selectedAccount ?? "__all__"}
      onValueChange={(v) => onSelect(v === "__all__" ? null : v)}
    >
      <SelectTrigger className="w-[200px]">
        <SelectValue placeholder="All accounts" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__all__">All accounts</SelectItem>
        {accounts.map((account) => (
          <SelectItem key={account} value={account}>
            {account}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
