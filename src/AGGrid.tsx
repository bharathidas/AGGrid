import { KeyboardEvent, ReactElement, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import {
    CellApiModule,
    CellClickedEvent,
    CellStyleModule,
    CellValueChangedEvent,
    CheckboxEditorModule,
    ClientSideRowModelApiModule,
    ClientSideRowModelModule,
    ColDef,
    ColumnApiModule,
    ColumnAutoSizeModule,
    ColumnHoverModule,
    ColumnState,
    CsvExportModule,
    CustomFilterModule,
    DateEditorModule,
    DateFilterModule,
    EventApiModule,
    FirstDataRenderedEvent,
    GridApi,
    GridReadyEvent,
    GridStateModule,
    HighlightChangesModule,
    IDatasource,
    IGetRowsParams,
    IRowNode,
    InfiniteRowModelModule,
    LocaleModule,
    ModuleRegistry,
    NumberEditorModule,
    NumberFilterModule,
    PaginationChangedEvent,
    PaginationModule,
    PinnedRowModule,
    QuickFilterModule,
    RenderApiModule,
    RowApiModule,
    RowAutoHeightModule,
    RowClassParams,
    RowDoubleClickedEvent,
    RowDragEndEvent,
    RowDragModule,
    RowSelectionModule,
    RowSelectionOptions,
    RowStyleModule,
    ScrollApiModule,
    SelectEditorModule,
    SelectionChangedEvent,
    SizeColumnsToContentStrategy,
    SizeColumnsToFitGridStrategy,
    TextEditorModule,
    TextFilterModule,
    TooltipModule,
    ValidationModule
} from "ag-grid-community";
import classNames from "classnames";
import { Big } from "big.js";
import { ObjectItem } from "mendix";

import { ColumnsType, AGGridContainerProps } from "../typings/AGGridProps";
import { ColumnChooser, ChooserColumn } from "./components/ColumnChooser";
import { Pager, PagerState } from "./components/Pager";
import { Toolbar } from "./components/Toolbar";
import { ROW_NUMBER_COLUMN_ID, buildColumnDefs } from "./utils/columns";
import { localeTextFor, sessionLocale } from "./utils/locale";
import { GridRow, buildRow, buildRows, cellKind, writeValue } from "./utils/rows";
import { ExcelCell, ExcelColumn, ExcelColumnType, buildXlsx, downloadFile } from "./utils/xlsx";
import { FilterModel, buildFilter, buildSortOrder } from "./utils/serverFilters";
import { buildTheme } from "./utils/theme";
import { computeTotalsFromRows, totalsFromItem } from "./utils/totals";

import "./ui/AGGrid.css";

// Only the AG Grid modules the widget uses are bundled, which keeps the package small.
ModuleRegistry.registerModules([
    ClientSideRowModelModule,
    ClientSideRowModelApiModule,
    InfiniteRowModelModule,
    TextFilterModule,
    NumberFilterModule,
    DateFilterModule,
    CustomFilterModule,
    QuickFilterModule,
    TextEditorModule,
    NumberEditorModule,
    DateEditorModule,
    CheckboxEditorModule,
    SelectEditorModule,
    RowSelectionModule,
    PaginationModule,
    CsvExportModule,
    RowDragModule,
    PinnedRowModule,
    ColumnAutoSizeModule,
    ColumnApiModule,
    RowApiModule,
    CellApiModule,
    CellStyleModule,
    RowStyleModule,
    RowAutoHeightModule,
    TooltipModule,
    HighlightChangesModule,
    EventApiModule,
    RenderApiModule,
    ScrollApiModule,
    ColumnHoverModule,
    LocaleModule,
    GridStateModule,
    // eslint-disable-next-line no-undef
    ...(process.env.NODE_ENV === "production" ? [] : [ValidationModule])
]);

const COLUMN_STATE_SOURCES_TO_IGNORE = new Set(["api", "gridInitializing", "flex", "autosizeColumns"]);
const SELECTION_COLUMN_ID = "ag-Grid-SelectionColumn";
const UNDO_SOURCE = "mxtUndoRedo";
/** Upper bound for rows fetched from the server for an export. */
const EXPORT_ROW_LIMIT = 50000;
const CSV_BOM = String.fromCharCode(0xfeff);

interface StateStore {
    read: () => string | undefined;
    write: (value: string) => void;
}

interface PersistedState {
    /** Identifies the column configuration the state was saved for. */
    signature?: string;
    columns?: ColumnState[];
    filters?: FilterModel;
    quickFilter?: string;
}

interface EditRecord {
    rowId: string;
    colId: string;
    oldValue: unknown;
    newValue: unknown;
}

interface PendingRequest {
    params: IGetRowsParams;
    offset: number;
    limit: number;
    sortOrder: string;
    filter: string;
}

function escapeHtml(text: string): string {
    return text.replace(/[&<>"']/g, char => `&#${char.charCodeAt(0)};`);
}

/** Static description of the column configuration; column definitions are only rebuilt when it changes. */
/** Column identity used to detect a remembered layout that belongs to an older column configuration. */
function stateSignatureFor(columns: ColumnsType[]): string {
    return columns
        .map(column => `${column.columnType}:${column.attribute?.id ?? column.header?.value ?? ""}`)
        .join("|");
}

function columnsKey(columns: ColumnsType[]): string {
    return JSON.stringify(
        columns.map(column => [
            column.columnType,
            column.attribute?.id,
            column.attribute?.type,
            column.attribute?.universe,
            column.header?.value,
            column.headerGroup,
            column.widthMode,
            column.flex,
            column.width,
            column.minWidth,
            column.maxWidth,
            column.sortable,
            column.filterType,
            Boolean(column.editable),
            column.pinned,
            column.visible?.value,
            column.resizable,
            column.movable,
            column.alignment,
            column.decimalPrecision,
            column.groupDigits,
            column.wrapText,
            column.autoHeight,
            column.aggregate,
            Boolean(column.tooltip),
            Boolean(column.cellClass)
        ])
    );
}

function parsePageSizes(text: string, pageSize: number): number[] | false {
    const sizes = text
        .split(",")
        .map(part => parseInt(part.trim(), 10))
        .filter(size => Number.isFinite(size) && size > 0);
    if (sizes.length === 0) {
        return false;
    }
    if (!sizes.includes(pageSize)) {
        sizes.push(pageSize);
    }
    return Array.from(new Set(sizes)).sort((a, b) => a - b);
}

/** Text form of a cell value for the New value / Old value action variables. */
function valueAsText(value: unknown): string {
    if (value === undefined || value === null) {
        return "";
    }
    if (value instanceof Date) {
        return value.toISOString();
    }
    return String(value);
}

function canRun(action: { canExecute: boolean; isExecuting: boolean } | undefined): boolean {
    return Boolean(action && action.canExecute && !action.isExecuting);
}

export function AGGrid(props: AGGridContainerProps): ReactElement {
    const {
        datasource,
        dataMode,
        rowLimit,
        refreshInterval,
        columns,
        selection,
        checkboxSelection,
        headerCheckbox,
        clickSelection,
        showQuickFilter,
        quickFilterPlaceholder,
        quickFilterAttribute,
        showExportButton,
        exportFormat,
        exportFileName,
        showResetButton,
        showRefreshButton,
        showColumnChooser,
        showSelectionCount,
        alwaysMultiSort,
        floatingFilters,
        pagination,
        pageSize,
        pageSizeSelector,
        autoPageSize,
        editType,
        singleClickEdit,
        commitMode,
        onCommit,
        undoRedo,
        enterNavigatesVertically,
        flashOnChange,
        autoSizeStrategy,
        stateStorage,
        columnStateAttribute,
        rowDrag: rowDragProp,
        rowDragAttribute,
        theme: themeName,
        colorScheme,
        accentColor,
        fontSize,
        spacing,
        layout,
        height,
        rowHeight,
        headerHeight,
        wrapHeaderText,
        showRowNumbers,
        animateRows,
        rowHoverHighlight,
        columnHoverHighlight,
        cellTextSelection,
        rowClass,
        totalsRow,
        totalsLabel,
        totalsSource,
        totalsDatasource,
        labelColumns,
        labelRefresh,
        labelReset,
        labelExportExcel,
        labelExportCsv,
        labelSelected,
        labelClearSelection,
        labelPageSize,
        labelPagingStatus,
        noRowsText,
        emptyPlaceholder,
        onRowClick,
        onRowDoubleClick,
        onCellValueChange,
        onRowDragEnd,
        class: className,
        style,
        tabIndex
    } = props;

    const serverMode = dataMode === "server";
    const rowDrag = rowDragProp && !serverMode;
    const commitOnEdit = commitMode === "client";
    const effectivePageSize = pageSize > 0 ? pageSize : 20;

    const apiRef = useRef<GridApi<GridRow> | null>(null);
    // Column definitions are memoized, so their callbacks read the latest column props through this ref.
    const columnsRef = useRef<ColumnsType[]>(columns);
    const itemsRef = useRef<ObjectItem[]>(datasource.items ?? []);
    const datasourceRef = useRef(datasource);
    useLayoutEffect(() => {
        columnsRef.current = columns;
        itemsRef.current = datasource.items ?? [];
        datasourceRef.current = datasource;
    });
    const getColumns = useCallback(() => columnsRef.current, []);
    const getItems = useCallback(() => itemsRef.current, []);

    // ---- On commit -------------------------------------------------------------------------
    // Runs the configured action with the changed object after an inline edit (or a row drag) wrote a value.
    const onCommitRef = useRef(onCommit);
    useLayoutEffect(() => {
        onCommitRef.current = onCommit;
    });
    const runOnCommit = useCallback(
        (item: ObjectItem, attributeName: string, oldValue: unknown, newValue: unknown) => {
            if (commitMode !== "action") {
                return;
            }
            const action = onCommitRef.current?.get(item);
            if (canRun(action)) {
                action?.execute({
                    newValue: valueAsText(newValue),
                    oldValue: valueAsText(oldValue),
                    attributeName
                });
            }
        },
        [commitMode]
    );
    const handleWritten = useCallback(
        (row: GridRow, attributeName: string, oldValue: unknown, newValue: unknown) => {
            if (row.item) {
                runOnCommit(row.item, attributeName, oldValue, newValue);
            }
        },
        [runOnCommit]
    );
    // Row order produced by dragging, kept until the data source itself delivers that order.
    const [dragOrder, setDragOrder] = useState<Map<string, number>>(() => new Map());

    // ---- Data (browser mode) ----------------------------------------------------------------
    useEffect(() => {
        if (!serverMode) {
            datasource.setLimit(rowLimit > 0 ? rowLimit : undefined);
        }
        // Only the settings matter; the data source object changes on every render.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [serverMode, rowLimit]);

    const items = datasource.items;
    const rows = useMemo(() => {
        const built = buildRows(items, columns);
        if (!rowDrag) {
            return built;
        }
        const position = (row: GridRow): number => {
            if (rowDragAttribute && row.item) {
                const value = rowDragAttribute.get(row.item).value;
                return value ? value.toNumber() : Number.MAX_SAFE_INTEGER;
            }
            return dragOrder.get(row.id) ?? Number.MAX_SAFE_INTEGER;
        };
        return built
            .map((row, index) => ({ row, index, order: position(row) }))
            .sort((a, b) => a.order - b.order || a.index - b.index)
            .map(entry => entry.row);
    }, [items, columns, rowDrag, rowDragAttribute, dragOrder]);

    // ---- Quick filter -----------------------------------------------------------------------
    // The search box owns the text, but when a search attribute is bound its value wins whenever it changes
    // (for example when another widget writes it). Adjusting state during render avoids an extra effect pass.
    const externalQuickFilter = quickFilterAttribute?.value;
    const [quickFilterState, setQuickFilterState] = useState<{ text: string; external?: string }>(() => ({
        text: externalQuickFilter ?? "",
        external: externalQuickFilter
    }));
    let quickFilter = quickFilterState.text;
    if (
        quickFilterAttribute &&
        externalQuickFilter !== undefined &&
        externalQuickFilter !== quickFilterState.external
    ) {
        quickFilter = externalQuickFilter;
        setQuickFilterState({ text: externalQuickFilter, external: externalQuickFilter });
    }
    const quickFilterRef = useRef(quickFilter);
    useLayoutEffect(() => {
        quickFilterRef.current = quickFilter;
    });
    const setQuickFilter = useCallback((text: string) => setQuickFilterState(previous => ({ ...previous, text })), []);

    // ---- Data (server mode): AG Grid infinite row model backed by the Mendix data source ---------
    const pendingRequest = useRef<PendingRequest | null>(null);
    const requestQueue = useRef<IGetRowsParams[]>([]);
    const reloadPending = useRef(false);
    const [serverEmpty, setServerEmpty] = useState(false);

    const processQueue = useCallback(() => {
        if (pendingRequest.current || requestQueue.current.length === 0) {
            return;
        }
        const params = requestQueue.current.shift() as IGetRowsParams;
        const ds = datasourceRef.current;
        const sortOrder = buildSortOrder(params.sortModel, columnsRef.current);
        const filter = buildFilter(params.filterModel as FilterModel, quickFilterRef.current, columnsRef.current);
        const limit = Math.max(1, params.endRow - params.startRow);
        pendingRequest.current = {
            params,
            offset: params.startRow,
            limit,
            sortOrder: JSON.stringify(sortOrder),
            filter: JSON.stringify(filter ?? null)
        };
        ds.setSortOrder(sortOrder);
        ds.setFilter(filter);
        ds.setOffset(params.startRow);
        ds.setLimit(limit);
        ds.requestTotalCount(true);
    }, []);

    const serverDatasource = useMemo<IDatasource>(
        () => ({
            getRows: params => {
                requestQueue.current.push(params);
                processQueue();
            }
        }),
        [processQueue]
    );

    // Resolve the pending block once the data source delivered exactly what was asked for.
    useEffect(() => {
        if (!serverMode) {
            return;
        }
        const api = apiRef.current;
        const pending = pendingRequest.current;
        if (reloadPending.current && datasource.status !== "loading") {
            reloadPending.current = false;
            api?.purgeInfiniteCache();
            return;
        }
        if (!pending) {
            // A change pushed by Mendix (an edit, a microflow): refresh the rows that are still loaded.
            const current = new Map<string, ObjectItem>((items ?? []).map(item => [String(item.id), item]));
            api?.forEachNode(node => {
                const item = node.data && current.get(node.data.id);
                if (item) {
                    node.setData(buildRow(item, columnsRef.current));
                }
            });
            return;
        }
        if (datasource.status !== "available") {
            return;
        }
        const matches =
            datasource.offset === pending.offset &&
            datasource.limit === pending.limit &&
            JSON.stringify(datasource.sortOrder) === pending.sortOrder &&
            JSON.stringify(datasource.filter ?? null) === pending.filter;
        if (!matches) {
            return;
        }
        const block = buildRows(items, columnsRef.current);
        const total = datasource.totalCount;
        const lastRow = total !== undefined ? total : block.length < pending.limit ? pending.offset + block.length : -1;
        pendingRequest.current = null;
        pending.params.successCallback(block, lastRow);
        if (pending.offset === 0) {
            setServerEmpty(block.length === 0);
            if (block.length === 0) {
                api?.showNoRowsOverlay();
            } else {
                api?.hideOverlay();
            }
        }
        processQueue();
    }, [serverMode, datasource, items, processQueue]);

    // Quick search in server mode goes to the data source: refetch after the user stops typing.
    const quickFilterTimer = useRef<number | undefined>(undefined);
    useEffect(() => {
        if (!serverMode) {
            return;
        }
        window.clearTimeout(quickFilterTimer.current);
        quickFilterTimer.current = window.setTimeout(() => apiRef.current?.purgeInfiniteCache(), 400);
        return () => window.clearTimeout(quickFilterTimer.current);
    }, [serverMode, quickFilter]);

    // ---- Automatic refresh ------------------------------------------------------------------
    useEffect(() => {
        if (refreshInterval <= 0) {
            return;
        }
        const timer = window.setInterval(() => {
            reloadPending.current = serverMode;
            datasourceRef.current.reload();
        }, refreshInterval * 1000);
        return () => window.clearInterval(timer);
    }, [refreshInterval, serverMode]);

    // ---- Columns ----------------------------------------------------------------------------
    const key = columnsKey(columns);
    const { columnDefs, autoSizeColumnIds } = useMemo(
        () =>
            // `getColumns` only reads the ref later, from AG Grid callbacks, never during this render.
            // eslint-disable-next-line react-hooks/refs
            buildColumnDefs({
                columns,
                latest: getColumns,
                latestItems: getItems,
                showRowNumbers,
                rowDrag,
                flashOnChange,
                serverMode,
                commit: commitOnEdit,
                onWritten: handleWritten,
                dg2Filters: themeName === "atlas"
            }),
        // The static column configuration is captured by `key`; dynamic values are read through `getColumns`.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [
            key,
            getColumns,
            getItems,
            showRowNumbers,
            rowDrag,
            flashOnChange,
            serverMode,
            commitOnEdit,
            handleWritten,
            themeName
        ]
    );

    const defaultColDef = useMemo<ColDef<GridRow>>(
        () => ({
            floatingFilter: floatingFilters,
            floatingFilterComponentParams: themeName === "atlas" ? { suppressFilterButton: true } : undefined,
            wrapHeaderText,
            autoHeaderHeight: wrapHeaderText,
            filterParams: { buttons: ["reset"] }
        }),
        [floatingFilters, wrapHeaderText, themeName]
    );

    const sizeStrategy = useMemo<SizeColumnsToFitGridStrategy | SizeColumnsToContentStrategy | undefined>(() => {
        if (autoSizeStrategy === "fitGridWidth") {
            return { type: "fitGridWidth" };
        }
        if (autoSizeStrategy === "fitCellContents") {
            return { type: "fitCellContents" };
        }
        return undefined;
    }, [autoSizeStrategy]);

    // ---- Theme and language -----------------------------------------------------------------
    const theme = useMemo(
        () => buildTheme({ theme: themeName, colorScheme, accentColor, fontSize, spacing }),
        [themeName, colorScheme, accentColor, fontSize, spacing]
    );
    const localeText = useMemo(() => localeTextFor(sessionLocale()), []);

    // ---- Selection --------------------------------------------------------------------------
    const rowSelection = useMemo<RowSelectionOptions<GridRow> | undefined>(() => {
        if (!selection) {
            return undefined;
        }
        const common = {
            checkboxes: checkboxSelection,
            enableClickSelection: clickSelection,
            isRowSelectable: (node: { data?: GridRow }) => !node.data?.totals
        };
        if (selection.type === "Single") {
            return { mode: "singleRow", ...common };
        }
        // The infinite row model (server mode) has no "select all" support (AG Grid warning #129).
        return serverMode
            ? { mode: "multiRow", headerCheckbox: false, ...common }
            : {
                  mode: "multiRow",
                  headerCheckbox: headerCheckbox && checkboxSelection,
                  selectAll: "filtered",
                  ...common
              };
    }, [selection, checkboxSelection, headerCheckbox, clickSelection, serverMode]);

    const selectedIds = useMemo(() => {
        const current = selection?.selection;
        const list: ObjectItem[] = Array.isArray(current) ? current : current ? [current] : [];
        return new Set(list.map(item => item.id));
    }, [selection?.selection]);

    const syncSelectionToGrid = useCallback(
        (api: GridApi<GridRow>) => {
            if (!selection) {
                return;
            }
            const select: Array<IRowNode<GridRow>> = [];
            const deselect: Array<IRowNode<GridRow>> = [];
            api.forEachNode(node => {
                const wanted = Boolean(node.data?.item && selectedIds.has(node.data.item.id));
                if (wanted && !node.isSelected()) {
                    select.push(node);
                } else if (!wanted && node.isSelected()) {
                    deselect.push(node);
                }
            });
            if (select.length > 0) {
                api.setNodesSelected({ nodes: select, newValue: true, source: "api" });
            }
            if (deselect.length > 0) {
                api.setNodesSelected({ nodes: deselect, newValue: false, source: "api" });
            }
        },
        [selection, selectedIds]
    );

    useEffect(() => {
        if (apiRef.current) {
            syncSelectionToGrid(apiRef.current);
        }
    }, [syncSelectionToGrid, rows]);

    const handleSelectionChanged = useCallback(
        (event: SelectionChangedEvent<GridRow>) => {
            if (!selection || event.source === "api") {
                return;
            }
            const selected = event.api
                .getSelectedRows()
                .map(row => row.item)
                .filter((item): item is ObjectItem => Boolean(item));
            if (selection.type === "Single") {
                selection.setSelection(selected[0]);
            } else {
                selection.setSelection(selected);
            }
        },
        [selection]
    );

    const clearSelection = useCallback(() => {
        if (selection?.type === "Multi") {
            selection.setSelection([]);
        } else if (selection?.type === "Single") {
            selection.setSelection(undefined);
        }
        apiRef.current?.deselectAll();
    }, [selection]);

    const handleQuickFilterChange = useCallback(
        (text: string) => {
            setQuickFilter(text);
            if (quickFilterAttribute && !quickFilterAttribute.readOnly) {
                quickFilterAttribute.setValue(text);
            }
        },
        [quickFilterAttribute, setQuickFilter]
    );

    // ---- Column state and filter persistence -----------------------------------------------
    // The layout is remembered in a String attribute or in the browser's local storage, keyed by widget name.
    const stateStore = useMemo<StateStore | undefined>(() => {
        if (stateStorage === "attribute" && columnStateAttribute) {
            return {
                read: () => columnStateAttribute.value,
                write: value => {
                    if (!columnStateAttribute.readOnly && value !== columnStateAttribute.value) {
                        columnStateAttribute.setValue(value);
                    }
                }
            };
        }
        if (stateStorage === "browser") {
            const storageKey = `mxt-aggrid-state:${props.name}`;
            return {
                read: () => {
                    try {
                        return window.localStorage.getItem(storageKey) ?? undefined;
                    } catch {
                        return undefined;
                    }
                },
                write: value => {
                    try {
                        if (value) {
                            window.localStorage.setItem(storageKey, value);
                        } else {
                            window.localStorage.removeItem(storageKey);
                        }
                    } catch {
                        // Storage can be unavailable (private mode, quota); the layout is then not remembered.
                    }
                }
            };
        }
        return undefined;
    }, [stateStorage, columnStateAttribute, props.name]);
    // A remembered layout only applies while the column configuration it was saved for is unchanged.
    const stateSignature = useMemo(() => stateSignatureFor(columns), [key]); // eslint-disable-line react-hooks/exhaustive-deps

    const stateTimer = useRef<number | undefined>(undefined);
    const persistState = useCallback(
        (api: GridApi<GridRow>) => {
            if (!stateStore) {
                return;
            }
            window.clearTimeout(stateTimer.current);
            stateTimer.current = window.setTimeout(() => {
                const state: PersistedState = {
                    signature: stateSignature,
                    columns: api.getColumnState(),
                    filters: api.getFilterModel() as FilterModel,
                    quickFilter: quickFilterRef.current
                };
                stateStore.write(JSON.stringify(state));
            }, 300);
        },
        [stateStore, stateSignature]
    );

    const restoreState = useCallback(
        (api: GridApi<GridRow>) => {
            const serialized = stateStore?.read();
            if (!serialized) {
                return;
            }
            try {
                const parsed = JSON.parse(serialized) as PersistedState | ColumnState[];
                const state: PersistedState = Array.isArray(parsed) ? { columns: parsed } : parsed;
                if (state.signature && state.signature !== stateSignature) {
                    // Saved for a different set of columns; start from the configured layout instead.
                    stateStore?.write("");
                    return;
                }
                if (state.columns && state.columns.length > 0) {
                    api.applyColumnState({ state: state.columns, applyOrder: true });
                }
                if (state.filters) {
                    api.setFilterModel(state.filters);
                }
                if (state.quickFilter) {
                    setQuickFilter(state.quickFilter);
                }
            } catch {
                // Ignore a corrupt state string; the configured layout is used instead.
            }
        },
        [stateStore, stateSignature, setQuickFilter]
    );

    const handleColumnStateEvent = useCallback(
        (event: { api: GridApi<GridRow>; source: string; finished?: boolean }) => {
            if (COLUMN_STATE_SOURCES_TO_IGNORE.has(event.source) || event.finished === false) {
                return;
            }
            persistState(event.api);
        },
        [persistState]
    );

    // ---- Column chooser ---------------------------------------------------------------------
    const [chooserColumns, setChooserColumns] = useState<ChooserColumn[]>([]);
    const refreshChooser = useCallback((api: GridApi<GridRow>) => {
        const list: ChooserColumn[] = [];
        (api.getColumns() ?? []).forEach(column => {
            const id = column.getColId();
            if (id === SELECTION_COLUMN_ID || id === ROW_NUMBER_COLUMN_ID) {
                return;
            }
            list.push({ id, name: column.getColDef().headerName ?? id, visible: column.isVisible() });
        });
        setChooserColumns(previous => (JSON.stringify(previous) === JSON.stringify(list) ? previous : list));
    }, []);

    const handleColumnVisible = useCallback(
        (event: { api: GridApi<GridRow>; source: string }) => {
            refreshChooser(event.api);
            handleColumnStateEvent(event);
        },
        [refreshChooser, handleColumnStateEvent]
    );

    const toggleColumn = useCallback((id: string, visible: boolean) => {
        apiRef.current?.setColumnsVisible([id], visible);
    }, []);

    // ---- Totals row -------------------------------------------------------------------------
    const [totalsRows, setTotalsRows] = useState<GridRow[]>([]);
    const totalsKey = useRef<string>("");
    const totalsLabelText = totalsLabel?.value ?? "Total";
    const totalsFromDatasource = totalsRow !== "none" && totalsSource === "datasource";
    const totalsItem = totalsFromDatasource ? totalsDatasource?.items?.[0] : undefined;
    const totalsItemVersion = totalsFromDatasource && totalsDatasource ? totalsDatasource.status : "";
    useEffect(() => {
        if (totalsFromDatasource && totalsDatasource) {
            totalsDatasource.setLimit(1);
        }
        // Runs once per data source mode; the limit is a static setting.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [totalsFromDatasource]);
    const refreshTotals = useCallback(
        (api: GridApi<GridRow>) => {
            if (totalsRow === "none") {
                if (totalsKey.current !== "") {
                    totalsKey.current = "";
                    setTotalsRows([]);
                }
                return;
            }
            let row: GridRow;
            if (totalsFromDatasource) {
                row = totalsFromItem(totalsItem, columnsRef.current, totalsLabelText);
            } else {
                const loaded: GridRow[] = [];
                if (serverMode) {
                    api.forEachNode(node => node.data && !node.data.totals && loaded.push(node.data));
                } else {
                    api.forEachNodeAfterFilter(node => node.data && !node.data.totals && loaded.push(node.data));
                }
                row = computeTotalsFromRows(loaded, columnsRef.current, totalsLabelText);
            }
            const serialized = JSON.stringify(row.cells);
            if (serialized !== totalsKey.current) {
                totalsKey.current = serialized;
                setTotalsRows([row]);
            }
        },
        // totalsItemVersion changes when the totals data source reloads, so the row is recomputed then.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [totalsRow, totalsLabelText, serverMode, totalsFromDatasource, totalsItem, totalsItemVersion]
    );

    useEffect(() => {
        if (apiRef.current) {
            refreshTotals(apiRef.current);
        }
    }, [refreshTotals, rows]);

    const handleModelUpdated = useCallback(
        (event: { api: GridApi<GridRow> }) => {
            refreshTotals(event.api);
            if (showRowNumbers) {
                // Row indexes change on sort, filter and paging, but the cells only re-render when forced.
                event.api.refreshCells({ columns: [ROW_NUMBER_COLUMN_ID], force: true });
            }
        },
        [refreshTotals, showRowNumbers]
    );

    // ---- Grid events ------------------------------------------------------------------------
    const handleGridReady = useCallback(
        (event: GridReadyEvent<GridRow>) => {
            apiRef.current = event.api;
            restoreState(event.api);
            refreshChooser(event.api);
            syncSelectionToGrid(event.api);
            refreshTotals(event.api);
        },
        [restoreState, refreshChooser, syncSelectionToGrid, refreshTotals]
    );

    useEffect(() => {
        if (apiRef.current) {
            refreshChooser(apiRef.current);
        }
    }, [columnDefs, refreshChooser]);

    const handleFirstDataRendered = useCallback(
        (event: FirstDataRenderedEvent<GridRow>) => {
            if (autoSizeColumnIds.length > 0 && !stateStore?.read()) {
                event.api.autoSizeColumns(autoSizeColumnIds);
            }
        },
        [autoSizeColumnIds, stateStore]
    );

    const findColumn = useCallback((colId: string | undefined): ColumnsType | undefined => {
        const match = /^col(\d+)$/.exec(colId ?? "");
        return match ? columnsRef.current[Number(match[1])] : undefined;
    }, []);

    const handleCellClicked = useCallback(
        (event: CellClickedEvent<GridRow>) => {
            const item = event.data?.item;
            if (!item || event.data?.totals) {
                return;
            }
            const column = findColumn(event.colDef.colId);
            const action = column?.onClick?.get(item);
            if (action) {
                if (canRun(action)) {
                    action.execute();
                }
                return;
            }
            if (event.column.getColId() === SELECTION_COLUMN_ID) {
                return;
            }
            const rowAction = onRowClick?.get(item);
            if (canRun(rowAction)) {
                rowAction?.execute();
            }
        },
        [findColumn, onRowClick]
    );

    const handleRowDoubleClicked = useCallback(
        (event: RowDoubleClickedEvent<GridRow>) => {
            const item = event.data?.item;
            if (!item || event.data?.totals) {
                return;
            }
            const action = onRowDoubleClick?.get(item);
            if (canRun(action)) {
                action?.execute();
            }
        },
        [onRowDoubleClick]
    );

    // ---- Undo / redo (own stack: Mendix data refreshes would clear the AG Grid one) ------------
    const undoStack = useRef<EditRecord[]>([]);
    const redoStack = useRef<EditRecord[]>([]);

    const handleCellValueChanged = useCallback(
        (event: CellValueChangedEvent<GridRow>) => {
            const item = event.data?.item;
            if (!item) {
                return;
            }
            if (event.source !== UNDO_SOURCE) {
                undoStack.current.push({
                    rowId: event.data.id,
                    colId: event.colDef.colId ?? "",
                    oldValue: event.oldValue,
                    newValue: event.newValue
                });
                if (undoStack.current.length > 100) {
                    undoStack.current.shift();
                }
                redoStack.current = [];
            }
            const variables = { newValue: valueAsText(event.newValue), oldValue: valueAsText(event.oldValue) };
            const column = findColumn(event.colDef.colId);
            const columnAction = column?.onChange?.get(item);
            if (canRun(columnAction)) {
                columnAction?.execute(variables);
            }
            const gridAction = onCellValueChange?.get(item);
            if (canRun(gridAction)) {
                gridAction?.execute(variables);
            }
        },
        [findColumn, onCellValueChange]
    );

    const applyEdit = useCallback((record: EditRecord, value: unknown): boolean => {
        const api = apiRef.current;
        const node = api?.getRowNode(record.rowId);
        if (!api || !node) {
            return false;
        }
        node.setDataValue(record.colId, value, UNDO_SOURCE);
        api.flashCells({ rowNodes: [node], columns: [record.colId] });
        return true;
    }, []);

    const handleKeyDown = useCallback(
        (event: KeyboardEvent<HTMLDivElement>) => {
            if (!undoRedo || !(event.ctrlKey || event.metaKey) || apiRef.current?.getEditingCells().length) {
                return;
            }
            const keyName = event.key.toLowerCase();
            const isUndo = keyName === "z" && !event.shiftKey;
            const isRedo = keyName === "y" || (keyName === "z" && event.shiftKey);
            if (isUndo) {
                const record = undoStack.current.pop();
                if (record) {
                    event.preventDefault();
                    if (applyEdit(record, record.oldValue)) {
                        redoStack.current.push(record);
                    }
                }
            } else if (isRedo) {
                const record = redoStack.current.pop();
                if (record) {
                    event.preventDefault();
                    if (applyEdit(record, record.newValue)) {
                        undoStack.current.push(record);
                    }
                }
            }
        },
        [undoRedo, applyEdit]
    );

    // AG Grid only moves rows itself ("managed" drag) without pagination; with pagination the drop
    // position is applied here, so dragging keeps working on paged grids.
    const managedRowDrag = rowDrag && !pagination;
    const handleRowDragEnd = useCallback(
        (event: RowDragEndEvent<GridRow>) => {
            const ordered: ObjectItem[] = [];
            event.api.forEachNodeAfterFilterAndSort(node => {
                if (node.data?.item) {
                    ordered.push(node.data.item);
                }
            });
            if (!managedRowDrag) {
                const moving = event.node.data?.item;
                const over = event.overNode?.data?.item;
                const from = moving ? ordered.findIndex(item => item.id === moving.id) : -1;
                const to = over ? ordered.findIndex(item => item.id === over.id) : -1;
                if (!moving || from < 0 || to < 0 || from === to) {
                    return;
                }
                ordered.splice(from, 1);
                // Dragging down lands below the hovered row, dragging up lands above it.
                ordered.splice(to, 0, moving);
            }
            const order = new Map<string, number>();
            ordered.forEach((item, position) => {
                order.set(item.id, position + 1);
                const previous = rowDragAttribute?.get(item).value;
                if (rowDragAttribute && previous?.toNumber() !== position + 1) {
                    writeValue(rowDragAttribute, item, "number", new Big(position + 1), ordered, {
                        commit: commitOnEdit,
                        onWritten: name => runOnCommit(item, name, previous?.toNumber(), position + 1)
                    });
                }
            });
            setDragOrder(order);
            if (canRun(onRowDragEnd)) {
                onRowDragEnd?.execute();
            }
        },
        [managedRowDrag, rowDragAttribute, onRowDragEnd, commitOnEdit, runOnCommit]
    );

    const getRowClass = useCallback(
        (params: RowClassParams<GridRow>): string | string[] | undefined => {
            if (params.data?.totals) {
                return "mxt-ag-row-totals";
            }
            const item = params.data?.item;
            return item && rowClass ? rowClass.get(item).value : undefined;
        },
        [rowClass]
    );

    // ---- Export -----------------------------------------------------------------------------
    const exportColumnIds = useCallback(
        (api: GridApi<GridRow>): string[] =>
            api
                .getAllDisplayedColumns()
                .map(column => column.getColId())
                .filter(id => {
                    if (id === SELECTION_COLUMN_ID || id === ROW_NUMBER_COLUMN_ID) {
                        return false;
                    }
                    // Custom content columns hold widgets, which have no exportable value.
                    return findColumn(id)?.columnType !== "customContent";
                }),
        [findColumn]
    );

    const [exporting, setExporting] = useState(false);

    /** All rows that match the current sort and filters; in server mode they are fetched first. */
    const collectExportRows = useCallback(
        (api: GridApi<GridRow>): Promise<GridRow[]> => {
            if (!serverMode) {
                const collected: GridRow[] = [];
                api.forEachNodeAfterFilterAndSort(node => node.data && !node.data.totals && collected.push(node.data));
                return Promise.resolve(collected);
            }
            return new Promise<GridRow[]>((resolve, reject) => {
                const sortModel = api
                    .getColumnState()
                    .filter(state => state.sort)
                    .sort((a, b) => (a.sortIndex ?? 0) - (b.sortIndex ?? 0))
                    .map(state => ({ colId: state.colId, sort: state.sort as "asc" | "desc" }));
                const request = {
                    startRow: 0,
                    endRow: EXPORT_ROW_LIMIT,
                    sortModel,
                    filterModel: api.getFilterModel(),
                    successCallback: (block: GridRow[]) => resolve(block),
                    failCallback: () => reject(new Error("export request failed"))
                } as unknown as IGetRowsParams;
                requestQueue.current.push(request);
                processQueue();
            }).finally(() => {
                // Put the grid back on its own blocks.
                api.purgeInfiniteCache();
            });
        },
        [serverMode, processQueue]
    );

    const handleExportCsv = useCallback(() => {
        const api = apiRef.current;
        if (!api) {
            return;
        }
        const fileName = `${exportFileName.trim() || "export"}.csv`;
        const columnKeys = exportColumnIds(api);
        if (!serverMode) {
            api.exportDataAsCsv({ fileName, columnKeys });
            return;
        }
        setExporting(true);
        collectExportRows(api)
            .then(all => {
                const header = columnKeys.map(id => api.getColumn(id)?.getColDef().headerName ?? id);
                const escape = (text: string): string => `"${text.replace(/"/g, '""')}"`;
                const lines = [header.map(escape).join(",")];
                all.forEach(row => lines.push(columnKeys.map(id => escape(row.cells[id]?.display ?? "")).join(",")));
                downloadFile(
                    new TextEncoder().encode(CSV_BOM + lines.join("\r\n")),
                    fileName,
                    "text/csv;charset=utf-8"
                );
            })
            .catch(error => console.error("AGGrid: CSV export failed", error))
            .finally(() => setExporting(false));
    }, [exportFileName, exportColumnIds, serverMode, collectExportRows]);

    const handleExportExcel = useCallback(() => {
        const api = apiRef.current;
        if (!api) {
            return;
        }
        const baseName = exportFileName.trim() || "export";
        const columnKeys = exportColumnIds(api);
        const excelColumns: ExcelColumn[] = columnKeys.map(id => {
            const column = findColumn(id);
            const kind = column ? cellKind(column) : "text";
            const type: ExcelColumnType = kind === "number" || kind === "date" || kind === "boolean" ? kind : "text";
            return {
                name: api.getColumn(id)?.getColDef().headerName ?? id,
                type,
                precision: column?.decimalPrecision,
                groupDigits: column?.groupDigits
            };
        });
        setExporting(true);
        collectExportRows(api)
            .then(all => {
                const rows: ExcelCell[][] = all.map(row =>
                    columnKeys.map((id, index) => {
                        const cell = row.cells[id];
                        if (!cell) {
                            return "";
                        }
                        const value = cell.value;
                        switch (excelColumns[index].type) {
                            case "number":
                                return typeof value === "number" ? value : "";
                            case "date":
                                return value instanceof Date ? value : "";
                            case "boolean":
                                return typeof value === "boolean" ? value : "";
                            default:
                                return cell.display;
                        }
                    })
                );
                downloadFile(
                    buildXlsx(baseName, excelColumns, rows),
                    `${baseName}.xlsx`,
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                );
            })
            .catch(error => console.error("AGGrid: Excel export failed", error))
            .finally(() => setExporting(false));
    }, [exportFileName, exportColumnIds, findColumn, collectExportRows]);

    const handleReset = useCallback(() => {
        const api = apiRef.current;
        if (!api) {
            return;
        }
        api.setFilterModel(null);
        api.resetColumnState();
        handleQuickFilterChange("");
        stateStore?.write("");
        if (autoSizeColumnIds.length > 0) {
            api.autoSizeColumns(autoSizeColumnIds);
        }
        refreshChooser(api);
    }, [handleQuickFilterChange, stateStore, autoSizeColumnIds, refreshChooser]);

    const handleRefresh = useCallback(() => {
        reloadPending.current = serverMode;
        datasourceRef.current.reload();
    }, [serverMode]);

    // ---- Render -----------------------------------------------------------------------------
    const pageSizes = useMemo(
        () => parsePageSizes(pageSizeSelector, effectivePageSize),
        [pageSizeSelector, effectivePageSize]
    );
    const domLayout = layout === "fixedHeight" ? "normal" : layout;
    const wrapperStyle = layout === "fixedHeight" ? { ...style, height: height.trim() || "500px" } : style;
    const noRows = noRowsText?.value ?? "No rows to show";
    const atlas = themeName === "atlas";
    const atlasPager = pagination && atlas;
    const anyPinnedLeft = columns.some(column => column.pinned === "left") || showRowNumbers;
    const selectionColumnDef = useMemo<ColDef<GridRow>>(
        () => (anyPinnedLeft ? { pinned: "left", lockPosition: "left" } : { lockPosition: "left" }),
        [anyPinnedLeft]
    );
    const isEmpty = serverMode ? serverEmpty : datasource.status === "available" && rows.length === 0;
    const showPlaceholder = Boolean(emptyPlaceholder) && isEmpty;
    const selectedCount = selection?.type === "Multi" ? selectedIds.size : selectedIds.size;

    // Data Grid 2 style pager (Atlas theme): the AG Grid paging panel is hidden and driven through the API.
    const [pager, setPager] = useState<PagerState>({
        page: 0,
        totalPages: 0,
        pageSize: effectivePageSize,
        rowCount: 0
    });
    const handlePaginationChanged = useCallback((event: PaginationChangedEvent<GridRow>) => {
        setPager({
            page: event.api.paginationGetCurrentPage(),
            totalPages: event.api.paginationGetTotalPages(),
            pageSize: event.api.paginationGetPageSize(),
            rowCount: event.api.paginationGetRowCount()
        });
    }, []);

    return (
        <div
            className={classNames(
                "mxt-ag-grid",
                `mxt-ag-grid--${domLayout}`,
                { "mxt-ag-grid--atlas": atlas, "mxt-ag-grid--dark": colorScheme === "dark" },
                className
            )}
            style={wrapperStyle}
            tabIndex={tabIndex}
            onKeyDown={handleKeyDown}
        >
            <Toolbar
                labels={{
                    refresh: labelRefresh?.value ?? "Refresh",
                    reset: labelReset?.value ?? "Reset",
                    exportExcel: labelExportExcel?.value ?? "Export Excel",
                    exportCsv: labelExportCsv?.value ?? "Export CSV",
                    selected: labelSelected?.value ?? "[count] selected",
                    clear: labelClearSelection?.value ?? "Clear"
                }}
                showQuickFilter={showQuickFilter}
                quickFilterText={quickFilter}
                quickFilterPlaceholder={quickFilterPlaceholder?.value ?? "Search..."}
                onQuickFilterChange={handleQuickFilterChange}
                showExportCsv={showExportButton && exportFormat !== "excel"}
                onExportCsv={handleExportCsv}
                showExportExcel={showExportButton && exportFormat !== "csv"}
                onExportExcel={handleExportExcel}
                exporting={exporting}
                showReset={showResetButton}
                onReset={handleReset}
                showRefresh={showRefreshButton}
                onRefresh={handleRefresh}
                selectionCount={showSelectionCount && selection ? selectedCount : 0}
                onClearSelection={clearSelection}
            >
                {showColumnChooser && chooserColumns.length > 0 && (
                    <ColumnChooser
                        label={labelColumns?.value ?? "Columns"}
                        columns={chooserColumns}
                        onToggle={toggleColumn}
                    />
                )}
            </Toolbar>
            {showPlaceholder && <div className="mxt-ag-grid__empty">{emptyPlaceholder}</div>}
            <div className="mxt-ag-grid__grid" hidden={showPlaceholder}>
                <AgGridReact<GridRow>
                    theme={theme}
                    localeText={localeText}
                    columnDefs={columnDefs}
                    defaultColDef={defaultColDef}
                    rowModelType={serverMode ? "infinite" : "clientSide"}
                    rowData={serverMode ? undefined : rows}
                    datasource={serverMode ? serverDatasource : undefined}
                    cacheBlockSize={serverMode ? effectivePageSize : undefined}
                    maxBlocksInCache={serverMode && !pagination ? 10 : undefined}
                    infiniteInitialRowCount={serverMode ? 1 : undefined}
                    getRowId={params => params.data.id}
                    rowSelection={rowSelection}
                    selectionColumnDef={selectionColumnDef}
                    domLayout={domLayout}
                    rowHeight={rowHeight > 0 ? rowHeight : undefined}
                    headerHeight={headerHeight > 0 ? headerHeight : undefined}
                    floatingFiltersHeight={themeName === "atlas" ? 52 : undefined}
                    animateRows={animateRows}
                    suppressRowHoverHighlight={!rowHoverHighlight}
                    columnHoverHighlight={columnHoverHighlight}
                    enableCellTextSelection={cellTextSelection}
                    ensureDomOrder={cellTextSelection}
                    pagination={pagination}
                    paginationPageSize={effectivePageSize}
                    paginationPageSizeSelector={serverMode ? false : pageSizes}
                    paginationAutoPageSize={!serverMode && pagination && autoPageSize && layout === "fixedHeight"}
                    suppressPaginationPanel={atlasPager}
                    onPaginationChanged={handlePaginationChanged}
                    editType={editType === "fullRow" ? "fullRow" : undefined}
                    singleClickEdit={singleClickEdit}
                    undoRedoCellEditing={false}
                    enterNavigatesVertically={enterNavigatesVertically}
                    enterNavigatesVerticallyAfterEdit={enterNavigatesVertically}
                    stopEditingWhenCellsLoseFocus
                    alwaysMultiSort={alwaysMultiSort}
                    autoSizeStrategy={sizeStrategy}
                    rowDragManaged={managedRowDrag}
                    quickFilterText={serverMode ? undefined : quickFilter}
                    getRowClass={getRowClass}
                    pinnedTopRowData={totalsRow === "top" ? totalsRows : undefined}
                    pinnedBottomRowData={totalsRow === "bottom" ? totalsRows : undefined}
                    loading={!serverMode && datasource.status === "loading"}
                    overlayNoRowsTemplate={`<span class="mxt-ag-norows">${escapeHtml(noRows)}</span>`}
                    tooltipShowDelay={300}
                    onGridReady={handleGridReady}
                    onFirstDataRendered={handleFirstDataRendered}
                    onCellClicked={handleCellClicked}
                    onRowDoubleClicked={handleRowDoubleClicked}
                    onSelectionChanged={handleSelectionChanged}
                    onCellValueChanged={handleCellValueChanged}
                    onRowDragEnd={handleRowDragEnd}
                    onModelUpdated={handleModelUpdated}
                    onFilterChanged={event => {
                        refreshTotals(event.api);
                        persistState(event.api);
                    }}
                    onColumnMoved={handleColumnStateEvent}
                    onColumnResized={handleColumnStateEvent}
                    onColumnPinned={handleColumnStateEvent}
                    onColumnVisible={handleColumnVisible}
                    onSortChanged={handleColumnStateEvent}
                />
            </div>
            {atlasPager && !showPlaceholder && (
                <Pager
                    {...pager}
                    pageSizeLabel={labelPageSize?.value ?? "Page size"}
                    statusTemplate={labelPagingStatus?.value ?? "[first] to [last] of [total]"}
                    pageSizes={serverMode || (autoPageSize && layout === "fixedHeight") ? false : pageSizes}
                    onFirst={() => apiRef.current?.paginationGoToFirstPage()}
                    onPrevious={() => apiRef.current?.paginationGoToPreviousPage()}
                    onNext={() => apiRef.current?.paginationGoToNextPage()}
                    onLast={() => apiRef.current?.paginationGoToLastPage()}
                    onPageSize={size => apiRef.current?.setGridOption("paginationPageSize", size)}
                />
            )}
        </div>
    );
}
