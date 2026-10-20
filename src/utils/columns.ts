import {
    CellClassParams,
    CellStyle,
    ColDef,
    ColGroupDef,
    EditableCallbackParams,
    ICellRendererParams,
    ITooltipParams,
    ValueFormatterParams,
    ValueGetterParams,
    ValueSetterParams
} from "ag-grid-community";

import { ObjectItem } from "mendix";

import { ColumnsType, FilterTypeEnum } from "../../typings/AGGridProps";
import {
    BadgeCellRenderer,
    ImageCellRenderer,
    LinkCellRenderer,
    ProgressCellRenderer,
    SparklineCellRenderer
} from "../components/CellRenderers";
import { GroupCell, GroupCellParams } from "../components/GroupCell";
import { TreeCell, TreeCellParams } from "../components/TreeCell";
import { SetColumnFilter, SetFilterParams, SetFloatingFilter } from "../components/SetFilter";
import type { UiTexts } from "./texts";
import type { CommitMonitor } from "./commitTracker";
import { DetailToggleCell, DetailToggleParams } from "../components/DetailRow";
import { DgFloatingFilter, DgFloatingFilterParams } from "../components/DgFloatingFilter";
import { SelectFloatingFilter, SelectFloatingFilterParams } from "../components/SelectFloatingFilter";
import {
    CellKind,
    GridRow,
    cellKind,
    columnId,
    enumCaptions,
    formatValue,
    toGridValue,
    toMendixValue,
    writeValue
} from "./rows";
import { DETAIL_COLUMN_ID } from "./detailRows";
import { cellError } from "./validation";
import { ColumnRange, formatCell, hasConditionalFormat } from "./conditional";
import { GROUP_COLUMN_ID } from "./grouping";
import { TREE_COLUMN_ID } from "./tree";

export const ROW_NUMBER_COLUMN_ID = "__mxt_rownum__";
/** Minimum width of a flex column when the page leaves "Min width" at 0. */
const FLEX_MIN_WIDTH = 120;

function TotalsCellRenderer(params: ICellRendererParams<GridRow>): string {
    return params.valueFormatted ?? "";
}

const RENDERERS = {
    link: LinkCellRenderer,
    badge: BadgeCellRenderer,
    progress: ProgressCellRenderer,
    image: ImageCellRenderer,
    sparkline: SparklineCellRenderer
} as const;

/** Totals and group header rows show precomputed aggregate texts instead of item values. */
function isSummaryRow(row: GridRow | undefined): boolean {
    return Boolean(row?.totals || row?.group);
}

/** Aggregated text of a tree parent for a column, when it shows the aggregates of its descendants. */
function aggregatedDisplay(row: GridRow | undefined, id: string): string | undefined {
    const cell = row?.aggCells?.[id];
    return cell && cell.display ? cell.display : undefined;
}

export interface ColumnBuildOptions {
    columns: ColumnsType[];
    /** Always points at the newest column props, so memoized definitions never read stale Mendix values. */
    latest: () => ColumnsType[];
    /** The data source items currently loaded, used to resolve attribute names when writing values. */
    latestItems: () => ObjectItem[];
    showRowNumbers: boolean;
    rowDrag: boolean;
    flashOnChange: boolean;
    /** Server mode: only attribute columns can sort and filter, because the data source does the work. */
    serverMode: boolean;
    /** Commit the object right after an inline edit. */
    commit: boolean;
    /** Called after a value was written to the Mendix object (before the commit / On commit action). */
    onWritten?: (row: GridRow, attributeName: string, oldValue: unknown, newValue: unknown) => void;
    /** Atlas theme: floating filters in the Data Grid 2 style (operator button + input, dropdowns). */
    dg2Filters: boolean;
    /** Adds the chevron column that expands detail rows. */
    detail?: DetailToggleParams;
    /** Row number of a row while detail rows are shown (they must not count); undefined uses the row index. */
    rowNumber?: (row: GridRow) => number | undefined;
    /** Adds the group column (row grouping is active). */
    group?: GroupCellParams & { header: string };
    /** Lowest and highest value of the conditionally formatted columns. */
    formatRanges?: () => Map<string, ColumnRange>;
    /** Adds the tree column (tree data is on). */
    tree?: TreeCellParams & { header: string };
    /** Texts of the set filter. */
    texts?: () => UiTexts;
    /** Users can change the function of a totals cell (adds a class to those cells). */
    totalsMenu?: boolean;
    /** Tracks the save of an inline edit (slow and failed saves are shown with Retry and Discard). */
    commitMonitor?: (row: GridRow, colId: string, oldValue: unknown, newValue: unknown) => CommitMonitor | undefined;
}

export interface ColumnBuildResult {
    columnDefs: Array<ColDef<GridRow> | ColGroupDef<GridRow>>;
    /** Columns configured with width mode "auto"; sized to their content once data is rendered. */
    autoSizeColumnIds: string[];
}

function resolveFilter(filterType: FilterTypeEnum, kind: CellKind): string | false {
    if (kind === "object" || filterType === "none") {
        return false;
    }
    const resolved = filterType === "auto" ? kind : filterType;
    switch (resolved) {
        case "number":
            return "agNumberColumnFilter";
        case "date":
            return "agDateColumnFilter";
        default:
            return "agTextColumnFilter";
    }
}

function resolveEditor(kind: CellKind): string | undefined {
    switch (kind) {
        case "number":
            return "agNumberCellEditor";
        case "date":
            return "agDateCellEditor";
        case "boolean":
            return "agCheckboxCellEditor";
        case "enum":
            return "agSelectCellEditor";
        case "text":
            return "agTextCellEditor";
        default:
            return undefined;
    }
}

function alignmentClass(column: ColumnsType, kind: CellKind): string | undefined {
    const alignment =
        column.alignment === "auto"
            ? kind === "number"
                ? "right"
                : kind === "boolean"
                ? "center"
                : "left"
            : column.alignment;
    return alignment === "left" ? undefined : `mxt-ag-align-${alignment}`;
}

function compareText(a: unknown, b: unknown): number {
    if (a === b) {
        return 0;
    }
    if (a === undefined || a === null || a === "") {
        return -1;
    }
    if (b === undefined || b === null || b === "") {
        return 1;
    }
    return String(a).localeCompare(String(b), undefined, { sensitivity: "base", numeric: true });
}

function buildColDef(column: ColumnsType, index: number, options: ColumnBuildOptions): ColDef<GridRow> {
    const id = columnId(index);
    const kind = cellKind(column);
    const attribute = column.attribute;
    const live = (): ColumnsType => options.latest()[index] ?? column;
    const headerName = column.header?.value ?? "";
    const isData = kind !== "object";
    const captions = kind === "enum" && attribute ? enumCaptions(attribute) : undefined;
    const alignClass = alignmentClass(column, kind);
    const numberFormat = { precision: column.decimalPrecision, groupDigits: column.groupDigits };

    const def: ColDef<GridRow> = {
        colId: id,
        headerName,
        headerTooltip: headerName || undefined,
        sortable: isData && column.sortable,
        resizable: column.resizable,
        suppressMovable: !column.movable,
        pinned: column.pinned === "none" ? null : column.pinned,
        hide: column.visible?.value === false,
        wrapText: column.wrapText,
        autoHeight: column.autoHeight,
        enableCellChangeFlash: options.flashOnChange && isData,
        // Enumerations and booleans are typed as text so the text filter can match their captions.
        cellDataType: isData ? (kind === "enum" || kind === "boolean" ? "text" : kind) : false,
        valueGetter: (params: ValueGetterParams<GridRow>) => params.data?.cells[id]?.value,
        valueFormatter: (params: ValueFormatterParams<GridRow>) =>
            isSummaryRow(params.data)
                ? params.data?.cells[id]?.display ?? ""
                : aggregatedDisplay(params.data, id) ?? formatValue(attribute, kind, params.value, numberFormat),
        filter: resolveFilter(column.filterType, kind),
        cellClass: (params: CellClassParams<GridRow>) => {
            const classes: string[] = [];
            if (alignClass) {
                classes.push(alignClass);
            }
            if (options.totalsMenu && params.data?.totals) {
                classes.push("mxt-ag-totals-cell");
            }
            if (aggregatedDisplay(params.data, id)) {
                classes.push("mxt-ag-cell-aggregated");
            }
            const item = params.data?.item;
            if (cellError(params.data?.cells[id])) {
                classes.push("mxt-ag-cell-invalid");
            }
            const cellClass = live().cellClass;
            if (item && cellClass) {
                const dynamic = cellClass.get(item).value;
                if (dynamic) {
                    classes.push(dynamic);
                }
            }
            return classes;
        },
        tooltipValueGetter: (params: ITooltipParams<GridRow>) => {
            const validation = cellError(params.data?.cells[id]);
            if (validation) {
                return validation;
            }
            const item = params.data?.item;
            const tooltip = live().tooltip;
            return item && tooltip ? tooltip.get(item).value : undefined;
        }
    };

    switch (column.widthMode) {
        case "fixed":
            def.width = column.width > 0 ? column.width : 150;
            break;
        case "flex":
            def.flex = column.flex > 0 ? column.flex : 1;
            // Without a floor a flex column collapses to a few pixels as soon as the fixed columns
            // fill the viewport; keep it readable unless the page sets its own minimum.
            if (column.minWidth <= 0) {
                def.minWidth = FLEX_MIN_WIDTH;
            }
            break;
        default:
            // "auto": sized to content once the first data renders.
            break;
    }
    if (column.minWidth > 0) {
        def.minWidth = column.minWidth;
    }
    if (column.maxWidth > 0) {
        def.maxWidth = column.maxWidth;
    }

    if (column.columnType === "customContent") {
        def.cellRenderer = (params: { data?: GridRow }) => {
            if (isSummaryRow(params.data)) {
                return params.data?.cells[id]?.display ?? "";
            }
            const content = live().content;
            return params.data?.item && content ? content.get(params.data.item) : null;
        };
        def.cellClass = (params: CellClassParams<GridRow>) => {
            const classes = alignClass ? [alignClass, "mxt-ag-cell-custom"] : ["mxt-ag-cell-custom"];
            if (cellError(params.data?.cells[id])) {
                classes.push("mxt-ag-cell-invalid");
            }
            return classes;
        };
        return def;
    }

    if (kind === "text" || kind === "enum" || kind === "boolean") {
        // Filter and search on what the user sees (captions, Yes/No) rather than raw keys.
        def.filterValueGetter = (params: ValueGetterParams<GridRow>) => params.data?.cells[id]?.display ?? "";
        def.getQuickFilterText = params => params.data?.cells[id]?.display ?? "";
    }
    if (kind === "boolean") {
        def.cellRenderer = "agCheckboxCellRenderer";
        def.cellRendererParams = {
            disabled: (params: ICellRendererParams<GridRow>) =>
                !params.node || !params.column || !params.column.isCellEditable(params.node)
        };
        // The checkbox renderer cannot show a count or a label on the totals row.
        def.cellRendererSelector = (params: ICellRendererParams<GridRow>) =>
            isSummaryRow(params.data) ? { component: TotalsCellRenderer } : undefined;
    }
    if (column.renderAs && column.renderAs !== "text") {
        def.cellRenderer = RENDERERS[column.renderAs];
        def.cellRendererParams = undefined;
        def.cellRendererSelector = (params: ICellRendererParams<GridRow>) =>
            isSummaryRow(params.data) ? { component: TotalsCellRenderer } : undefined;
        def.cellClass = (params: CellClassParams<GridRow>) => {
            const classes = [`mxt-ag-cell-${column.renderAs}`];
            if (alignClass) {
                classes.push(alignClass);
            }
            if (cellError(params.data?.cells[id])) {
                classes.push("mxt-ag-cell-invalid");
            }
            const item = params.data?.item;
            const cellClass = live().cellClass;
            const dynamic = item && cellClass ? cellClass.get(item).value : undefined;
            return dynamic ? [...classes, dynamic] : classes;
        };
    }
    const setParams: SetFilterParams | undefined =
        column.filterType === "set" && def.filter && options.texts
            ? {
                  colId: id,
                  fixed:
                      kind === "enum" && captions
                          ? Object.values(captions)
                          : kind === "boolean" && attribute
                          ? [formatValue(attribute, "boolean", true), formatValue(attribute, "boolean", false)]
                          : undefined,
                  fixedOnly: options.serverMode,
                  texts: options.texts
              }
            : undefined;
    // With server data loading only enumeration and boolean values are known; other types keep a text filter.
    const serverSetFallback = options.serverMode && setParams && kind !== "enum" && kind !== "boolean";
    if (setParams && !serverSetFallback) {
        def.filter = SetColumnFilter;
        def.filterParams = setParams;
        def.floatingFilterComponent = SetFloatingFilter;
        def.floatingFilterComponentParams = { ...setParams, suppressFilterButton: options.dg2Filters };
    } else if ((kind === "enum" || kind === "boolean") && attribute && def.filter) {
        // Dropdown of captions instead of a free text floating filter, like the Data Grid 2 drop-down filter.
        const values =
            kind === "enum" && captions
                ? Object.values(captions)
                : [formatValue(attribute, "boolean", true), formatValue(attribute, "boolean", false)];
        def.floatingFilterComponent = SelectFloatingFilter;
        def.floatingFilterComponentParams = {
            values,
            dg2: options.dg2Filters,
            suppressFilterButton: options.dg2Filters
        } satisfies SelectFloatingFilterParams & { suppressFilterButton: boolean };
    } else if (options.dg2Filters && def.filter && (kind === "text" || kind === "number" || kind === "date")) {
        def.floatingFilterComponent = DgFloatingFilter;
        def.floatingFilterComponentParams = { kind } satisfies DgFloatingFilterParams;
    }
    if (options.dg2Filters && def.filter) {
        // The operator button replaces the AG Grid funnel button; Data Grid 2 has no header menu icons either.
        def.suppressFloatingFilterButton = true;
        def.suppressHeaderMenuButton = true;
        def.suppressHeaderFilterButton = true;
    }
    if (options.serverMode && column.columnType !== "attribute") {
        // The data source cannot sort or filter on expressions.
        def.sortable = false;
        def.filter = false;
    }
    if (options.serverMode && attribute && !attribute.sortable) {
        def.sortable = false;
    }
    if (options.serverMode && attribute && !attribute.filterable) {
        def.filter = false;
    }
    if (kind === "enum" && captions) {
        def.comparator = (a, b) => compareText(captions[String(a)] ?? a, captions[String(b)] ?? b);
        def.cellEditorParams = { values: Object.keys(captions) };
    } else if (kind === "text") {
        def.comparator = compareText;
    }

    if (attribute && column.editable && column.columnType === "attribute") {
        def.editable = (params: EditableCallbackParams<GridRow>) => {
            const row = params.data;
            const editable = live().editable;
            return Boolean(row?.item && !row.snapshot && editable && editable.get(row.item).value === true);
        };
        def.cellEditor = resolveEditor(kind);
        def.valueSetter = (params: ValueSetterParams<GridRow>) => {
            const row = params.data;
            const liveAttribute = live().attribute ?? attribute;
            if (!row?.item) {
                return false;
            }
            const next = toMendixValue(kind, params.newValue);
            const nextGrid = toGridValue(next);
            const current = row.cells[id]?.value;
            const unchanged =
                nextGrid === current ||
                (nextGrid instanceof Date && current instanceof Date && nextGrid.getTime() === current.getTime());
            if (unchanged) {
                return false;
            }
            const attributeName = live().attributeName?.trim() || undefined;
            const written = writeValue(liveAttribute, row.item, kind, next, options.latestItems(), {
                commit: options.commit,
                attributeName,
                monitor: options.commitMonitor?.(row, id, current, nextGrid),
                onWritten: name => options.onWritten?.(row, name, current, nextGrid)
            });
            if (!written) {
                return false;
            }
            // Mirror the edit locally so the cell shows the new value before Mendix pushes new props.
            const value = liveAttribute.get(row.item);
            row.cells[id] = {
                value: nextGrid,
                display: formatValue(attribute, kind, nextGrid, numberFormat),
                validation: value.validation,
                readOnly: value.readOnly
            };
            return true;
        };
    }

    return def;
}

function isDataRow(row: GridRow | undefined): row is GridRow {
    return Boolean(row && row.item && !row.totals && !row.detail && !row.group);
}

const NO_FORMAT_STYLE: CellStyle = { backgroundImage: "", backgroundColor: "" };

/** Data bars, color scales and icon sets on number columns (Conditional format). */
function applyConditionalFormat(
    def: ColDef<GridRow>,
    column: ColumnsType,
    id: string,
    options: ColumnBuildOptions
): void {
    if (!hasConditionalFormat(column) || !options.formatRanges) {
        return;
    }
    const ranges = options.formatRanges;
    const format = (params: CellClassParams<GridRow>): ReturnType<typeof formatCell> =>
        isDataRow(params.data)
            ? formatCell(
                  column.conditionalFormat,
                  params.data.cells[id]?.value,
                  ranges().get(id),
                  column.formatColor ?? "",
                  column.formatReverse
              )
            : {};
    // AG Grid keeps style keys that a later result leaves out, so every key is always set.
    def.cellStyle = params => ({ ...NO_FORMAT_STYLE, ...(format(params).style ?? {}) } as CellStyle);
    const baseClass = def.cellClass;
    def.cellClass = (params: CellClassParams<GridRow>) => {
        const base = typeof baseClass === "function" ? baseClass(params) : baseClass;
        const list = base === undefined || base === null ? [] : Array.isArray(base) ? [...base] : [base];
        const extra = format(params).className;
        return extra ? [...list, extra] : list;
    };
}

function groupColumn(group: GroupCellParams & { header: string }): ColDef<GridRow> {
    return {
        colId: GROUP_COLUMN_ID,
        headerName: group.header,
        width: 260,
        minWidth: 160,
        pinned: "left",
        lockPosition: "left",
        lockPinned: true,
        sortable: false,
        resizable: true,
        suppressMovable: true,
        filter: false,
        cellDataType: false,
        suppressHeaderMenuButton: true,
        cellClass: "mxt-ag-group-cell",
        valueGetter: (params: ValueGetterParams<GridRow>) => params.data?.group?.label ?? "",
        cellRenderer: GroupCell,
        cellRendererParams: group,
        // Enter and Space toggle a group; ArrowRight opens and ArrowLeft closes it.
        suppressKeyboardEvent: params => {
            const key = params.event.key;
            const row = params.data;
            if (params.editing || params.event.type !== "keydown" || !row?.group) {
                return false;
            }
            const collapsed = group.isCollapsed(row.group.path);
            const toggle =
                key === "Enter" ||
                key === " " ||
                (key === "ArrowRight" && collapsed) ||
                (key === "ArrowLeft" && !collapsed);
            if (!toggle) {
                return false;
            }
            params.event.preventDefault();
            group.onToggle(row.group.path);
            return true;
        }
    };
}

function treeColumn(tree: TreeCellParams & { header: string }): ColDef<GridRow> {
    return {
        colId: TREE_COLUMN_ID,
        headerName: tree.header,
        width: 280,
        minWidth: 160,
        pinned: "left",
        lockPosition: "left",
        lockPinned: true,
        sortable: false,
        resizable: true,
        suppressMovable: true,
        filter: false,
        cellDataType: false,
        suppressHeaderMenuButton: true,
        cellClass: "mxt-ag-tree-cell",
        valueGetter: (params: ValueGetterParams<GridRow>) => params.data?.tree?.label ?? "",
        getQuickFilterText: params => params.data?.tree?.label ?? "",
        cellRenderer: TreeCell,
        cellRendererParams: tree,
        // Enter and Space toggle a parent; ArrowRight opens and ArrowLeft closes it.
        suppressKeyboardEvent: params => {
            const key = params.event.key;
            const info = params.data?.tree;
            if (params.editing || params.event.type !== "keydown" || !info?.hasChildren) {
                return false;
            }
            if (params.event.shiftKey || params.event.ctrlKey || params.event.metaKey || params.event.altKey) {
                return false;
            }
            const open = tree.isOpen(info.key, info.level);
            const toggle =
                key === "Enter" || key === " " || (key === "ArrowRight" && !open) || (key === "ArrowLeft" && open);
            if (!toggle) {
                return false;
            }
            params.event.preventDefault();
            tree.onToggle(info.key);
            return true;
        }
    };
}

function detailColumn(detail: DetailToggleParams): ColDef<GridRow> {
    return {
        colId: DETAIL_COLUMN_ID,
        headerName: "",
        width: 44,
        minWidth: 44,
        maxWidth: 44,
        pinned: "left",
        lockPosition: "left",
        lockPinned: true,
        sortable: false,
        resizable: false,
        suppressMovable: true,
        filter: false,
        cellDataType: false,
        suppressHeaderMenuButton: true,
        cellClass: "mxt-ag-detail-cell",
        valueGetter: (params: ValueGetterParams<GridRow>) =>
            isDataRow(params.data) ? (detail.isExpanded(params.data.id) ? 1 : 0) : undefined,
        cellRenderer: DetailToggleCell,
        cellRendererParams: detail,
        // Enter and Space on the chevron cell toggle the detail row instead of editing or selecting.
        suppressKeyboardEvent: params => {
            const key = params.event.key;
            if (params.editing || params.event.type !== "keydown" || (key !== "Enter" && key !== " ")) {
                return false;
            }
            if (!isDataRow(params.data)) {
                return false;
            }
            params.event.preventDefault();
            detail.onToggle(params.data.id);
            return true;
        }
    };
}

function rowNumberColumn(rowNumber?: (row: GridRow) => number | undefined): ColDef<GridRow> {
    return {
        colId: ROW_NUMBER_COLUMN_ID,
        headerName: "#",
        width: 64,
        minWidth: 48,
        pinned: "left",
        lockPosition: "left",
        lockPinned: true,
        sortable: false,
        resizable: true,
        suppressMovable: true,
        filter: false,
        cellDataType: false,
        suppressNavigable: true,
        cellClass: "mxt-ag-rownum",
        valueGetter: (params: ValueGetterParams<GridRow>) => {
            if (params.node?.rowPinned || params.node?.rowIndex == null || params.data?.group) {
                return "";
            }
            const number = params.data && rowNumber ? rowNumber(params.data) : undefined;
            return number ?? params.node.rowIndex + 1;
        }
    };
}

/** Builds the column definitions, grouping adjacent columns that share a header group caption. */
export function buildColumnDefs(options: ColumnBuildOptions): ColumnBuildResult {
    const autoSizeColumnIds: string[] = [];
    const leaves: Array<{ group: string; def: ColDef<GridRow> }> = [];

    if (options.showRowNumbers) {
        leaves.push({ group: "", def: rowNumberColumn(options.rowNumber) });
    }
    if (options.group) {
        leaves.push({ group: "", def: groupColumn(options.group) });
    }
    if (options.tree) {
        leaves.push({ group: "", def: treeColumn(options.tree) });
    }
    if (options.detail) {
        leaves.push({ group: "", def: detailColumn(options.detail) });
    }
    options.columns.forEach((column, index) => {
        const def = buildColDef(column, index, options);
        applyConditionalFormat(def, column, def.colId as string, options);
        if (column.widthMode === "auto") {
            autoSizeColumnIds.push(def.colId as string);
        }
        leaves.push({ group: column.headerGroup?.trim() ?? "", def });
    });

    if (options.rowDrag && leaves.length > 0) {
        // The drag handle stays in the first column, unless that is the chevron column of the detail rows.
        const first =
            leaves.find(
                leaf =>
                    leaf.def.colId !== DETAIL_COLUMN_ID &&
                    leaf.def.colId !== GROUP_COLUMN_ID &&
                    leaf.def.colId !== TREE_COLUMN_ID
            ) ?? leaves[0];
        first.def.rowDrag = true;
    }

    const columnDefs: Array<ColDef<GridRow> | ColGroupDef<GridRow>> = [];
    leaves.forEach(({ group, def }) => {
        const previous = columnDefs[columnDefs.length - 1];
        if (group && previous && "children" in previous && previous.headerName === group) {
            previous.children.push(def);
        } else if (group) {
            columnDefs.push({ headerName: group, groupId: `group_${columnDefs.length}`, children: [def] });
        } else {
            columnDefs.push(def);
        }
    });

    return { columnDefs, autoSizeColumnIds };
}
