import { KeyboardEvent, ReactElement, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { ICellRendererParams } from "ag-grid-community";

import type { GridRow } from "../utils/rows";
import { AGGREGATE_FNS, AggregateChoice } from "../utils/totals";
import { UiTexts, aggregateLabel } from "../utils/texts";
import { CheckIcon } from "./Icons";
import { moveMenuFocus } from "./usePopover";

export interface TotalsMenuProps {
    columnName: string;
    current: AggregateChoice;
    /** Functions that make sense for the column (sum and average need numbers). */
    choices: AggregateChoice[];
    anchor: { top: number; left: number; bottom: number };
    texts: UiTexts;
    dark: boolean;
    rtl: boolean;
    onChoose: (choice: AggregateChoice) => void;
    onClose: () => void;
}

export const ALL_TOTAL_CHOICES: AggregateChoice[] = ["none", ...AGGREGATE_FNS];

/** Menu that switches the function of a totals cell (sum, average, minimum, maximum, count, distinct count). */
export function TotalsMenu(props: TotalsMenuProps): ReactElement {
    const ref = useRef<HTMLDivElement>(null);
    const { onClose } = props;
    useEffect(() => {
        const outside = (event: MouseEvent): void => {
            if (!ref.current?.contains(event.target as Node)) {
                onClose();
            }
        };
        document.addEventListener("mousedown", outside);
        const frame = window.requestAnimationFrame(() =>
            (
                ref.current?.querySelector<HTMLElement>("[aria-checked='true']") ??
                ref.current?.querySelector<HTMLElement>("[data-menuitem]")
            )?.focus()
        );
        return () => {
            document.removeEventListener("mousedown", outside);
            window.cancelAnimationFrame(frame);
        };
    }, [onClose]);
    const handleKey = (event: KeyboardEvent<HTMLDivElement>): void => {
        if (event.key === "Escape" || event.key === "Tab") {
            event.preventDefault();
            event.stopPropagation();
            onClose();
        } else if (moveMenuFocus(event.currentTarget, event.key)) {
            event.preventDefault();
        }
    };
    const top = props.anchor.bottom + window.scrollY + 2;
    const left = Math.max(8, Math.min(props.anchor.left, window.innerWidth - 228)) + window.scrollX;
    return createPortal(
        <div
            ref={ref}
            className={`mxt-ag-menu mxt-ag-totals-menu${props.dark ? " mxt-ag-totals-menu--dark" : ""}`}
            role="menu"
            aria-label={props.columnName}
            dir={props.rtl ? "rtl" : undefined}
            style={{ position: "absolute", top, left, right: "auto" }}
            onKeyDown={handleKey}
        >
            {props.choices.map(choice => (
                <button
                    key={choice}
                    type="button"
                    role="menuitemradio"
                    aria-checked={props.current === choice}
                    data-menuitem
                    className="mxt-ag-menu__item"
                    onClick={() => props.onChoose(choice)}
                >
                    <span className="mxt-ag-menu__check">{props.current === choice && <CheckIcon />}</span>
                    <span className="mxt-ag-menu__name">{aggregateLabel(props.texts, choice)}</span>
                </button>
            ))}
        </div>,
        document.body
    );
}

export interface LoadMoreParams {
    onLoadMore: (groupPath: string) => void;
    label: () => string;
    loadingLabel: () => string;
    isLoading: (groupPath: string) => boolean;
    errorOf: (groupPath: string) => string | undefined;
}

/** Full-width row at the end of a lazily loaded server group: loads the next page of the group. */
export function LoadMoreRow(params: ICellRendererParams<GridRow> & LoadMoreParams): ReactElement | null {
    const more = params.data?.loadMore;
    if (!more) {
        return null;
    }
    const loading = params.isLoading(more.groupPath);
    const error = params.errorOf(more.groupPath);
    return (
        <div className="mxt-ag-loadmore">
            {error && (
                <span className="mxt-ag-loadmore__error" role="alert">
                    {error}
                </span>
            )}
            <button
                type="button"
                className="btn btn-link btn-sm mxt-ag-loadmore__button"
                disabled={loading}
                onClick={() => params.onLoadMore(more.groupPath)}
            >
                {loading ? params.loadingLabel() : `${params.label()} (${more.loaded} / ${more.total})`}
            </button>
        </div>
    );
}
