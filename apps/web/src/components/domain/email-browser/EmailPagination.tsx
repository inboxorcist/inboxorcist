import type { ExplorerPagination } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";

interface EmailPaginationProps {
  pagination: ExplorerPagination | null;
  page: number;
  onPageChange: (page: number) => void;
  isLoading?: boolean;
}

export function EmailPagination({
  pagination,
  page,
  onPageChange,
  isLoading = false,
}: EmailPaginationProps) {
  const { t } = useLanguage();

  if (!pagination) return null;

  return (
    <div className="flex items-center gap-4">
      <p className="text-sm text-muted-foreground whitespace-nowrap">
        {pagination.total > 0 ? (
          <>
            {t("explorer.showing")} {(page - 1) * pagination.limit + 1} -{" "}
            {Math.min(page * pagination.limit, pagination.total)} {t("explorer.of")}{" "}
            {pagination.total.toLocaleString()} {t("explorer.emails")}
          </>
        ) : (
          t("explorer.noEmails")
        )}
      </p>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => onPageChange(1)}
          disabled={page === 1 || isLoading}
        >
          <ChevronsLeft className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1 || isLoading}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
        <span className="px-3 text-sm">
          {t("explorer.page")} {page} {t("explorer.of")} {pagination.totalPages || 1}
        </span>
        <Button
          variant="outline"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= pagination.totalPages || isLoading}
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => onPageChange(pagination.totalPages)}
          disabled={page >= pagination.totalPages || isLoading}
        >
          <ChevronsRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
