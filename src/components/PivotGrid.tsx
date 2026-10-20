import { ReactElement, useCallback, useMemo, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import {
    ColDef,
    ColGroupDef,
    GridApi,
    RowClassParams,
    SortChangedEvent,
    Theme,
    ValueGetterParams
} from "ag-grid-community";

import type { GridRow } from "../utils/rows";
import { CollapseState, isCollapsed, toggleCollapsed } from "../utils/grouping";
import { PIVOT_GROUP_COLUMN_ID, PivotResult, flattenPivot } from "../utils/pivot";
import { GroupCell } from "./GroupCell";

export interface PivotGridProps {
    result: PivotResult;
    theme: Theme;
    localeText?: Record<string, string>;
    groupHeader: string;
    totalLabel: string;
    domLayout: "normal" | "autoHeight" | "print";
    rowHeight?: number;
    headerHeight?: number;
    rtl: boolean;
    formatCount: (count: number) => string;
    /** Notices from the pivot (too many columns). */
    notice?: string;
    onAnnounce: (text: string) => void;
    onReady?: (api: GridApi<GridRow>) => void;
}

/** Keeps the order the pivot computed: sorting is applied to siblings by flattenPivot. */
const KEEP_ORDER = (): number => 0;

/** Read-only grid that shows a pivot table (rows with subtotals, generated value columns, totals). */
export function PivotGrid(props: PivotGridProps): ReactElement {
    const { result, onAnnounce } = props;
    const [collapse, setCollapse] = useState<CollapseState>({ mode: "expanded", exceptions: new Set() });
    const [sort, setSort] = useState<{ colId: string; direction: "asc" | "desc" } | undefined>(undefined);
    const rows = useMemo(() => flattenPivot(result.rows, collapse, sort), [result.rows, collapse, sort]);
    const hasChildren = useMemo(() => {
        const parents = new Set<string>();
        result.rows.forEach(row => {
            const keys = row.group ? (JSON.parse(row.group.path) as string[]) : [];
            if (keys.length > 1) {
                parents.add(JSON.stringify(keys.slice(0, -1)));
            }
        });
        return parents;
    }, [result.rows]);

    const isGroupCollapsed = useCallback((path: string) => isCollapsed(collapse, path), [collapse]);
    const toggle = useCallback(
        (path: string) => {
            if (!hasChildren.has(path)) {
                return;
            }
            const opening = isCollapsed(collapse, path);
            setCollapse(previous => toggleCollapsed(previous, path));
            onAnnounce(opening ? "Group expanded" : "Group collapsed");
        },
        [collapse, hasChildren, onAnnounce]
    );

    const columnDefs = useMemo<Array<ColDef<GridRow> | ColGroupDef<GridRow>>>(() => {
        const groupColumn: ColDef<GridRow> = {
            colId: PIVOT_GROUP_COLUMN_ID,
            headerName: props.groupHeader,
            pinned: props.rtl ? "right" : "left",
            minWidth: 180,
            width: 240,
            sortable: true,
            comparator: KEEP_ORDER,
            cellDataType: false,
            suppressMovable: true,
            valueGetter: (params: ValueGetterParams<GridRow>) => params.data?.group?.label ?? "",
            cellRenderer: GroupCell,
            cellRendererParams: {
                isCollapsed: (path: string) => (hasChildren.has(path) ? isGroupCollapsed(path) : false),
                canToggle: (path: string) => hasChildren.has(path),
                onToggle: toggle,
                formatCount: props.formatCount
            },
            cellClass: "mxt-ag-group-cell",
            suppressKeyboardEvent: params => {
                const key = params.event.key;
                const row = params.data;
                if (params.event.type !== "keydown" || !row?.group || !hasChildren.has(row.group.path)) {
                    return false;
                }
                const closed = isGroupCollapsed(row.group.path);
                const hit =
                    key === "Enter" ||
                    key === " " ||
                    (key === "ArrowRight" && closed) ||
                    (key === "ArrowLeft" && !closed);
                if (hit) {
                    params.event.preventDefault();
                    toggle(row.group.path);
                }
                return hit;
            }
        };
        const leaf = (column: PivotResult["columns"][number]): ColDef<GridRow> => {
            const pinned = column.total && result.columns.length > 8;
            return {
                colId: column.id,
                headerName: column.header,
                headerTooltip: [...column.keys, column.header].join(" / "),
                minWidth: 110,
                // Pinned total columns keep a fixed width: with flex they grow and squeeze the scrolling value columns.
                // flex must be null, not undefined: AG Grid keeps the previous flex of a column on a definition update.
                ...(pinned ? { width: 150, flex: null } : { flex: 1 }),
                sortable: true,
                comparator: KEEP_ORDER,
                cellDataType: false,
                type: "rightAligned",
                pinned: pinned ? (props.rtl ? "left" : "right") : undefined,
                cellClass: column.total ? "mxt-ag-align-right mxt-ag-pivot-total" : "mxt-ag-align-right",
                valueGetter: (params: ValueGetterParams<GridRow>) => params.data?.cells[column.id]?.value,
                valueFormatter: params => params.data?.cells[column.id]?.display ?? ""
            };
        };
        // Nest the value columns under their column-label values.
        const defs: Array<ColDef<GridRow> | ColGroupDef<GridRow>> = [groupColumn];
        result.columns.forEach(column => {
            if (column.keys.length === 0) {
                defs.push(leaf(column));
                return;
            }
            let siblings = defs;
            column.keys.forEach((key, level) => {
                const last = siblings[siblings.length - 1] as ColGroupDef<GridRow> | undefined;
                const groupId = `pg_${JSON.stringify(column.keys.slice(0, level + 1))}`;
                if (last && "children" in last && last.groupId === groupId) {
                    siblings = last.children;
                } else {
                    const group: ColGroupDef<GridRow> = { headerName: key, groupId, children: [] };
                    siblings.push(group);
                    siblings = group.children;
                }
            });
            siblings.push(leaf(column));
        });
        return defs;
    }, [result.columns, props.groupHeader, props.rtl, props.formatCount, hasChildren, isGroupCollapsed, toggle]);

    const handleSortChanged = useCallback((event: SortChangedEvent<GridRow>) => {
        const sorted = event.api.getColumnState().find(state => state.sort);
        setSort(sorted ? { colId: sorted.colId, direction: sorted.sort as "asc" | "desc" } : undefined);
    }, []);

    const getRowClass = useCallback((params: RowClassParams<GridRow>) => {
        if (params.data?.totals) {
            return "mxt-ag-row-totals";
        }
        return params.data?.group ? `mxt-ag-row-group mxt-ag-row-group--level-${params.data.group.level}` : undefined;
    }, []);

    return (
        <div className="mxt-ag-pivot">
            {props.notice && (
                <div className="mxt-ag-pivot__notice" role="status">
                    {props.notice}
                </div>
            )}
            <AgGridReact<GridRow>
                theme={props.theme}
                localeText={props.localeText}
                columnDefs={columnDefs}
                rowData={rows}
                getRowId={params => params.data.id}
                pinnedBottomRowData={result.grandTotal ? [result.grandTotal] : undefined}
                domLayout={props.domLayout}
                rowHeight={props.rowHeight}
                headerHeight={props.headerHeight}
                enableRtl={props.rtl}
                getRowClass={getRowClass}
                suppressDragLeaveHidesColumns
                onSortChanged={handleSortChanged}
                onGridReady={event => props.onReady?.(event.api)}
                defaultColDef={{ resizable: true, suppressHeaderMenuButton: true }}
            />
        </div>
    );
}
