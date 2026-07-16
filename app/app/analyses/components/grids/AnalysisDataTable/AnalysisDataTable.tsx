"use client";

import { motion, type Variants } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ExternalLink, MoreVertical, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { AnalysisListItem } from "@/lib/api/analyses/types";

// --- TYPE DEFINITIONS ---
interface AnalysisTableProps {
  analyses: AnalysisListItem[];
  onAnalysisClick: (id: string) => void;
  onDelete?: (id: string) => void;
  isDeleting?: boolean;
}

// --- SCORE COLOR HELPERS ---
function getScoreColor(score: number | null): string {
  if (score == null) return "text-muted-foreground";
  if (score >= 7) return "text-green-600 dark:text-green-400";
  if (score >= 5) return "text-yellow-600 dark:text-yellow-400";
  return "text-destructive";
}

function getScoreBg(score: number | null): string {
  if (score == null) return "bg-muted";
  if (score >= 7) return "bg-green-500/10";
  if (score >= 5) return "bg-yellow-500/10";
  return "bg-destructive/10";
}

// --- DIMENSION SCORE CELL ---
function DimensionScoreCell({ score }: { score: number | null }) {
  return (
    <span
      className={cn("text-sm font-semibold tabular-nums", getScoreColor(score))}
    >
      {score ?? "—"}
    </span>
  );
}

// --- MAIN COMPONENT ---
export const AnalysisDataTable = ({
  analyses,
  onAnalysisClick,
  onDelete,
  isDeleting,
}: AnalysisTableProps) => {
  const rowVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.3,
        ease: "easeInOut",
      },
    },
  };

  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
      <div className="relative w-full overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[48px]">Thumb</TableHead>
              <TableHead className="w-[48px]">Platform</TableHead>
              <TableHead>Title</TableHead>
              <TableHead className="text-center">Score</TableHead>
              <TableHead className="text-center">Hook</TableHead>
              <TableHead className="text-center">Retention</TableHead>
              <TableHead className="text-center">Visual</TableHead>
              <TableHead className="text-center">A/V</TableHead>
              <TableHead className="text-center">Trend</TableHead>
              <TableHead className="text-center">CTA</TableHead>
              <TableHead className="text-center">Brand</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {analyses.length > 0 ? (
              analyses.map((analysis) => (
                <motion.tr
                  key={analysis.id}
                  initial="hidden"
                  animate="visible"
                  variants={rowVariants}
                  className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
                >
                  {/* Thumbnail */}
                  <TableCell>
                    <div
                      className="flex h-10 w-10 cursor-pointer items-center justify-center overflow-hidden rounded bg-muted"
                      onClick={() => onAnalysisClick(analysis.id)}
                    >
                      {analysis.thumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={analysis.thumbnailUrl}
                          alt="Thumbnail"
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </div>
                  </TableCell>

                  {/* Platform */}
                  <TableCell>
                    <span
                      className={cn(
                        "inline-flex h-6 w-6 items-center justify-center rounded text-[10px] font-bold",
                        analysis.platform === "youtube"
                          ? "bg-red-500/10 text-red-600 dark:text-red-400"
                          : "bg-pink-500/10 text-pink-600 dark:text-pink-400",
                      )}
                    >
                      {analysis.platform === "youtube" ? "YT" : "IG"}
                    </span>
                  </TableCell>

                  {/* Title */}
                  <TableCell>
                    <div
                      className="cursor-pointer"
                      onClick={() => onAnalysisClick(analysis.id)}
                    >
                      <p className="truncate text-sm font-medium">
                        {analysis.title || analysis.caption || "No title"}
                      </p>
                    </div>
                  </TableCell>

                  {/* Overall Score */}
                  <TableCell className="text-center">
                    <div
                      className={cn(
                        "inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold",
                        getScoreBg(analysis.overallScore),
                        getScoreColor(analysis.overallScore),
                      )}
                    >
                      {analysis.overallScore ?? "—"}
                    </div>
                  </TableCell>

                  {/* Dimension Scores */}
                  <TableCell className="text-center">
                    <DimensionScoreCell
                      score={analysis.scorecard?.hookStrength ?? null}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <DimensionScoreCell
                      score={analysis.scorecard?.retentionFlow ?? null}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <DimensionScoreCell
                      score={analysis.scorecard?.visualPolish ?? null}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <DimensionScoreCell
                      score={analysis.scorecard?.audioVisualSync ?? null}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <DimensionScoreCell
                      score={analysis.scorecard?.trendAlignment ?? null}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <DimensionScoreCell
                      score={analysis.scorecard?.callToAction ?? null}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <DimensionScoreCell
                      score={analysis.scorecard?.brandConsistency ?? null}
                    />
                  </TableCell>

                  {/* Actions */}
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-white">
                        <MoreVertical className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          className="hover:!text-white"
                          onClick={() => onAnalysisClick(analysis.id)}
                        >
                          <ExternalLink className="mr-2 h-4 w-4" />
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
                  </TableCell>
                </motion.tr>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={12} className="h-24 text-center">
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
