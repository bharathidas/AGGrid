import { ReactElement, useEffect, useRef } from "react";
import { ICellRendererParams } from "ag-grid-community";
import classNames from "classnames";

import { GridRow } from "../utils/rows";
import { ChevronIcon } from "./Icons";

export interface GroupCellParams {
    isCollapsed: (path: string) => boolean;
    onToggle: (path: string) => void;
    /** Number format for the row counts. */
    formatCount: (count: number) => string;
    /** Whether a group can be opened and closed (pivot rows of the innermost level cannot). */
    canToggle?: (path: string) => boolean;
}

/** Group column cell: indented chevron, column caption, group value and the number of rows. */
export function GroupCell(params: ICellRendererParams<GridRow> & GroupCellParams): ReactElement | null {
    const button = useRef<HTMLButtonElement>(null);
    const group = params.data?.group;
    const path = group?.path;
    const { onToggle } = params;

    useEffect(() => {
        const element = button.current;
        if (!element || path === undefined) {
            return;
        }
        // Handled natively so the click neither selects nor runs the row click action.
        const click = (event: MouseEvent): void => {
            event.stopPropagation();
            onToggle(path);
        };
        element.addEventListener("click", click);
        return () => element.removeEventListener("click", click);
    }, [path, onToggle]);

    if (!group) {
        return null;
    }
    const collapsed = params.isCollapsed(group.path);
    const toggleable = params.canToggle ? params.canToggle(group.path) : true;
    return (
        <span className="mxt-ag-group" style={{ paddingInlineStart: `${group.level * 18}px` }}>
            {!toggleable && <span className="mxt-ag-tree__leaf" aria-hidden="true" />}
            {toggleable && (
                <button
                    ref={button}
                    type="button"
                    tabIndex={-1}
                    className={classNames("mxt-ag-group__toggle", { "mxt-ag-group__toggle--open": !collapsed })}
                    aria-expanded={!collapsed}
                    aria-label={`${group.caption}: ${group.label}`}
                >
                    <ChevronIcon />
                </button>
            )}
            {group.caption && <span className="mxt-ag-group__caption">{group.caption}</span>}
            <span className="mxt-ag-group__label">{group.label}</span>
            <span className="mxt-ag-group__count" aria-label={`${group.count} rows`}>
                {params.formatCount(group.count)}
            </span>
        </span>
    );
}
