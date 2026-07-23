"use client";

import { Clock, Trash2, MoreVertical } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { AnalysisCardProps } from "@/app/app/analyses/types";
import { getScoreColorClass } from "@/app/app/analyses/helpers";

/** Card displaying an analysis summary with status, score, and actions. */
export function AnalysisCard({
  analysis,
  onClick,
  onDelete,
  isDeleting,
}: AnalysisCardProps) {
  const statusColor = getStatusColor(analysis.status);
  const scoreIcon = getScoreIcon(analysis.status, analysis.overallScore);
  const dateStr = formatDate(analysis.createdAt);

  return (
    <Card
      className="group flex items-center gap-4 p-4 transition-colors hover:border-primary/50 hover:bg-accent/50"
    >
      <div
        className="flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center"
        onClick={() => onClick(analysis.id)}
      >
        {scoreIcon}
      </div>

      <div
        className="min-w-0 flex-1 cursor-pointer"
        onClick={() => onClick(analysis.id)}
      >
        <p className="truncate text-sm font-medium">{analysis.prompt || "No prompt"}</p>
        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
          <span>{dateStr}</span>
          <span>·</span>
          <span className="capitalize">{analysis.mediaType}</span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Badge variant="secondary" className="capitalize">
          {analysis.platform === "youtube" ? "YT" : "IG"}
        </Badge>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColor}`}>
          {analysis.status}
        </span>

        <DropdownMenu>
          <DropdownMenuTrigger className="ml-1 rounded-md p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-white group-hover:opacity-100 focus:opacity-100">
            <MoreVertical className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onClick(analysis.id)}>
              View details
            </DropdownMenuItem>
            {onDelete && (
              <DropdownMenuItem
                onClick={() => onDelete(analysis.id)}
                disabled={isDeleting}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </Card>
  );
}

function getStatusColor(status: string): string {
  if (status === "completed") return "bg-green-500/10 text-green-600 dark:text-green-400";
  if (status === "failed") return "bg-destructive/10 text-destructive";
  return "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400";
}

function getScoreIcon(status: string, score: number | null) {
  if (status === "completed" && score != null) {
    return <span className={`text-2xl font-bold ${getScoreColorClass(score)}`}>{score}</span>;
  }
  if (status === "failed") {
    return <span className="text-2xl text-destructive">✕</span>;
  }
  return <Clock className="h-6 w-6 animate-pulse text-yellow-500" />;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.round(diffMs / 60000);
  const diffHours = Math.round(diffMs / 3600000);
  const diffDays = Math.round(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}
