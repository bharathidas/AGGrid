import { ChangeEvent, ReactElement } from "react";

export interface PagerState {
    page: number;
    totalPages: number;
    pageSize: number;
    rowCount: number;
}

export interface PagerProps extends PagerState {
    pageSizes: number[] | false;
    pageSizeLabel: string;
    /** Template with [first], [last] and [total]. */
    statusTemplate: string;
    onFirst: () => void;
    onPrevious: () => void;
    onNext: () => void;
    onLast: () => void;
    onPageSize: (size: number) => void;
}

function Chevron({ direction, double }: { direction: "left" | "right"; double?: boolean }): ReactElement {
    const path = direction === "left" ? "M7.5 2 3 6l4.5 4" : "M4.5 2 9 6l-4.5 4";
    const second = direction === "left" ? "M11.5 2 7 6l4.5 4" : "M8.5 2 13 6l-4.5 4";
    return (
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" focusable="false">
            <path
                d={double ? (direction === "left" ? "M6 2 1.5 6 6 10" : "M6 2l4.5 4L6 10") : path}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
            />
            {double && <path d={second} fill="none" stroke="currentColor" strokeWidth="1.5" />}
        </svg>
    );
}

/** Data Grid 2 style paging bar: first/previous, "x to y of z", next/last and an optional page size selector. */
export function Pager(props: PagerProps): ReactElement {
    const { page, totalPages, pageSize, rowCount, pageSizes } = props;
    const first = rowCount === 0 ? 0 : page * pageSize + 1;
    const last = Math.min(rowCount, (page + 1) * pageSize);
    const atStart = page <= 0;
    const atEnd = page >= totalPages - 1;

    return (
        <div className="mxt-ag-pager">
            {pageSizes && pageSizes.length > 1 && (
                <label className="mxt-ag-pager__size">
                    <span>{props.pageSizeLabel}</span>
                    <select
                        className="form-control"
                        value={pageSize}
                        onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                            props.onPageSize(Number(event.target.value))
                        }
                    >
                        {pageSizes.map(size => (
                            <option key={size} value={size}>
                                {size}
                            </option>
                        ))}
                    </select>
                </label>
            )}
            <div className="mxt-ag-pager__nav" role="navigation" aria-label="Pagination">
                <button
                    type="button"
                    className="btn mxt-ag-pager__btn"
                    aria-label="Go to first page"
                    disabled={atStart}
                    onClick={props.onFirst}
                >
                    <Chevron direction="left" double />
                </button>
                <button
                    type="button"
                    className="btn mxt-ag-pager__btn"
                    aria-label="Go to previous page"
                    disabled={atStart}
                    onClick={props.onPrevious}
                >
                    <Chevron direction="left" />
                </button>
                <span className="mxt-ag-pager__status" aria-live="polite">
                    {props.statusTemplate
                        .replace("[first]", String(first))
                        .replace("[last]", String(last))
                        .replace("[total]", String(rowCount))}
                </span>
                <button
                    type="button"
                    className="btn mxt-ag-pager__btn"
                    aria-label="Go to next page"
                    disabled={atEnd}
                    onClick={props.onNext}
                >
                    <Chevron direction="right" />
                </button>
                <button
                    type="button"
                    className="btn mxt-ag-pager__btn"
                    aria-label="Go to last page"
                    disabled={atEnd}
                    onClick={props.onLast}
                >
                    <Chevron direction="right" double />
                </button>
            </div>
        </div>
    );
}
