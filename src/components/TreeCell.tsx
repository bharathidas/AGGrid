import { ReactElement, useEffect, useRef } from "react";
import { ICellRendererParams } from "ag-grid-community";
import classNames from "classnames";

import { GridRow } from "../utils/rows";
import { ChevronIcon } from "./Icons";

export interface TreeCellParams {
    isOpen: (key: string, level: number) => boolean;
    onToggle: (key: string) => void;
    formatCount: (count: number) => string;
}

/** Tree column cell: indentation, chevron (rows with children), label and the number of rows below. */
export function TreeCell(params: ICellRendererParams<GridRow> & TreeCellParams): ReactElement | null {
    const button = useRef<HTMLButtonElement>(null);
    const tree = params.data?.tree;
    const key = tree?.key;
    const { onToggle } = params;

    useEffect(() => {
        const element = button.current;
        if (!element || key === undefined) {
            return;
        }
        // Handled natively so the click neither selects nor runs the row click action.
        const click = (event: MouseEvent): void => {
            event.stopPropagation();
            onToggle(key);
        };
        element.addEventListener("click", click);
        return () => element.removeEventListener("click", click);
    }, [key, onToggle]);

    if (!tree) {
        return null;
    }
    const open = params.isOpen(tree.key, tree.level);
    return (
        <span
            className={classNames("mxt-ag-tree", { "mxt-ag-tree--filler": tree.filler })}
            style={{ paddingInlineStart: `${tree.level * 18}px` }}
        >
            {tree.hasChildren ? (
                <button
                    ref={button}
                    type="button"
                    tabIndex={-1}
                    className={classNames("mxt-ag-group__toggle", { "mxt-ag-group__toggle--open": open })}
                    aria-expanded={open}
                    aria-label={`${tree.label}, level ${tree.level + 1}`}
                >
                    <ChevronIcon />
                </button>
            ) : (
                <span className="mxt-ag-tree__leaf" aria-hidden="true" />
            )}
            <span className="mxt-ag-tree__label">{tree.label}</span>
            {tree.hasChildren && (
                <span className="mxt-ag-group__count" aria-label={`${tree.descendants} rows`}>
                    {params.formatCount(tree.descendants)}
                </span>
            )}
        </span>
    );
}
