import { ReactElement, useEffect, useRef } from "react";
import { ICellRendererParams } from "ag-grid-community";
import { ListWidgetValue } from "mendix";
import classNames from "classnames";

import { GridRow } from "../utils/rows";
import { ChevronIcon } from "./Icons";

export interface DetailToggleParams {
    isExpanded: (rowId: string) => boolean;
    onToggle: (rowId: string) => void;
    label: () => string;
}

/** Chevron in the detail column that expands and collapses the detail row. */
export function DetailToggleCell(params: ICellRendererParams<GridRow> & DetailToggleParams): ReactElement | null {
    const button = useRef<HTMLButtonElement>(null);
    const row = params.data;
    const rowId = row?.id;
    const { onToggle } = params;

    useEffect(() => {
        const element = button.current;
        if (!element || !rowId) {
            return;
        }
        // A native listener stops the click before AG Grid sees it, so the chevron neither selects
        // the row nor runs the row click action.
        const click = (event: MouseEvent): void => {
            event.stopPropagation();
            onToggle(rowId);
        };
        element.addEventListener("click", click);
        return () => element.removeEventListener("click", click);
    }, [rowId, onToggle]);

    if (!row || row.totals || row.detail || !row.item) {
        return null;
    }
    const expanded = params.isExpanded(row.id);
    return (
        <button
            ref={button}
            type="button"
            tabIndex={-1}
            className={classNames("mxt-ag-detail-toggle", { "mxt-ag-detail-toggle--open": expanded })}
            aria-expanded={expanded}
            aria-label={params.label()}
            title={params.label()}
        >
            <ChevronIcon />
        </button>
    );
}

export interface DetailRowParams {
    getContent: () => ListWidgetValue | undefined;
    /** Fixed height in pixels; 0 measures the content. */
    fixedHeight: number;
    onHeight: (detailRowId: string, height: number) => void;
    label: () => string;
}

/** Full-width row under an expanded row with the detail widgets of that row's object. */
export function DetailRow(params: ICellRendererParams<GridRow> & DetailRowParams): ReactElement | null {
    const ref = useRef<HTMLDivElement>(null);
    const row = params.data;
    const id = row?.id;
    const { fixedHeight, onHeight } = params;

    useEffect(() => {
        const element = ref.current;
        if (!element || !id || fixedHeight > 0) {
            return;
        }
        const report = (): void => onHeight(id, Math.ceil(element.getBoundingClientRect().height));
        report();
        if (typeof ResizeObserver === "undefined") {
            return;
        }
        const observer = new ResizeObserver(() => report());
        observer.observe(element);
        return () => observer.disconnect();
    }, [id, fixedHeight, onHeight]);

    if (!row?.item) {
        return null;
    }
    const content = params.getContent();
    return (
        <div
            ref={ref}
            className="mxt-ag-detail"
            role="region"
            aria-label={params.label()}
            style={fixedHeight > 0 ? { height: fixedHeight, overflowY: "auto" } : undefined}
        >
            {content ? content.get(row.item) : null}
        </div>
    );
}
