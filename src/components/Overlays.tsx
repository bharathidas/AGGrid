import { ReactElement } from "react";
import { IOverlayParams } from "ag-grid-community";

/** Parameters the widget passes to its overlays through `overlayComponentParams`. */
export interface LivelyOverlayParams {
    /** Number of skeleton columns. */
    skeletonColumns: number;
    noRowsText: string;
    clearFiltersLabel: string;
    /** Column filters or the quick search narrow the rows. */
    filtersActive: boolean;
    onClearFilters: () => void;
}

const SKELETON_ROWS = 8;
// Fixed widths (percent of the column) so the skeleton looks organic without randomness.
const WIDTHS = [72, 54, 86, 40, 64, 78, 48, 90, 58, 68];

/** Shimmering placeholder rows shown while the data source loads. */
export function SkeletonOverlay(params: IOverlayParams & Partial<LivelyOverlayParams>): ReactElement {
    const columns = Math.max(1, Math.min(8, params.skeletonColumns ?? 4));
    return (
        <div className="mxt-ag-skeleton" role="status" aria-live="polite">
            <span className="mxt-ag-sr-only">Loading</span>
            {Array.from({ length: SKELETON_ROWS }).map((_, row) => (
                <div
                    key={row}
                    className="mxt-ag-skeleton__row"
                    aria-hidden="true"
                    style={{ animationDelay: `${row * 60}ms` }}
                >
                    {Array.from({ length: columns }).map((__, column) => (
                        <span key={column} className="mxt-ag-skeleton__cell">
                            <span
                                className="mxt-ag-skeleton__bar"
                                style={{ width: `${WIDTHS[(row * 3 + column) % WIDTHS.length]}%` }}
                            />
                        </span>
                    ))}
                </div>
            ))}
        </div>
    );
}

/** Friendly empty state with a gently floating illustration and, when filters hide every row, a Clear filters button. */
export function EmptyStateOverlay(params: IOverlayParams & Partial<LivelyOverlayParams>): ReactElement {
    const filtered = params.overlayType === "noMatchingRows" || Boolean(params.filtersActive);
    return (
        <div className="mxt-ag-empty-state" role="status">
            <svg
                className="mxt-ag-empty-state__art"
                width="96"
                height="72"
                viewBox="0 0 96 72"
                fill="none"
                aria-hidden="true"
                focusable="false"
            >
                <ellipse className="mxt-ag-empty-state__shadow" cx="48" cy="66" rx="26" ry="4" />
                <g className="mxt-ag-empty-state__float">
                    <rect x="18" y="8" width="60" height="44" rx="6" className="mxt-ag-empty-state__card" />
                    <path d="M18 20h60" className="mxt-ag-empty-state__line" />
                    <path d="M28 30h26M28 38h18" className="mxt-ag-empty-state__line" />
                    <circle cx="66" cy="40" r="9" className="mxt-ag-empty-state__lens" />
                    <path d="M72.5 46.5l6 6" className="mxt-ag-empty-state__lens" />
                </g>
            </svg>
            <div className="mxt-ag-empty-state__text">{params.noRowsText ?? "No rows to show"}</div>
            {filtered && params.onClearFilters && (
                <button
                    type="button"
                    className="btn btn-default btn-sm mxt-ag-empty-state__clear"
                    onClick={params.onClearFilters}
                >
                    {params.clearFiltersLabel ?? "Clear filters"}
                </button>
            )}
        </div>
    );
}
