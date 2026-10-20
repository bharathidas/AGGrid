import {
    ClipboardEvent,
    CSSProperties,
    KeyboardEvent,
    ReactElement,
    useCallback,
    useEffect,
    useId,
    useLayoutEffect,
    useMemo,
    useRef,
    useState
} from "react";
import { AgGridReact } from "ag-grid-react";
import {
    CellApiModule,
    CellClickedEvent,
    CellFocusedEvent,
    CellKeyDownEvent,
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
    ExternalFilterModule,
    FilterChangedEvent,
    FirstDataRenderedEvent,
    GridApi,
    GridReadyEvent,
    GridStateModule,
    HighlightChangesModule,
    ICellRendererParams,
    IDatasource,
    IGetRowsParams,
    IOverlayParams,
    IRowNode,
    InfiniteRowModelModule,
    IsFullWidthRowParams,
    LocaleModule,
    ModuleRegistry,
    NumberEditorModule,
    NumberFilterModule,
    OverlaySelectorResult,
    PaginationChangedEvent,
    PaginationModule,
    PinnedRowModule,
    PostSortRowsParams,
    QuickFilterModule,
    SuppressKeyboardEventParams,
    RenderApiModule,
    RowApiModule,
    RowAutoHeightModule,
    RowClassParams,
    RowDoubleClickedEvent,
    RowDragEndEvent,
    RowDragModule,
    RowHeightParams,
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
import { ListValue, ObjectItem } from "mendix";

import { ColumnsType, AGGridContainerProps } from "../typings/AGGridProps";
import { ColumnChooser, ChooserColumn } from "./components/ColumnChooser";
import { GroupByMenu, GroupableColumn } from "./components/GroupByMenu";
import { ChartIcon, CollapseIcon, DensityIcon, ExpandIcon, PanelIcon, PivotIcon } from "./components/Icons";
import { ConditionKind, PanelColumn, PanelFilter, SidePanel, SidePanelTab } from "./components/SidePanel";
import { PivotGrid } from "./components/PivotGrid";
import { RangeChart } from "./components/RangeChart";
import { CommitBanner, GridErrorBoundary } from "./components/Reliability";
import { ALL_TOTAL_CHOICES, LoadMoreParams, LoadMoreRow, TotalsMenu } from "./components/TotalsMenu";
import { SetFilterParams, columnValues } from "./components/SetFilter";
import { useRangeSelection, FillTarget } from "./hooks/useRangeSelection";
import {
    ArrowKey,
    CellRange,
    NormalizedRange,
    extendRange,
    planFill,
    planFillDown,
    rangeStats,
    rangeToTsv
} from "./utils/range";
import { ChartData, chartDataFromRange, hasChartData } from "./utils/chart";
import { CommitSnapshot, CommitTracker } from "./utils/commitTracker";
import { DatasourceQueue } from "./utils/datasourceQueue";
import {
    ServerGroup,
    canServerGroup,
    initialServerGroups,
    serverGroupDisplay,
    serverGroupValues,
    updateGroup
} from "./utils/serverGroups";
import { PivotState, computePivot, pivotHeaderRows, sanitizePivot } from "./utils/pivot";
import {
    TREE_COLUMN_ID,
    TreeExpandState,
    TreeModel,
    arrangeTree,
    buildTree,
    isTreeOpen,
    splitPath,
    toggleTreeKey
} from "./utils/tree";
import { UiTexts, aggregateLabel, uiTexts } from "./utils/texts";
import { isSetFilterModel, SetFilterModel, setFilterPasses } from "./utils/setFilter";
import { StatusBar } from "./components/StatusBar";
import { DetailRow, DetailRowParams } from "./components/DetailRow";
import { IssuesBadge } from "./components/IssuesBadge";
import { KeyboardHelp } from "./components/KeyboardHelp";
import { EmptyStateOverlay, LivelyOverlayParams, SkeletonOverlay } from "./components/Overlays";
import { Pager, PagerState } from "./components/Pager";
import { Toolbar } from "./components/Toolbar";
import { ViewsMenu } from "./components/ViewsMenu";
import { ROW_NUMBER_COLUMN_ID, buildColumnDefs } from "./utils/columns";
import {
    DETAIL_COLUMN_ID,
    initialExpanded,
    numberRows,
    placeDetailRows,
    toggleExpanded,
    withDetailRows
} from "./utils/detailRows";
import { intlLocale, localeTextFor, sessionLocale } from "./utils/locale";
import { resolveMotion, usePrefersReducedMotion } from "./utils/motion";
import {
    ArrangeResult,
    CollapseState,
    GROUP_COLUMN_ID,
    MAX_GROUP_LEVELS,
    arrangeGroups,
    buildGroupRows,
    canGroupBy,
    describeGroupBy,
    initialGroupBy,
    isCollapsed,
    moveGroupBy,
    sanitizeGroupBy,
    toggleCollapsed,
    toggleGroupBy
} from "./utils/grouping";
import { columnRanges, rangesKey } from "./utils/conditional";
import { localeIsMonthFirst, parseClipboard, parsePastedValue, planPaste } from "./utils/clipboard";
import { StatusSummary, statusSummary, summaryKey } from "./utils/statusBar";
import { clearSearchHighlight, highlightSearch } from "./utils/highlight";
import { MAX_HIGHLIGHTED_ROWS, diffRows, rowSignature, rowsToHighlight } from "./utils/rowChanges";
import {
    CellData,
    GridRow,
    TOTALS_ROW_ID,
    buildRow,
    buildRows,
    cellKind,
    commitItemNow,
    enumCaptions,
    formatValue,
    writeValue
} from "./utils/rows";
import { isTypingTarget, rowAsText, shortcutsFor } from "./utils/shortcuts";
import {
    CellIssue,
    cellError,
    changedIssueRows,
    collectIssues,
    dataColumnIds,
    hasValidation,
    issuesKey,
    issuesText,
    nextIssue,
    objectErrors
} from "./utils/validation";
import {
    SavedView,
    ViewState,
    ViewsDocument,
    defaultView,
    deleteView,
    emptyViews,
    findView,
    newViewId,
    parseViews,
    renameView,
    saveView,
    serializeViews,
    toggleDefaultView,
    updateViewState,
    viewMatchesColumns,
    viewNameProblem,
    viewStateKey,
    viewsStorageKey
} from "./utils/views";
import {
    ExcelCell,
    ExcelColumn,
    ExcelColumnType,
    ExcelRowOptions,
    ExcelSheet,
    ExcelTotalFn,
    buildWorkbook,
    downloadFile
} from "./utils/xlsx";
import { FilterModel, buildFilter, buildSortOrder, groupFilter } from "./utils/serverFilters";
import { Density, buildTheme, densityRowHeight, isDensity, nextDensity } from "./utils/theme";
import {
    AggregateChoice,
    AggregateFn,
    TOTALS_TOP_ROW_ID,
    TotalsOverrides,
    computeTotalsFromRows,
    isAggregateChoice,
    roundAggregate,
    totalsFromItem,
    totalsFunctionFor
} from "./utils/totals";

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
    ExternalFilterModule,
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
const PASTE_SOURCE = "mxtPaste";
const FILL_SOURCE = "mxtFill";
const ROLLBACK_SOURCE = "mxtRollback";
/** Edits made by the grid itself; they record their own undo entry (or none). */
const OWN_SOURCES = new Set([UNDO_SOURCE, PASTE_SOURCE, FILL_SOURCE, ROLLBACK_SOURCE]);
/** Upper bound for rows fetched from the server for an export. */
const EXPORT_ROW_LIMIT = 50000;
const CSV_BOM = String.fromCharCode(0xfeff);
/** Height of a detail row until its content was measured. */
const DETAIL_DEFAULT_HEIGHT = 160;
/** A row the user edited is not highlighted as "changed by a refresh" for this long (ms). */
const OWN_EDIT_WINDOW = 3000;
const NO_ROWS_EXPANDED: ReadonlySet<string> = new Set();
/** Columns the widget adds itself; they are no data and never exported, copied or listed in the chooser. */
const SYSTEM_COLUMN_IDS = new Set([
    SELECTION_COLUMN_ID,
    ROW_NUMBER_COLUMN_ID,
    DETAIL_COLUMN_ID,
    GROUP_COLUMN_ID,
    TREE_COLUMN_ID
]);
const EMPTY_GROUP_LABEL = "(empty)";
const NO_GROUPING: string[] = [];
const ARROW_KEYS = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]);
/** Operator names when the session language has no AG Grid locale. */
const AG_OPERATOR_FALLBACK: Record<string, string> = {
    contains: "Contains",
    notContains: "Does not contain",
    equals: "Equals",
    notEqual: "Does not equal",
    startsWith: "Begins with",
    endsWith: "Ends with",
    blank: "Blank",
    notBlank: "Not blank",
    greaterThan: "Greater than",
    greaterThanOrEqual: "Greater than or equal to",
    lessThan: "Less than",
    lessThanOrEqual: "Less than or equal to"
};

/** A data row: not a totals, detail, group header, generated tree level or "load more" row. */
function isDataRow(row: GridRow | undefined): row is GridRow {
    return Boolean(row && row.item && !row.totals && !row.detail && !row.group && !row.loadMore);
}

/** Hands a value to AG Grid for a column (boolean columns are typed as text); undefined when it does not fit. */
function coerceForColumn(kind: string, value: unknown, enumKeys?: string[]): { ok: boolean; value: unknown } {
    if (value === undefined || value === null || value === "") {
        return { ok: true, value: kind === "boolean" ? "false" : undefined };
    }
    switch (kind) {
        case "number":
            return typeof value === "number" && Number.isFinite(value) ? { ok: true, value } : { ok: false, value };
        case "date":
            return value instanceof Date ? { ok: true, value } : { ok: false, value };
        case "boolean":
            return typeof value === "boolean" ? { ok: true, value: String(value) } : { ok: false, value };
        case "enum":
            return typeof value === "string" && (!enumKeys || enumKeys.includes(value))
                ? { ok: true, value }
                : { ok: false, value };
        case "text":
            return { ok: true, value: value instanceof Date ? value.toISOString() : String(value) };
        default:
            return { ok: false, value };
    }
}

interface HeldCommit {
    item: ObjectItem;
    /** Commit the object itself (Commit directly). */
    commit: boolean;
    /** On commit action calls, in the order of the edits. */
    actions: Array<{ attributeName: string; oldValue: unknown; newValue: unknown }>;
}

function readLocalViews(key: string): ViewsDocument {
    try {
        return parseViews(window.localStorage.getItem(key));
    } catch {
        return emptyViews();
    }
}

/** Layout parts kept by the widget itself (not by AG Grid). */
interface LayoutExtras {
    groupBy?: string[];
    density?: Density;
    pivot?: PivotState;
    sidePanel?: { open: boolean; tab: string };
    totals?: Record<string, Record<string, string>>;
}

/** The parts of the grid state a saved view restores (without the column signature). */
function captureLayout(api: GridApi<GridRow>, quickFilter: string, extras: LayoutExtras = {}): ViewState {
    const state: ViewState = {
        columns: api.getColumnState(),
        filters: api.getFilterModel() as FilterModel,
        quickFilter
    };
    if (extras.groupBy && extras.groupBy.length > 0) {
        state.groupBy = extras.groupBy;
    }
    if (extras.density) {
        state.density = extras.density;
    }
    if (extras.pivot && extras.pivot.active) {
        state.pivot = extras.pivot;
    }
    if (extras.sidePanel?.open) {
        state.sidePanel = extras.sidePanel;
    }
    if (extras.totals && Object.values(extras.totals).some(entry => Object.keys(entry).length > 0)) {
        state.totals = extras.totals;
    }
    return state;
}

function rowSelector(id: string): string {
    return `.ag-row[row-id="${id.replace(/["\\]/g, "\\$&")}"]`;
}

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
    groupBy?: string[];
    density?: Density;
    pivot?: PivotState;
    sidePanel?: { open: boolean; tab: string };
    totals?: Record<string, Record<string, string>>;
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
            column.renderAs,
            column.conditionalFormat,
            column.formatColor,
            column.formatReverse,
            column.groupable,
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

/** The pivot layout configured per column ('Pivot start role'). */
function initialPivotFrom(columns: ColumnsType[], active: boolean): PivotState {
    const usable = (column: ColumnsType): boolean =>
        column.columnType !== "customContent" && column.pivotable !== false;
    const ids = (role: string): string[] =>
        columns
            .map((column, index) => ({ column, id: `col${index}` }))
            .filter(entry => usable(entry.column) && entry.column.pivotRole === role)
            .map(entry => entry.id);
    const values = columns
        .map((column, index) => ({ column, id: `col${index}` }))
        .filter(entry => usable(entry.column) && entry.column.pivotRole === "value")
        .map(entry => ({ colId: entry.id, fn: (entry.column.pivotAggregate ?? "sum") as AggregateFn }));
    return { active, rows: ids("row"), columns: ids("column"), values };
}

/** Cheap fingerprint of a row list (ids and order), to skip recomputing the pivot for the same rows. */
function rowsFingerprint(rows: GridRow[], version: number): string {
    let hash = 5381;
    rows.forEach(row => {
        for (let index = 0; index < row.id.length; index++) {
            hash = (hash * 33 + row.id.charCodeAt(index)) % 2147483647;
        }
    });
    return `${version}:${rows.length}:${hash}`;
}

interface FullWidthParams extends DetailRowParams, LoadMoreParams {}

/** Full-width rows: detail rows and the "load more" rows of lazily loaded server groups. */
function FullWidthRow(params: ICellRendererParams<GridRow> & FullWidthParams): ReactElement | null {
    return params.data?.loadMore ? <LoadMoreRow {...params} /> : <DetailRow {...params} />;
}

/** The grid inside an error boundary: an unexpected error shows a message with a Retry button. */
export function AGGrid(props: AGGridContainerProps): ReactElement {
    return (
        <GridErrorBoundary
            message={props.labelError?.value ?? "The grid ran into a problem and was stopped."}
            retryLabel={props.labelRetry?.value ?? "Retry"}
        >
            <AGGridInner {...props} />
        </GridErrorBoundary>
    );
}

function AGGridInner(props: AGGridContainerProps): ReactElement {
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
        showKeyboardHelp,
        blockInvalidCommit,
        showViews,
        viewsAttribute,
        viewsKey,
        detailContent,
        detailExpandMode,
        detailStartCollapsed,
        detailHeight,
        animate,
        labelViews,
        labelSaveView,
        labelIssues,
        labelShowDetails,
        labelClearFilters,
        labelKeyboardHelp,
        enableGrouping,
        groupsExpanded,
        hideGroupedColumns,
        showStatusBar,
        showDensityToggle,
        clipboardPaste,
        motion,
        highlightSearch: highlightSearchOn,
        labelGroupBy,
        labelGroupColumn,
        labelDensity,
        labelStatusRows,
        onGroupByChange,
        onPaste,
        exportSheets,
        exportStyled,
        serverGrouping,
        enablePivot,
        pivotStartActive,
        pivotTotals,
        treeMode,
        treeKey,
        treeParentKey,
        treePath,
        treePathSeparator,
        treeLabel,
        treeExpandDepth,
        treeAggregates,
        rangeSelection,
        fillHandle,
        rangeChart,
        showSidePanel,
        sidePanelStartOpen,
        totalsUserChange,
        labelSidePanel,
        labelPivot,
        labelPivotTotal,
        labelTreeColumn,
        labelChartRange,
        labelSaveFailed,
        labelRetry,
        labelDiscard,
        onFill,
        class: className,
        style,
        tabIndex
    } = props;

    const serverMode = dataMode === "server";
    const rowDrag = rowDragProp && !serverMode;
    const commitOnEdit = commitMode === "client";
    const effectivePageSize = pageSize > 0 ? pageSize : 20;
    // Detail rows are inserted into the row list, which the server row model cannot do.
    const detailEnabled = Boolean(detailContent) && !serverMode && (treeMode ?? "none") === "none";
    const validationEnabled = hasValidation(columns);
    // Commits wait until the changed object is valid; the widget then commits (or runs On commit) itself.
    const holdCommits = blockInvalidCommit && commitMode !== "none";
    const reducedMotion = usePrefersReducedMotion();
    // Motion: full / subtle / off; "Lively effects" off and the reduced-motion preference force off.
    const motionLevel = resolveMotion(motion, animate, reducedMotion);
    const lively = motionLevel !== "off";
    const fullMotion = motionLevel === "full";
    // Tree data, pivot and row grouping are browser features; tree data replaces grouping and pivot.
    const treeEnabled = (treeMode ?? "none") !== "none" && !serverMode;
    const groupingAllowed = enableGrouping && !serverMode && !treeEnabled;
    const pivotAllowed = Boolean(enablePivot) && !serverMode && !treeEnabled;
    const serverGroupingAllowed = Boolean(serverGrouping) && serverMode;
    const rangeEnabled = Boolean(rangeSelection);
    const totalsChangeable = Boolean(totalsUserChange) && totalsRow !== "none" && totalsSource !== "datasource";

    const rootRef = useRef<HTMLDivElement>(null);
    const apiRef = useRef<GridApi<GridRow> | null>(null);
    // Column definitions are memoized, so their callbacks read the latest column props through this ref.
    const columnsRef = useRef<ColumnsType[]>(columns);
    const itemsRef = useRef<ObjectItem[]>(datasource.items ?? []);
    const datasourceRef = useRef(datasource);
    const detailContentRef = useRef(detailContent);
    const showDetailsLabel = labelShowDetails?.value ?? "Show details";
    const showDetailsLabelRef = useRef(showDetailsLabel);
    useLayoutEffect(() => {
        columnsRef.current = columns;
        itemsRef.current = datasource.items ?? [];
        datasourceRef.current = datasource;
        detailContentRef.current = detailContent;
        showDetailsLabelRef.current = showDetailsLabel;
    });
    const getColumns = useCallback(() => columnsRef.current, []);
    const getItems = useCallback(() => itemsRef.current, []);

    // ---- Texts (AG Grid's locale pack covers the session language) ------------------------------
    const localeText = useMemo(() => localeTextFor(sessionLocale()), []);
    const texts = useMemo<UiTexts>(() => uiTexts(localeText), [localeText]);
    const textsRef = useRef(texts);
    useLayoutEffect(() => {
        textsRef.current = texts;
    });
    const getTexts = useCallback(() => textsRef.current, []);
    const operatorLabel = useCallback(
        (type: string) => (localeText?.[type] as string | undefined) ?? AG_OPERATOR_FALLBACK[type] ?? type,
        [localeText]
    );
    const formatCount = useCallback((count: number) => new Intl.NumberFormat(intlLocale()).format(count), []);

    // ---- Right-to-left pages: AG Grid needs enableRtl when it is created ---------------------------
    const [rtl, setRtl] = useState(false);
    useLayoutEffect(() => {
        const root = rootRef.current;
        const next = Boolean(root && getComputedStyle(root).direction === "rtl");
        if (next !== rtl) {
            setRtl(next);
        }
    }, [rtl]);

    // ---- Screen reader announcements ----------------------------------------------------------
    const [announcement, setAnnouncement] = useState("");
    const announce = useCallback((text: string) => setAnnouncement(text), []);
    // Set once the status bar logic below is defined; the selection handler is declared earlier.
    const refreshStatusRef = useRef<(api: GridApi<GridRow>) => void>(() => undefined);

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

    // ---- Held commits (Hold commits while invalid) --------------------------------------------
    // The validation expressions only reflect a new value once Mendix pushed the changed object back, so
    // the decision is taken after the next data update (or after a short fallback delay).
    const heldCommits = useRef(new Map<string, HeldCommit>());
    const [heldCount, setHeldCount] = useState(0);
    const flushTimer = useRef<number | undefined>(undefined);
    const flushHeld = useCallback(() => {
        const held = heldCommits.current;
        held.forEach((entry, id) => {
            const item = itemsRef.current.find(candidate => candidate.id === id) ?? entry.item;
            if (objectErrors(item, columnsRef.current).length > 0) {
                return;
            }
            held.delete(id);
            const runActions = (): void =>
                entry.actions.forEach(edit => runOnCommit(item, edit.attributeName, edit.oldValue, edit.newValue));
            if (!entry.commit || !commitItemNow(item, runActions)) {
                runActions();
            }
        });
        setHeldCount(held.size);
    }, [runOnCommit]);
    const scheduleFlush = useCallback(
        (delay: number) => {
            window.clearTimeout(flushTimer.current);
            flushTimer.current = window.setTimeout(flushHeld, delay);
        },
        [flushHeld]
    );
    useEffect(() => () => window.clearTimeout(flushTimer.current), []);
    const holdCommit = useCallback(
        (item: ObjectItem, attributeName: string, oldValue: unknown, newValue: unknown) => {
            const entry = heldCommits.current.get(item.id) ?? { item, commit: commitOnEdit, actions: [] };
            entry.item = item;
            if (commitMode === "action") {
                entry.actions.push({ attributeName, oldValue, newValue });
            }
            heldCommits.current.set(item.id, entry);
            scheduleFlush(1000);
        },
        [commitOnEdit, commitMode, scheduleFlush]
    );
    const commitAfterWrite = useCallback(
        (item: ObjectItem, attributeName: string, oldValue: unknown, newValue: unknown) => {
            if (holdCommits) {
                holdCommit(item, attributeName, oldValue, newValue);
            } else {
                runOnCommit(item, attributeName, oldValue, newValue);
            }
        },
        [holdCommits, holdCommit, runOnCommit]
    );

    const handleWritten = useCallback(
        (row: GridRow, attributeName: string, oldValue: unknown, newValue: unknown) => {
            if (row.item) {
                commitAfterWrite(row.item, attributeName, oldValue, newValue);
            }
        },
        [commitAfterWrite]
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
        if (treeEnabled) {
            // The hierarchy decides the order; dragging rows would break it.
            return built;
        }
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
    }, [items, columns, rowDrag, rowDragAttribute, dragOrder, treeEnabled]);

    // ---- Tree data (own implementation; AG Grid tree data is Enterprise-only) ------------------------
    // Expressions over an association (Parent key = $currentObject/Module.Task_Parent/Module.Task/Code) arrive
    // after the rows: their values are Loading first. The tree is rebuilt when any key, parent key, path or
    // label changes, not only when the rows change, otherwise it stays flat.
    const treeSignature = treeEnabled
        ? rows
              .map(row => {
                  const item = row.item;
                  if (!item) {
                      return "";
                  }
                  return treeMode === "path"
                      ? `${treePath?.get(item).value ?? ""}\u0001${treeLabel?.get(item).value ?? ""}`
                      : `${treeKey?.get(item).value ?? ""}\u0001${treeParentKey?.get(item).value ?? ""}\u0001${
                            treeLabel?.get(item).value ?? ""
                        }`;
              })
              .join("\u0002")
        : "";
    const treeModel = useMemo<TreeModel | undefined>(
        () => {
            if (!treeEnabled) {
                return undefined;
            }
            return buildTree(
                rows,
                row => {
                    const item = row.item;
                    if (!item) {
                        return {};
                    }
                    const label = treeLabel?.get(item).value;
                    if (treeMode === "path") {
                        return { path: splitPath(treePath?.get(item).value, treePathSeparator ?? "/"), label };
                    }
                    return { key: treeKey?.get(item).value, parentKey: treeParentKey?.get(item).value, label };
                },
                treeMode === "path" ? "path" : "parentKey"
            );
        },
        // The expressions are read for the rows of this data update; they change identity on every render.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [treeEnabled, treeMode, treePathSeparator, rows, treeSignature]
    );
    const [treeExpand, setTreeExpand] = useState<TreeExpandState>(() => ({
        depth: treeExpandDepth ?? 1,
        toggled: new Set<string>()
    }));
    const treeExpandRef = useRef(treeExpand);
    useLayoutEffect(() => {
        treeExpandRef.current = treeExpand;
    });
    const isTreeRowOpen = useCallback(
        (key: string, level: number) => isTreeOpen(treeExpandRef.current, key, level),
        []
    );
    const toggleTree = useCallback(
        (key: string) => {
            const node = treeModel?.rows.find(row => row.tree?.key === key);
            const opening = node?.tree ? !isTreeOpen(treeExpandRef.current, key, node.tree.level) : true;
            setTreeExpand(previous => toggleTreeKey(previous, key));
            announce(opening ? "Row expanded" : "Row collapsed");
        },
        [treeModel, announce]
    );
    const setAllTree = useCallback(
        (open: boolean) => {
            setTreeExpand({ depth: open ? -1 : 0, toggled: new Set<string>() });
            announce(open ? "All rows expanded" : "All rows collapsed");
        },
        [announce]
    );
    /* eslint-disable react-hooks/refs */
    const treeCellParams = useMemo(
        () =>
            treeEnabled
                ? {
                      header: labelTreeColumn?.value ?? "Hierarchy",
                      isOpen: isTreeRowOpen,
                      onToggle: toggleTree,
                      formatCount
                  }
                : undefined,
        [treeEnabled, labelTreeColumn?.value, isTreeRowOpen, toggleTree, formatCount]
    );
    /* eslint-enable react-hooks/refs */
    const arrangedTreeRef = useRef<
        { sequence: Array<{ row: GridRow; level: number }>; contextIds: Set<string> } | undefined
    >(undefined);
    const treeContextSeen = useRef<Set<string>>(new Set());

    // ---- Pivot (own implementation; AG Grid pivoting is Enterprise-only) -------------------------------
    const [pivot, setPivot] = useState<PivotState>(() =>
        initialPivotFrom(columns, Boolean(pivotStartActive) && Boolean(enablePivot) && !serverMode)
    );
    const pivotActive = pivotAllowed && pivot.active;
    const pivotRef = useRef(pivot);
    useLayoutEffect(() => {
        pivotRef.current = pivot;
    });
    const [pivotSource, setPivotSource] = useState<GridRow[]>([]);
    const pivotSourceKey = useRef("");
    // Counts data updates, so a pivot over the same row ids still refreshes when values changed.
    const dataVersion = useRef(0);
    const pivotRowsSeen = useRef<GridRow[] | undefined>(undefined);
    const latestRows = useRef(rows);
    useLayoutEffect(() => {
        latestRows.current = rows;
    });
    const refreshPivotSource = useCallback(
        (api: GridApi<GridRow>) => {
            if (!pivotAllowed || !pivotRef.current.active) {
                return;
            }
            const list: GridRow[] = [];
            api.forEachNodeAfterFilter(node => {
                if (isDataRow(node.data)) {
                    list.push(node.data);
                }
            });
            if (pivotRowsSeen.current !== latestRows.current) {
                pivotRowsSeen.current = latestRows.current;
                dataVersion.current++;
            }
            const key = rowsFingerprint(list, dataVersion.current);
            if (key !== pivotSourceKey.current) {
                pivotSourceKey.current = key;
                setPivotSource(list);
            }
        },
        [pivotAllowed]
    );

    // ---- Side panel -------------------------------------------------------------------------------
    const [panel, setPanel] = useState<{ open: boolean; tab: SidePanelTab }>(() => ({
        open: Boolean(showSidePanel) && Boolean(sidePanelStartOpen),
        tab: "columns"
    }));
    const panelRef = useRef(panel);
    useLayoutEffect(() => {
        panelRef.current = panel;
    });

    // ---- Totals functions chosen by the user --------------------------------------------------------
    const [totalsOverrides, setTotalsOverrides] = useState<Record<string, TotalsOverrides>>({});
    const totalsOverridesRef = useRef(totalsOverrides);
    /** Lazy server groups are shown (read by callbacks declared before the server group logic). */
    const serverGroupActiveRef = useRef(false);
    /** Column filters as last applied, for the side panel's Filters section. */
    const [filterModelState, setFilterModelState] = useState<FilterModel>({});
    /** Repaints the cell range highlight (set once the range selection exists). */
    const rangePaintRef = useRef<() => void>(() => undefined);
    /** Display order of the lazily loaded server groups (set while they are shown). */
    const serverGroupOrderRef = useRef<Map<string, number> | undefined>(undefined);
    useLayoutEffect(() => {
        totalsOverridesRef.current = totalsOverrides;
    });

    // A data update re-evaluates the validation expressions: held commits of now valid objects can run.
    useEffect(() => {
        if (heldCommits.current.size > 0) {
            scheduleFlush(0);
        }
    }, [items, scheduleFlush]);

    // ---- Detail rows ------------------------------------------------------------------------
    const [expandState, setExpandState] = useState<{ touched: boolean; ids: ReadonlySet<string> }>(() => ({
        touched: false,
        ids: NO_ROWS_EXPANDED
    }));
    const expandedIds = useMemo<ReadonlySet<string>>(() => {
        if (!detailEnabled) {
            return NO_ROWS_EXPANDED;
        }
        return expandState.touched
            ? expandState.ids
            : initialExpanded(
                  rows.map(row => row.id),
                  detailExpandMode,
                  detailStartCollapsed
              );
    }, [detailEnabled, expandState, rows, detailExpandMode, detailStartCollapsed]);
    // ---- Row grouping (own implementation; AG Grid row grouping is Enterprise-only) -------------
    const [groupState, setGroupState] = useState<{ touched: boolean; groupBy: string[] }>(() => ({
        touched: false,
        groupBy: NO_GROUPING
    }));
    const groupConfigKey = columnsKey(columns);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const configuredGroupBy = useMemo(() => initialGroupBy(columns), [groupConfigKey]);
    const groupBy = !groupingAllowed ? NO_GROUPING : groupState.touched ? groupState.groupBy : configuredGroupBy;
    const groupingActive = groupBy.length > 0;
    const [collapse, setCollapse] = useState<CollapseState>(() => ({
        mode: groupsExpanded ? "expanded" : "collapsed",
        exceptions: new Set<string>()
    }));
    const [density, setDensity] = useState<Density | undefined>(undefined);
    const collapseRef = useRef(collapse);
    const groupByRef = useRef(groupBy);
    const densityRef = useRef(density);
    useLayoutEffect(() => {
        collapseRef.current = collapse;
        groupByRef.current = groupBy;
        densityRef.current = density;
    });
    const captionOf = useCallback(
        (colId: string): string => {
            const match = /^col(\d+)$/.exec(colId);
            const column = match ? columns[Number(match[1])] : undefined;
            return column?.header?.value || colId;
        },
        [columns]
    );
    const groupRows = useMemo(
        () => (groupingActive ? buildGroupRows(rows, groupBy, captionOf, EMPTY_GROUP_LABEL) : []),
        [groupingActive, rows, groupBy, captionOf]
    );
    const displayRows = useMemo(() => {
        if (treeModel) {
            return treeModel.rows;
        }
        const base = detailEnabled ? withDetailRows(rows, expandedIds) : rows;
        return groupingActive ? [...groupRows, ...base] : base;
    }, [treeModel, detailEnabled, rows, expandedIds, groupingActive, groupRows]);
    const expandedRef = useRef(expandedIds);
    useLayoutEffect(() => {
        expandedRef.current = expandedIds;
    });
    const isExpanded = useCallback((id: string) => expandedRef.current.has(id), []);
    const toggleDetail = useCallback(
        (id: string) => {
            const current = expandedRef.current;
            const opening = !current.has(id);
            setExpandState(previous => ({
                touched: true,
                ids: toggleExpanded(previous.touched ? previous.ids : current, id, detailExpandMode)
            }));
            announce(opening ? "Details shown" : "Details hidden");
        },
        [detailExpandMode, announce]
    );
    const detailLabel = useCallback(() => showDetailsLabelRef.current, []);
    const getDetailContent = useCallback(() => detailContentRef.current, []);
    const detailToggle = useMemo(
        () => (detailEnabled ? { isExpanded, onToggle: toggleDetail, label: detailLabel } : undefined),
        [detailEnabled, isExpanded, toggleDetail, detailLabel]
    );
    // The chevrons show the expanded state through a value getter; refresh them when it changes.
    useEffect(() => {
        if (detailEnabled) {
            apiRef.current?.refreshCells({ columns: [DETAIL_COLUMN_ID], force: true });
        }
    }, [detailEnabled, expandedIds]);

    const detailHeights = useRef(new Map<string, number>());
    const handleDetailHeight = useCallback((detailRowId: string, height: number) => {
        const api = apiRef.current;
        if (!api || height <= 0) {
            return;
        }
        const previous = detailHeights.current.get(detailRowId);
        if (previous !== undefined && Math.abs(previous - height) < 2) {
            return;
        }
        detailHeights.current.set(detailRowId, height);
        const node = api.getRowNode(detailRowId);
        if (node) {
            node.setRowHeight(height);
            api.onRowHeightChanged();
        }
    }, []);
    const getRowHeight = useCallback(
        (params: RowHeightParams<GridRow>): number | undefined | null => {
            if (!params.data?.detail) {
                return undefined;
            }
            return detailHeight > 0 ? detailHeight : detailHeights.current.get(params.data.id) ?? DETAIL_DEFAULT_HEIGHT;
        },
        [detailHeight]
    );
    const isFullWidthRow = useCallback(
        (params: IsFullWidthRowParams<GridRow>) =>
            Boolean(params.rowNode.data?.detail || params.rowNode.data?.loadMore),
        []
    );
    const detailRowParams = useMemo<DetailRowParams>(
        () => ({
            getContent: getDetailContent,
            fixedHeight: detailHeight,
            onHeight: handleDetailHeight,
            label: detailLabel
        }),
        [getDetailContent, detailHeight, handleDetailHeight, detailLabel]
    );
    // Sorting treats detail rows like other rows: put them back under their parent, and number the rows
    // without them.
    const rowNumbers = useRef(new Map<string, number>());
    // Grouped order of the last sort pass, used by the exports (they include collapsed groups).
    const arrangedRef = useRef<ArrangeResult<IRowNode<GridRow>> | undefined>(undefined);
    const handlePostSortRows = useCallback(
        (params: PostSortRowsParams<GridRow>) => {
            if (serverGroupOrderRef.current) {
                // Lazy server groups: the rows are in the order the server and the groups gave them.
                const order = serverGroupOrderRef.current;
                params.nodes.sort((a, b) => (order.get(a.data?.id ?? "") ?? 0) - (order.get(b.data?.id ?? "") ?? 0));
                return;
            }
            if (treeModel) {
                const result = arrangeTree(params.nodes, {
                    rowOf: node => node.data,
                    nodeOf: id => apiRef.current?.getRowNode(id) ?? undefined,
                    model: treeModel,
                    expand: treeExpand,
                    columns: columnsRef.current,
                    aggregateParents: treeAggregates
                });
                arrangedTreeRef.current = result;
                arrangedRef.current = undefined;
                const root = params.nodes[0]?.parent;
                if (root && root.childrenAfterSort === params.nodes) {
                    root.childrenAfterSort = result.display;
                } else {
                    params.nodes.splice(0, params.nodes.length, ...result.display);
                }
                rowNumbers.current = numberRows(result.display, node => node.data);
                return;
            }
            arrangedTreeRef.current = undefined;
            if (!groupingActive) {
                arrangedRef.current = undefined;
                placeDetailRows(params.nodes, node => node.data);
                rowNumbers.current = numberRows(params.nodes, node => node.data);
                return;
            }
            const sortState = apiRef.current?.getColumnState() ?? [];
            const result = arrangeGroups(params.nodes, {
                rowOf: node => node.data,
                groupBy,
                collapse,
                direction: colId => sortState.find(state => state.colId === colId)?.sort ?? undefined,
                columns: columnsRef.current
            });
            arrangedRef.current = result;
            const root = params.nodes[0]?.parent;
            if (root && root.childrenAfterSort === params.nodes) {
                // A new array: when nothing is sorted AG Grid hands over its filtered list itself, which must
                // keep the rows of collapsed groups.
                root.childrenAfterSort = result.display;
            } else {
                params.nodes.splice(0, params.nodes.length, ...result.display);
            }
            rowNumbers.current = numberRows(result.display, node => node.data);
        },
        // The callback changes with the grouping, which makes AG Grid sort (and so arrange) again.
        [groupingActive, groupBy, collapse, treeModel, treeExpand, treeAggregates]
    );
    const rowNumberOf = useCallback((row: GridRow) => rowNumbers.current.get(row.id), []);

    const toggleGroup = useCallback(
        (path: string) => {
            const opening = isCollapsed(collapseRef.current, path);
            setCollapse(previous => toggleCollapsed(previous, path));
            announce(opening ? "Group expanded" : "Group collapsed");
        },
        [announce]
    );
    const setAllGroups = useCallback(
        (open: boolean) => {
            setCollapse({ mode: open ? "expanded" : "collapsed", exceptions: new Set<string>() });
            announce(open ? "All groups expanded" : "All groups collapsed");
        },
        [announce]
    );
    const onGroupByChangeRef = useRef(onGroupByChange);
    useLayoutEffect(() => {
        onGroupByChangeRef.current = onGroupByChange;
    });
    const changeGroupBy = useCallback(
        (next: string[], fromUser = true) => {
            setGroupState({ touched: true, groupBy: next });
            if (!fromUser) {
                return;
            }
            const text = describeGroupBy(next, captionOf);
            announce(next.length ? `Grouped by ${text}` : "Ungrouped");
            const action = onGroupByChangeRef.current;
            if (canRun(action)) {
                action?.execute({ groupBy: text });
            }
        },
        [captionOf, announce]
    );
    const groupableColumns = useMemo<GroupableColumn[]>(
        () =>
            columns
                .map((column, index) => ({ column, id: `col${index}` }))
                .filter(entry => canGroupBy(entry.column) && entry.column.visible?.value !== false)
                .map(entry => ({ id: entry.id, name: entry.column.header?.value ?? entry.id })),
        [columns]
    );
    const isGroupCollapsed = useCallback((path: string) => isCollapsed(collapseRef.current, path), []);
    // The callbacks read the collapse state later, from AG Grid cell renderers, never during render.
    /* eslint-disable react-hooks/refs */
    const groupCellParams = useMemo(
        () =>
            groupingActive
                ? {
                      header: labelGroupColumn?.value ?? "Group",
                      isCollapsed: isGroupCollapsed,
                      onToggle: toggleGroup,
                      formatCount: (count: number) => new Intl.NumberFormat(intlLocale()).format(count)
                  }
                : undefined,
        [groupingActive, labelGroupColumn?.value, toggleGroup, isGroupCollapsed]
    );
    /* eslint-enable react-hooks/refs */

    // ---- Conditional formatting ranges --------------------------------------------------------
    const formatRanges = useMemo(() => columnRanges(rows, columns), [rows, columns]);
    const formatRangesRef = useRef(formatRanges);
    useLayoutEffect(() => {
        formatRangesRef.current = formatRanges;
    });
    const getFormatRanges = useCallback(() => formatRangesRef.current, []);
    const formatRangesText = rangesKey(formatRanges);
    useEffect(() => {
        const api = apiRef.current;
        if (api && formatRangesText !== "[]") {
            const ids = JSON.parse(formatRangesText).map((entry: [string, unknown]) => entry[0]) as string[];
            api.refreshCells({ columns: ids, force: true });
        }
    }, [formatRangesText]);

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

    // ---- Saved views: does the grid still match the active view? ----------------------------------
    // Comparison key of the active view's layout; undefined while no view is active.
    const activeViewKey = useRef<string | undefined>(undefined);
    const [viewDirty, setViewDirty] = useState(false);
    const viewCheckTimer = useRef<number | undefined>(undefined);
    /** Layout parts the widget keeps itself, for the remembered layout and saved views. */
    const layoutExtras = useCallback(
        (): LayoutExtras => ({
            groupBy: groupByRef.current,
            density: densityRef.current,
            pivot: pivotAllowed ? pivotRef.current : undefined,
            sidePanel: showSidePanel ? panelRef.current : undefined,
            totals: totalsOverridesRef.current
        }),
        [pivotAllowed, showSidePanel]
    );
    /** Restores the widget's own layout parts from a remembered layout or a view. */
    const applyLayoutExtras = useCallback(
        (
            state: { pivot?: unknown; sidePanel?: { open: boolean; tab: string }; totals?: unknown },
            fromView: boolean
        ) => {
            if (pivotAllowed) {
                const valid = (colId: string): boolean => {
                    const match = /^col(\d+)$/.exec(colId);
                    const column = match ? columnsRef.current[Number(match[1])] : undefined;
                    return Boolean(column && column.columnType !== "customContent" && column.pivotable !== false);
                };
                const restored = sanitizePivot(state.pivot, valid);
                if (restored) {
                    setPivot(restored);
                } else if (fromView) {
                    setPivot(previous => ({ ...previous, active: false }));
                }
            }
            if (showSidePanel && (state.sidePanel || fromView)) {
                const tab: SidePanelTab = state.sidePanel?.tab === "filters" ? "filters" : "columns";
                setPanel({ open: Boolean(state.sidePanel?.open), tab });
            }
            if (state.totals && typeof state.totals === "object") {
                const clean: Record<string, TotalsOverrides> = {};
                Object.entries(state.totals as Record<string, Record<string, unknown>>).forEach(([rowId, entry]) => {
                    clean[rowId] = {};
                    Object.entries(entry ?? {}).forEach(([colId, choice]) => {
                        if (isAggregateChoice(choice)) {
                            clean[rowId][colId] = choice;
                        }
                    });
                });
                setTotalsOverrides(clean);
            } else if (fromView) {
                setTotalsOverrides({});
            }
        },
        [pivotAllowed, showSidePanel]
    );
    const scheduleViewCheck = useCallback(() => {
        if (activeViewKey.current === undefined) {
            return;
        }
        window.clearTimeout(viewCheckTimer.current);
        viewCheckTimer.current = window.setTimeout(() => {
            const api = apiRef.current;
            const expected = activeViewKey.current;
            if (api && expected !== undefined) {
                setViewDirty(viewStateKey(captureLayout(api, quickFilterRef.current, layoutExtras())) !== expected);
            }
        }, 350);
    }, [layoutExtras]);
    useEffect(() => () => window.clearTimeout(viewCheckTimer.current), []);

    // ---- Validation issues ------------------------------------------------------------------
    const [issues, setIssues] = useState<CellIssue[]>([]);
    const issuesRef = useRef<CellIssue[]>([]);
    const refreshIssues = useCallback(
        (api: GridApi<GridRow>) => {
            let next: CellIssue[] = [];
            if (validationEnabled) {
                const visited: Array<{ row: GridRow | undefined; rowIndex: number }> = [];
                const visit = (node: IRowNode<GridRow>): void => {
                    visited.push({ row: node.data, rowIndex: node.rowIndex ?? -1 });
                };
                if (serverMode) {
                    api.forEachNode(visit);
                } else {
                    api.forEachNodeAfterFilterAndSort(visit);
                }
                next = collectIssues(
                    visited.filter(entry => entry.rowIndex >= 0),
                    dataColumnIds(columnsRef.current)
                );
            }
            const previous = issuesRef.current;
            if (issuesKey(previous) === issuesKey(next)) {
                return;
            }
            issuesRef.current = next;
            setIssues(next);
            // A cell's error can change without its value changing (a rule over several attributes):
            // force those rows to re-evaluate their cell classes.
            const rowNodes = changedIssueRows(previous, next)
                .map(id => api.getRowNode(id))
                .filter((node): node is IRowNode<GridRow> => Boolean(node));
            if (rowNodes.length > 0) {
                api.refreshCells({ rowNodes, force: true });
            }
        },
        [validationEnabled, serverMode]
    );

    // ---- Highlight rows changed by a data refresh -------------------------------------------
    // Rows the user edited in the grid recently; their change is not announced as a refresh.
    const ownEdits = useRef(new Map<string, number>());
    const recentOwnEdits = useCallback((): Set<string> => {
        const now = Date.now();
        const recent = new Set<string>();
        ownEdits.current.forEach((time, id) => {
            if (now - time < OWN_EDIT_WINDOW) {
                recent.add(id);
            } else {
                ownEdits.current.delete(id);
            }
        });
        return recent;
    }, []);
    const highlightTimer = useRef<number | undefined>(undefined);
    const highlightRows = useCallback((ids: string[]) => {
        const api = apiRef.current;
        const root = rootRef.current;
        if (!api || !root || ids.length === 0) {
            return;
        }
        const rowNodes = ids.map(id => api.getRowNode(id)).filter((node): node is IRowNode<GridRow> => Boolean(node));
        if (rowNodes.length > 0) {
            api.flashCells({ rowNodes, flashDuration: 600, fadeDuration: 1200 });
        }
        ids.forEach(id =>
            root.querySelectorAll(rowSelector(id)).forEach(element => element.classList.add("mxt-ag-row-changed"))
        );
        window.clearTimeout(highlightTimer.current);
        highlightTimer.current = window.setTimeout(
            () => root.querySelectorAll(".mxt-ag-row-changed").forEach(e => e.classList.remove("mxt-ag-row-changed")),
            1900
        );
    }, []);
    useEffect(() => () => window.clearTimeout(highlightTimer.current), []);

    // ---- Data (server mode): AG Grid infinite row model backed by the Mendix data source ---------
    const pendingRequest = useRef<PendingRequest | null>(null);
    const requestQueue = useRef<IGetRowsParams[]>([]);
    const reloadPending = useRef(false);
    const [serverEmpty, setServerEmpty] = useState(false);
    // Set once the first block arrived; until then the skeleton rows are shown.
    const [serverLoaded, setServerLoaded] = useState(false);

    // Hands the pending block to AG Grid when the data source holds exactly what was asked for
    // (same offset, limit, sort order and filter). Returns false when it does not (yet).
    // Only refs and state setters are used, so the function never changes.
    const resolveBlock = useCallback((ds: ListValue): boolean => {
        const pending = pendingRequest.current;
        if (!pending || ds.status !== "available") {
            return false;
        }
        const matches =
            ds.offset === pending.offset &&
            ds.limit === pending.limit &&
            JSON.stringify(ds.sortOrder) === pending.sortOrder &&
            JSON.stringify(ds.filter ?? null) === pending.filter;
        if (!matches) {
            return false;
        }
        const block = buildRows(ds.items, columnsRef.current);
        const total = ds.totalCount;
        const lastRow = total !== undefined ? total : block.length < pending.limit ? pending.offset + block.length : -1;
        pendingRequest.current = null;
        pending.params.successCallback(block, lastRow);
        if (pending.offset === 0) {
            setServerEmpty(block.length === 0);
            setServerLoaded(true);
            const api = apiRef.current;
            if (block.length === 0) {
                api?.showNoRowsOverlay();
            } else if (api && !api.getGridOption("loading")) {
                api.hideOverlay();
            }
        }
        return true;
    }, []);

    const processQueue = useCallback(() => {
        // A loop instead of recursion: every block the data source already holds is handed over at once.
        while (!pendingRequest.current && requestQueue.current.length > 0) {
            processNextRequest();
        }
        function processNextRequest(): void {
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
            // When the data source already holds this exact page (for example on the first request after
            // Mendix restored the page state), the setters change nothing, no re-render follows and the
            // effect below never runs: resolve from what the data source has right now.
            resolveBlock(ds);
        }
    }, [resolveBlock]);

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
        if (!serverMode || serverGroupActiveRef.current) {
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
            const changed: string[] = [];
            api?.forEachNode(node => {
                const item = node.data && current.get(node.data.id);
                if (item) {
                    const next = buildRow(item, columnsRef.current);
                    if (node.data && rowSignature(node.data) !== rowSignature(next)) {
                        changed.push(next.id);
                    }
                    node.setData(next);
                }
            });
            if (api) {
                refreshIssues(api);
                const skip = recentOwnEdits();
                const highlight = changed.filter(id => !skip.has(id));
                if (fullMotion && highlight.length > 0 && highlight.length <= MAX_HIGHLIGHTED_ROWS) {
                    highlightRows(highlight);
                }
            }
            return;
        }
        if (datasource.status !== "available") {
            return;
        }
        if (resolveBlock(datasource)) {
            processQueue();
        }
    }, [
        serverMode,
        datasource,
        items,
        processQueue,
        resolveBlock,
        refreshIssues,
        recentOwnEdits,
        fullMotion,
        highlightRows
    ]);

    // The skeleton (loading overlay) hides when the first block arrives; show the empty state after it.
    useEffect(() => {
        if (serverMode && serverLoaded && serverEmpty) {
            apiRef.current?.showNoRowsOverlay();
        }
    }, [serverMode, serverLoaded, serverEmpty]);

    // Browser mode: compare the rows with the previous data and highlight what a refresh changed.
    const rowSnapshot = useRef<Map<string, string> | undefined>(undefined);
    const dataAvailable = datasource.status === "available";
    useEffect(() => {
        if (serverMode || !dataAvailable) {
            return;
        }
        const diff = diffRows(rowSnapshot.current, rows);
        rowSnapshot.current = diff.snapshot;
        const ids = rowsToHighlight(diff, recentOwnEdits());
        if (!fullMotion || ids.length === 0) {
            return;
        }
        // Wait a frame so AG Grid has rendered the updated rows.
        const frame = window.requestAnimationFrame(() => highlightRows(ids));
        return () => window.cancelAnimationFrame(frame);
    }, [rows, serverMode, dataAvailable, fullMotion, recentOwnEdits, highlightRows]);

    // ---- Lazy server groups (group counts and pages through the one data source) ----------------------
    const [serverGroupBy, setServerGroupBy] = useState<string | undefined>(undefined);
    const serverGroupColumnIndex = /^col(\d+)$/.exec(serverGroupBy ?? "");
    const serverGroupColumn =
        serverGroupingAllowed && serverGroupColumnIndex ? columns[Number(serverGroupColumnIndex[1])] : undefined;
    const serverGroupActive = Boolean(serverGroupColumn && canServerGroup(serverGroupColumn));
    useLayoutEffect(() => {
        serverGroupActiveRef.current = serverGroupActive;
    });
    const [serverGroups, setServerGroups] = useState<ServerGroup[]>([]);
    const serverGroupsRef = useRef(serverGroups);
    useLayoutEffect(() => {
        serverGroupsRef.current = serverGroups;
    });
    // The queue reads the data source later, from its own callbacks, never during render.
    // eslint-disable-next-line react-hooks/refs
    const [dsQueue] = useState(() => new DatasourceQueue(() => datasourceRef.current));
    // Every data source update may answer the waiting request.
    useEffect(() => {
        if (serverGroupActive) {
            dsQueue.pump();
        }
    });
    useEffect(() => () => dsQueue.cancelAll(), [dsQueue]);
    const serverGeneration = useRef(0);
    const serverRequestBase = useCallback(() => {
        const api = apiRef.current;
        const sortModel = (api?.getColumnState() ?? [])
            .filter(state => state.sort)
            .sort((a, b) => (a.sortIndex ?? 0) - (b.sortIndex ?? 0))
            .map(state => ({ colId: state.colId, sort: state.sort as "asc" | "desc" }));
        return {
            sortOrder: buildSortOrder(sortModel, columnsRef.current),
            filter: buildFilter(
                (api?.getFilterModel() ?? {}) as FilterModel,
                quickFilterRef.current,
                columnsRef.current
            )
        };
    }, []);
    const loadServerGroups = useCallback(() => {
        const column = serverGroupColumn;
        const attribute = column?.attribute;
        if (!column || !attribute || !serverGroupActiveRef.current) {
            return;
        }
        dsQueue.cancelAll();
        const generation = ++serverGeneration.current;
        const values = serverGroupValues(column);
        const groups = initialServerGroups(values);
        // Groups that were open stay open and load their first page again.
        const wasOpen = new Set(serverGroupsRef.current.filter(group => group.open).map(group => group.path));
        setServerGroups(groups);
        const base = serverRequestBase();
        groups.forEach(group => {
            dsQueue
                .request({
                    filter: groupFilter(base.filter, attribute, group.value),
                    sortOrder: base.sortOrder,
                    offset: 0,
                    limit: wasOpen.has(group.path) ? effectivePageSize : 1,
                    build: (loaded, total) => ({
                        count: total ?? loaded.length,
                        rows: wasOpen.has(group.path)
                            ? buildRows(loaded, columnsRef.current).map(row => ({ ...row, snapshot: true }))
                            : []
                    })
                })
                .then(result => {
                    if (generation === serverGeneration.current) {
                        setServerGroups(current =>
                            updateGroup(current, group.path, {
                                count: result.count,
                                rows: result.rows,
                                open: wasOpen.has(group.path) && result.count > 0
                            })
                        );
                    }
                })
                .catch((error: Error) => {
                    if (generation === serverGeneration.current && error.message !== "cancelled") {
                        setServerGroups(current => updateGroup(current, group.path, { error: error.message }));
                    }
                });
        });
    }, [serverGroupColumn, dsQueue, serverRequestBase, effectivePageSize]);
    const loadServerGroupPage = useCallback(
        (path: string) => {
            const group = serverGroupsRef.current.find(entry => entry.path === path);
            const attribute = serverGroupColumn?.attribute;
            if (!group || !attribute) {
                return;
            }
            const generation = serverGeneration.current;
            setServerGroups(current => updateGroup(current, path, { loading: true, error: undefined, open: true }));
            const base = serverRequestBase();
            dsQueue
                .request({
                    filter: groupFilter(base.filter, attribute, group.value),
                    sortOrder: base.sortOrder,
                    offset: group.rows.length,
                    limit: effectivePageSize,
                    build: (loaded, total) => ({
                        total,
                        rows: buildRows(loaded, columnsRef.current).map(row => ({ ...row, snapshot: true }))
                    })
                })
                .then(result => {
                    if (generation !== serverGeneration.current) {
                        return;
                    }
                    setServerGroups(current => {
                        const existing = current.find(entry => entry.path === path);
                        const known = new Set((existing?.rows ?? []).map(row => row.id));
                        const rowsNext = [...(existing?.rows ?? []), ...result.rows.filter(row => !known.has(row.id))];
                        return updateGroup(current, path, {
                            loading: false,
                            rows: rowsNext,
                            count: result.total ?? existing?.count
                        });
                    });
                    announce(`${result.rows.length} rows loaded`);
                })
                .catch((error: Error) => {
                    if (generation === serverGeneration.current && error.message !== "cancelled") {
                        setServerGroups(current =>
                            updateGroup(current, path, { loading: false, error: error.message })
                        );
                    }
                });
        },
        [serverGroupColumn, dsQueue, serverRequestBase, effectivePageSize, announce]
    );
    const toggleServerGroup = useCallback(
        (path: string) => {
            const group = serverGroupsRef.current.find(entry => entry.path === path);
            if (!group) {
                return;
            }
            if (group.open) {
                setServerGroups(current => updateGroup(current, path, { open: false }));
                announce("Group collapsed");
            } else if (group.rows.length === 0 && (group.count ?? 1) > 0) {
                loadServerGroupPage(path);
            } else {
                setServerGroups(current => updateGroup(current, path, { open: true }));
                announce("Group expanded");
            }
        },
        [loadServerGroupPage, announce]
    );
    const serverGroupRows = useMemo(
        () =>
            serverGroupActive && serverGroupBy
                ? serverGroupDisplay(
                      serverGroups,
                      serverGroupBy,
                      serverGroupColumn?.header?.value ?? serverGroupBy,
                      EMPTY_GROUP_LABEL
                  )
                : [],
        [serverGroupActive, serverGroups, serverGroupBy, serverGroupColumn]
    );
    useLayoutEffect(() => {
        serverGroupOrderRef.current = serverGroupActive
            ? new Map(serverGroupRows.map((row, index) => [row.id, index]))
            : undefined;
    });
    /* eslint-disable react-hooks/refs */
    const serverGroupCellParams = useMemo(
        () =>
            serverGroupActive
                ? {
                      header: labelGroupColumn?.value ?? "Group",
                      isCollapsed: (path: string) => !serverGroupsRef.current.find(group => group.path === path)?.open,
                      onToggle: toggleServerGroup,
                      formatCount
                  }
                : undefined,
        [serverGroupActive, labelGroupColumn?.value, toggleServerGroup, formatCount]
    );
    /* eslint-enable react-hooks/refs */
    const loadMoreParams = useMemo<LoadMoreParams>(
        () => ({
            onLoadMore: loadServerGroupPage,
            label: () => textsRef.current.loadMore,
            loadingLabel: () => textsRef.current.loading,
            isLoading: path => Boolean(serverGroupsRef.current.find(group => group.path === path)?.loading),
            errorOf: path => serverGroupsRef.current.find(group => group.path === path)?.error
        }),
        [loadServerGroupPage]
    );
    // Group rows show their counts as they arrive.
    useEffect(() => {
        if (serverGroupActive) {
            apiRef.current?.refreshCells({ columns: [GROUP_COLUMN_ID], force: true });
            apiRef.current?.redrawRows({
                rowNodes: serverGroupRows
                    .filter(row => row.loadMore)
                    .map(row => apiRef.current?.getRowNode(row.id))
                    .filter((node): node is IRowNode<GridRow> => Boolean(node))
            });
        }
    }, [serverGroupActive, serverGroupRows]);
    const serverGroupTimer = useRef<number | undefined>(undefined);
    const scheduleServerGroups = useCallback(
        (delay: number) => {
            window.clearTimeout(serverGroupTimer.current);
            serverGroupTimer.current = window.setTimeout(loadServerGroups, delay);
        },
        [loadServerGroups]
    );
    useEffect(() => () => window.clearTimeout(serverGroupTimer.current), []);
    // Leaving or entering group mode remounts the grid with another row model; keep the column layout.
    const carriedLayout = useRef<{ columns: ColumnState[]; filters: FilterModel } | undefined>(undefined);
    const changeServerGroupBy = useCallback(
        (next: string | undefined) => {
            const api = apiRef.current;
            if (api) {
                carriedLayout.current = {
                    columns: api.getColumnState(),
                    filters: api.getFilterModel() as FilterModel
                };
            }
            pendingRequest.current = null;
            requestQueue.current = [];
            dsQueue.cancelAll();
            serverGeneration.current++;
            setServerGroups([]);
            setServerGroupBy(next);
            const caption = next ? captionOf(next) : "";
            announce(next ? `Grouped by ${caption}` : "Ungrouped");
            const action = onGroupByChangeRef.current;
            if (canRun(action)) {
                action?.execute({ groupBy: caption });
            }
        },
        [dsQueue, captionOf, announce]
    );

    // Quick search in server mode goes to the data source: refetch after the user stops typing.
    const quickFilterTimer = useRef<number | undefined>(undefined);
    useEffect(() => {
        if (!serverMode) {
            return;
        }
        window.clearTimeout(quickFilterTimer.current);
        quickFilterTimer.current = window.setTimeout(() => {
            if (serverGroupActiveRef.current) {
                loadServerGroups();
            } else {
                apiRef.current?.purgeInfiniteCache();
            }
        }, 400);
        return () => window.clearTimeout(quickFilterTimer.current);
        // Only a new search text refetches.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [serverMode, quickFilter]);

    // ---- Automatic refresh ------------------------------------------------------------------
    useEffect(() => {
        if (refreshInterval <= 0) {
            return;
        }
        const timer = window.setInterval(() => {
            if (serverGroupActiveRef.current) {
                loadServerGroups();
                return;
            }
            reloadPending.current = serverMode;
            datasourceRef.current.reload();
        }, refreshInterval * 1000);
        return () => window.clearInterval(timer);
    }, [refreshInterval, serverMode, loadServerGroups]);

    // ---- Commits: slow and failed saves are shown with Retry and Discard ------------------------------
    const commitTracker = useMemo(() => new CommitTracker(), []);
    const [commitSnapshot, setCommitSnapshot] = useState<CommitSnapshot>({ pending: 0, slow: 0, failed: [] });
    const commitKey = useRef("");
    const syncCommits = useCallback(() => {
        const next = commitTracker.snapshot();
        const signature = `${next.pending > 0}|${next.slow}|${next.failed.map(entry => entry.key).join(",")}`;
        if (signature !== commitKey.current) {
            commitKey.current = signature;
            setCommitSnapshot(next);
        }
    }, [commitTracker]);
    useEffect(() => commitTracker.subscribe(syncCommits), [commitTracker, syncCommits]);
    useEffect(() => {
        if (commitSnapshot.pending === 0) {
            return;
        }
        const timer = window.setInterval(syncCommits, 1000);
        return () => window.clearInterval(timer);
    }, [commitSnapshot.pending, syncCommits]);
    const commitMonitor = useCallback(
        (row: GridRow, colId: string, oldValue: unknown, newValue: unknown) =>
            commitTracker.monitor({ rowId: row.id, colId, oldValue, newValue }),
        [commitTracker]
    );

    // ---- Columns ----------------------------------------------------------------------------
    const key = columnsKey(columns);
    /* eslint-disable react-hooks/refs */
    const { columnDefs, autoSizeColumnIds } = useMemo(
        () =>
            // `getColumns` and the callbacks only read refs later, from AG Grid callbacks, never during this render.
            buildColumnDefs({
                columns,
                latest: getColumns,
                latestItems: getItems,
                showRowNumbers,
                rowDrag: rowDrag && !groupingActive && !serverGroupActive,
                flashOnChange,
                serverMode,
                // Held commits are committed by the widget once the object is valid.
                commit: commitOnEdit && !holdCommits,
                onWritten: handleWritten,
                dg2Filters: themeName === "atlas",
                detail: detailToggle,
                rowNumber: detailEnabled || groupingActive || treeEnabled ? rowNumberOf : undefined,
                group: serverGroupCellParams ?? groupCellParams,
                formatRanges: getFormatRanges,
                tree: treeCellParams,
                texts: getTexts,
                totalsMenu: totalsChangeable,
                commitMonitor
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
            holdCommits,
            handleWritten,
            themeName,
            detailToggle,
            detailEnabled,
            rowNumberOf,
            groupingActive,
            groupCellParams,
            getFormatRanges,
            serverGroupActive,
            serverGroupCellParams,
            treeEnabled,
            treeCellParams,
            getTexts,
            totalsChangeable,
            commitMonitor
        ]
    );
    /* eslint-enable react-hooks/refs */

    // Shift+arrow keys extend the cell range; AG Grid must not move the focus itself then.
    const suppressRangeKeys = useCallback(
        (params: SuppressKeyboardEventParams<GridRow>) =>
            rangeEnabled &&
            !params.editing &&
            params.event.type === "keydown" &&
            params.event.shiftKey &&
            !params.event.ctrlKey &&
            !params.event.metaKey &&
            ARROW_KEYS.has(params.event.key),
        [rangeEnabled]
    );
    const defaultColDef = useMemo<ColDef<GridRow>>(
        () => ({
            floatingFilter: floatingFilters,
            floatingFilterComponentParams: themeName === "atlas" ? { suppressFilterButton: true } : undefined,
            wrapHeaderText,
            autoHeaderHeight: wrapHeaderText,
            filterParams: { buttons: ["reset"] },
            suppressKeyboardEvent: rangeEnabled ? suppressRangeKeys : undefined
        }),
        [floatingFilters, wrapHeaderText, themeName, rangeEnabled, suppressRangeKeys]
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

    // ---- Theme ----------------------------------------------------------------------------------
    const theme = useMemo(
        () => buildTheme({ theme: themeName, colorScheme, accentColor, fontSize, spacing, density }),
        [themeName, colorScheme, accentColor, fontSize, spacing, density]
    );

    // ---- Selection --------------------------------------------------------------------------
    const rowSelection = useMemo<RowSelectionOptions<GridRow> | undefined>(() => {
        if (!selection) {
            return undefined;
        }
        const common = {
            checkboxes: checkboxSelection,
            enableClickSelection: clickSelection,
            isRowSelectable: (node: { data?: GridRow }) => isDataRow(node.data)
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
                const wanted = Boolean(node.data?.item && !node.data.detail && selectedIds.has(node.data.item.id));
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
    }, [syncSelectionToGrid, displayRows]);

    const handleSelectionChanged = useCallback(
        (event: SelectionChangedEvent<GridRow>) => {
            refreshStatusRef.current(event.api);
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
            scheduleViewCheck();
        },
        [quickFilterAttribute, setQuickFilter, scheduleViewCheck]
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
                if (groupState.touched || groupByRef.current.length > 0) {
                    state.groupBy = groupByRef.current;
                }
                if (densityRef.current) {
                    state.density = densityRef.current;
                }
                const extras = captureLayout(api, "", layoutExtras());
                if (extras.pivot) {
                    state.pivot = extras.pivot as PivotState;
                }
                if (extras.sidePanel) {
                    state.sidePanel = extras.sidePanel;
                }
                if (extras.totals) {
                    state.totals = extras.totals;
                }
                stateStore.write(JSON.stringify(state));
            }, 300);
        },
        [stateStore, stateSignature, groupState.touched, layoutExtras]
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
                if (Array.isArray(state.groupBy) && groupingAllowed) {
                    changeGroupBy(sanitizeGroupBy(state.groupBy, columnsRef.current), false);
                }
                if (isDensity(state.density)) {
                    setDensity(state.density);
                }
                applyLayoutExtras(state, false);
            } catch {
                // Ignore a corrupt state string; the configured layout is used instead.
            }
        },
        [stateStore, stateSignature, setQuickFilter, groupingAllowed, changeGroupBy, applyLayoutExtras]
    );

    const handleColumnStateEvent = useCallback(
        (event: { api: GridApi<GridRow>; source: string; finished?: boolean }) => {
            rangePaintRef.current();
            if (COLUMN_STATE_SOURCES_TO_IGNORE.has(event.source) || event.finished === false) {
                return;
            }
            persistState(event.api);
            scheduleViewCheck();
        },
        [persistState, scheduleViewCheck]
    );

    // ---- Column chooser ---------------------------------------------------------------------
    const [chooserColumns, setChooserColumns] = useState<ChooserColumn[]>([]);
    const refreshChooser = useCallback((api: GridApi<GridRow>) => {
        const list: ChooserColumn[] = [];
        // In display order, so the side panel shows moved columns where they are.
        (api.getAllGridColumns() ?? []).forEach(column => {
            const id = column.getColId();
            if (SYSTEM_COLUMN_IDS.has(id)) {
                return;
            }
            list.push({ id, name: column.getColDef().headerName ?? id, visible: column.isVisible() });
        });
        setChooserColumns(previous => (JSON.stringify(previous) === JSON.stringify(list) ? previous : list));
    }, []);

    const handleColumnMoved = useCallback(
        (event: { api: GridApi<GridRow>; source: string; finished?: boolean }) => {
            if (event.finished !== false) {
                refreshChooser(event.api);
            }
            handleColumnStateEvent(event);
        },
        [refreshChooser, handleColumnStateEvent]
    );

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

    // ---- Saved views ------------------------------------------------------------------------
    // Stored as JSON in the views attribute, or in the browser's local storage.
    const useViewsAttribute = Boolean(viewsAttribute);
    const viewsStorage = viewsStorageKey(viewsKey, props.name);
    const [localViews, setLocalViews] = useState(() => ({
        key: viewsStorage,
        doc: showViews && !useViewsAttribute ? readLocalViews(viewsStorage) : emptyViews()
    }));
    let localViewsDoc = localViews.doc;
    if (showViews && !useViewsAttribute && localViews.key !== viewsStorage) {
        localViewsDoc = readLocalViews(viewsStorage);
        setLocalViews({ key: viewsStorage, doc: localViewsDoc });
    }
    const viewsText = viewsAttribute?.value;
    const viewsDoc = useMemo(
        () => (useViewsAttribute ? parseViews(viewsText) : localViewsDoc),
        [useViewsAttribute, viewsText, localViewsDoc]
    );
    const viewsReady = showViews && (!viewsAttribute || viewsAttribute.status === "available");
    const viewsReadOnly = Boolean(viewsAttribute?.readOnly);

    // Another tab of the same browser changed the views.
    useEffect(() => {
        if (!showViews || useViewsAttribute) {
            return;
        }
        const listener = (event: StorageEvent): void => {
            if (event.key === viewsStorage) {
                setLocalViews({ key: viewsStorage, doc: parseViews(event.newValue) });
            }
        };
        window.addEventListener("storage", listener);
        return () => window.removeEventListener("storage", listener);
    }, [showViews, useViewsAttribute, viewsStorage]);

    const writeViews = useCallback(
        (doc: ViewsDocument) => {
            if (viewsAttribute) {
                if (!viewsAttribute.readOnly) {
                    viewsAttribute.setValue(serializeViews(doc));
                }
                return;
            }
            try {
                const text = serializeViews(doc);
                if (text) {
                    window.localStorage.setItem(viewsStorage, text);
                } else {
                    window.localStorage.removeItem(viewsStorage);
                }
            } catch {
                // Storage can be unavailable (private mode, quota); the views then live until the page closes.
            }
            setLocalViews({ key: viewsStorage, doc });
        },
        [viewsAttribute, viewsStorage]
    );

    const [activeViewId, setActiveViewId] = useState<string | undefined>(undefined);
    const activeView = findView(viewsDoc, activeViewId);
    const viewIdCounter = useRef(0);
    const outdatedViewIds = useMemo(
        () => new Set(viewsDoc.views.filter(view => !viewMatchesColumns(view, stateSignature)).map(view => view.id)),
        [viewsDoc, stateSignature]
    );

    const markViewActive = useCallback((id: string | undefined, layout?: ViewState) => {
        setActiveViewId(id);
        setViewDirty(false);
        activeViewKey.current = id && layout ? viewStateKey(layout) : undefined;
    }, []);

    const applyView = useCallback(
        (view: SavedView) => {
            const api = apiRef.current;
            if (!api) {
                return;
            }
            if (viewMatchesColumns(view, stateSignature)) {
                if (view.state.columns && view.state.columns.length > 0) {
                    api.applyColumnState({ state: view.state.columns, applyOrder: true });
                }
                api.setFilterModel(view.state.filters ?? null);
            }
            const quick = view.state.quickFilter ?? "";
            handleQuickFilterChange(quick);
            const viewGroupBy = groupingAllowed ? sanitizeGroupBy(view.state.groupBy ?? [], columnsRef.current) : [];
            if (groupingAllowed) {
                changeGroupBy(viewGroupBy, false);
            }
            const viewDensity = isDensity(view.state.density) ? view.state.density : undefined;
            setDensity(viewDensity);
            applyLayoutExtras(view.state, true);
            refreshChooser(api);
            persistState(api);
            // The view's own state is the reference for "changed since the view was applied".
            markViewActive(view.id, {
                ...captureLayout(api, quick, { groupBy: viewGroupBy, density: viewDensity }),
                pivot: view.state.pivot,
                sidePanel: view.state.sidePanel,
                totals: view.state.totals
            });
            announce(`View ${view.name} applied`);
        },
        [
            stateSignature,
            handleQuickFilterChange,
            refreshChooser,
            persistState,
            markViewActive,
            announce,
            groupingAllowed,
            changeGroupBy,
            applyLayoutExtras
        ]
    );

    const handleApplyView = useCallback(
        (id: string) => {
            const view = findView(viewsDoc, id);
            if (view) {
                applyView(view);
            }
        },
        [viewsDoc, applyView]
    );
    const currentViewState = useCallback(
        (api: GridApi<GridRow>): ViewState => ({
            signature: stateSignature,
            ...captureLayout(api, quickFilterRef.current, layoutExtras())
        }),
        [stateSignature, layoutExtras]
    );
    const handleSaveViewAs = useCallback(
        (name: string) => {
            const api = apiRef.current;
            if (!api) {
                return;
            }
            const now = Date.now();
            const state = currentViewState(api);
            const { doc, view } = saveView(viewsDoc, name, state, () => newViewId(now, ++viewIdCounter.current), now);
            writeViews(doc);
            markViewActive(view.id, state);
            announce(`View ${view.name} saved`);
        },
        [viewsDoc, currentViewState, writeViews, markViewActive, announce]
    );
    const handleUpdateView = useCallback(
        (id: string) => {
            const api = apiRef.current;
            if (!api) {
                return;
            }
            const state = currentViewState(api);
            writeViews(updateViewState(viewsDoc, id, state, Date.now()));
            markViewActive(id, state);
            announce("View updated");
        },
        [viewsDoc, currentViewState, writeViews, markViewActive, announce]
    );
    const handleRenameView = useCallback(
        (id: string, name: string) => writeViews(renameView(viewsDoc, id, name)),
        [viewsDoc, writeViews]
    );
    const handleDeleteView = useCallback(
        (id: string) => {
            writeViews(deleteView(viewsDoc, id));
            if (id === activeViewId) {
                markViewActive(undefined);
            }
            announce("View deleted");
        },
        [viewsDoc, writeViews, activeViewId, markViewActive, announce]
    );
    const handleToggleDefaultView = useCallback(
        (id: string) => writeViews(toggleDefaultView(viewsDoc, id)),
        [viewsDoc, writeViews]
    );
    const viewNameCheck = useCallback(
        (name: string, exceptId?: string) => viewNameProblem(viewsDoc, name, exceptId),
        [viewsDoc]
    );

    // The default view opens once, as soon as both the grid and the stored views are available.
    // It wins over a remembered layout ("Remember layout in").
    const [gridReady, setGridReady] = useState(false);

    // Hide grouped columns (option): their value is already in the group rows.
    const hiddenByGrouping = useRef<string[]>([]);
    useEffect(() => {
        const api = apiRef.current;
        if (!api || !hideGroupedColumns) {
            return;
        }
        const restore = hiddenByGrouping.current.filter(id => !groupBy.includes(id));
        if (restore.length > 0) {
            api.setColumnsVisible(restore, true);
        }
        const hide = groupBy.filter(id => api.getColumn(id)?.isVisible());
        if (hide.length > 0) {
            api.setColumnsVisible(hide, false);
        }
        hiddenByGrouping.current = [...groupBy];
    }, [groupBy, hideGroupedColumns, gridReady]);
    const defaultViewApplied = useRef(false);
    const viewToOpen = viewsReady ? defaultView(viewsDoc) : undefined;
    useEffect(() => {
        if (!gridReady || !viewsReady || defaultViewApplied.current) {
            return;
        }
        const frame = window.requestAnimationFrame(() => {
            defaultViewApplied.current = true;
            if (viewToOpen) {
                applyView(viewToOpen);
            }
        });
        return () => window.cancelAnimationFrame(frame);
    }, [gridReady, viewsReady, viewToOpen, applyView]);

    // ---- Totals row -------------------------------------------------------------------------
    // The main totals row (top or bottom) plus, with 'Top and bottom', a second row at the top.
    const [totalsRows, setTotalsRows] = useState<{ top: GridRow[]; bottom: GridRow[] }>({ top: [], bottom: [] });
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
                    setTotalsRows({ top: [], bottom: [] });
                }
                return;
            }
            let row: GridRow;
            let extraTop: GridRow | undefined;
            if (totalsFromDatasource) {
                row = totalsFromItem(totalsItem, columnsRef.current, totalsLabelText);
                if (totalsRow === "both") {
                    extraTop = { ...row, id: TOTALS_TOP_ROW_ID };
                }
            } else {
                const loaded: GridRow[] = [];
                const collect = (node: IRowNode<GridRow>): void => {
                    if (isDataRow(node.data)) {
                        loaded.push(node.data);
                    }
                };
                if (serverMode) {
                    api.forEachNode(collect);
                } else {
                    api.forEachNodeAfterFilter(collect);
                }
                const overrides = totalsOverridesRef.current;
                row = computeTotalsFromRows(loaded, columnsRef.current, totalsLabelText, overrides[TOTALS_ROW_ID]);
                if (totalsRow === "both") {
                    extraTop = computeTotalsFromRows(
                        loaded,
                        columnsRef.current,
                        totalsLabelText,
                        overrides[TOTALS_TOP_ROW_ID],
                        "top"
                    );
                }
            }
            const next =
                totalsRow === "top" ? { top: [row], bottom: [] } : { top: extraTop ? [extraTop] : [], bottom: [row] };
            const serialized = JSON.stringify([
                next.top.map(entry => entry.cells),
                next.bottom.map(entry => entry.cells)
            ]);
            if (serialized !== totalsKey.current) {
                totalsKey.current = serialized;
                setTotalsRows(next);
            }
        },
        // totalsItemVersion changes when the totals data source reloads, so the row is recomputed then;
        // totalsOverrides when the user picked another function.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [totalsRow, totalsLabelText, serverMode, totalsFromDatasource, totalsItem, totalsItemVersion, totalsOverrides]
    );

    useEffect(() => {
        if (apiRef.current) {
            refreshTotals(apiRef.current);
        }
    }, [refreshTotals, rows]);

    // ---- Status bar ---------------------------------------------------------------------------
    const [status, setStatus] = useState<StatusSummary | undefined>(undefined);
    const statusKeyRef = useRef("");
    const refreshStatus = useCallback(
        (api: GridApi<GridRow>) => {
            if (!showStatusBar) {
                return;
            }
            const shown: GridRow[] = [];
            const collect = (node: IRowNode<GridRow>): void => {
                if (isDataRow(node.data)) {
                    shown.push(node.data);
                }
            };
            if (serverMode) {
                api.forEachNode(collect);
            } else {
                api.forEachNodeAfterFilter(collect);
            }
            const selected = api.getSelectedRows().filter(isDataRow);
            const total = serverMode ? datasourceRef.current.totalCount ?? shown.length : itemsRef.current.length;
            const summary = statusSummary(
                shown,
                selected,
                total,
                columnsRef.current,
                id => api.getColumn(id)?.getColDef().headerName ?? id,
                id => api.getColumn(id)?.isVisible() ?? false
            );
            if (serverMode) {
                summary.shown = total;
            }
            const next = summaryKey(summary);
            if (next !== statusKeyRef.current) {
                statusKeyRef.current = next;
                setStatus(summary);
            }
        },
        [showStatusBar, serverMode]
    );

    useLayoutEffect(() => {
        refreshStatusRef.current = refreshStatus;
    });
    useEffect(() => {
        if (apiRef.current) {
            refreshStatus(apiRef.current);
        }
    }, [refreshStatus, rows]);

    // ---- Search highlight ------------------------------------------------------------------------
    const highlightInstance = useId();
    const highlightFrame = useRef<number | undefined>(undefined);
    const scheduleHighlight = useCallback(() => {
        if (typeof window.requestAnimationFrame !== "function") {
            return;
        }
        window.cancelAnimationFrame(highlightFrame.current ?? 0);
        highlightFrame.current = window.requestAnimationFrame(() =>
            highlightSearch(highlightInstance, rootRef.current, highlightSearchOn ? quickFilterRef.current : "")
        );
    }, [highlightInstance, highlightSearchOn]);
    useEffect(() => {
        scheduleHighlight();
        // Cells of a new filter result render a moment later than the model update.
        const timer = window.setTimeout(scheduleHighlight, 120);
        return () => window.clearTimeout(timer);
    }, [quickFilter, scheduleHighlight]);
    useEffect(
        () => () => {
            window.cancelAnimationFrame(highlightFrame.current ?? 0);
            clearSearchHighlight(highlightInstance);
        },
        [highlightInstance]
    );

    // A rebuilt tree model with the same row ids (parent keys that arrived after the rows) does not make AG Grid
    // arrange again or repaint the unchanged tree cells: do both once the new row data is applied.
    const firstTreeModel = useRef(true);
    useEffect(() => {
        if (!treeModel) {
            return undefined;
        }
        if (firstTreeModel.current) {
            firstTreeModel.current = false;
            return undefined;
        }
        const timer = window.setTimeout(() => {
            const api = apiRef.current;
            if (!api || api.isDestroyed()) {
                return;
            }
            api.refreshClientSideRowModel("sort");
            api.refreshCells({ columns: [TREE_COLUMN_ID], force: true });
        }, 0);
        return () => window.clearTimeout(timer);
    }, [treeModel]);

    const handleModelUpdated = useCallback(
        (event: { api: GridApi<GridRow> }) => {
            refreshTotals(event.api);
            refreshIssues(event.api);
            refreshStatus(event.api);
            if (showRowNumbers) {
                // Row indexes change on sort, filter and paging, but the cells only re-render when forced.
                event.api.refreshCells({ columns: [ROW_NUMBER_COLUMN_ID], force: true });
            }
            const arranged = arrangedRef.current;
            if (arranged) {
                // Group counts and aggregates were recomputed while arranging; show them.
                const groupNodes: Array<IRowNode<GridRow>> = [];
                arranged.display.forEach(node => {
                    if (node.data?.group) {
                        groupNodes.push(node);
                    }
                });
                if (groupNodes.length > 0) {
                    event.api.refreshCells({ rowNodes: groupNodes, force: true });
                }
            }
            const tree = arrangedTreeRef.current;
            if (tree) {
                // Descendant counts and aggregates per parent were recomputed: refresh the parents.
                const parents: Array<IRowNode<GridRow>> = [];
                event.api.forEachNodeAfterFilterAndSort(node => {
                    if (node.data?.tree?.hasChildren) {
                        parents.push(node);
                    }
                });
                if (parents.length > 0) {
                    event.api.refreshCells({ rowNodes: parents, force: true });
                }
                // Rows that started or stopped being context rows get their (dimmed) row class again.
                const before = treeContextSeen.current;
                const changed = [...tree.contextIds].filter(id => !before.has(id));
                before.forEach(id => {
                    if (!tree.contextIds.has(id)) {
                        changed.push(id);
                    }
                });
                treeContextSeen.current = new Set(tree.contextIds);
                const nodes = changed
                    .map(id => event.api.getRowNode(id))
                    .filter((node): node is IRowNode<GridRow> => Boolean(node));
                if (nodes.length > 0) {
                    event.api.redrawRows({ rowNodes: nodes });
                }
            }
            refreshPivotSource(event.api);
            rangePaintRef.current();
            scheduleHighlight();
        },
        [refreshTotals, refreshIssues, refreshStatus, showRowNumbers, scheduleHighlight, refreshPivotSource]
    );

    // ---- Grid events ------------------------------------------------------------------------
    const handleGridReady = useCallback(
        (event: GridReadyEvent<GridRow>) => {
            apiRef.current = event.api;
            const carried = carriedLayout.current;
            if (carried) {
                // The grid was remounted for lazy server groups (or back): keep the user's layout.
                carriedLayout.current = undefined;
                event.api.applyColumnState({ state: carried.columns, applyOrder: true });
                event.api.setFilterModel(carried.filters);
            } else {
                restoreState(event.api);
            }
            refreshChooser(event.api);
            syncSelectionToGrid(event.api);
            refreshTotals(event.api);
            setFilterModelState(event.api.getFilterModel() as FilterModel);
            setGridReady(true);
            if (serverGroupActiveRef.current) {
                loadServerGroups();
            }
        },
        [restoreState, refreshChooser, syncSelectionToGrid, refreshTotals, loadServerGroups]
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

    // ---- Totals menu (Users can change totals) ------------------------------------------------------
    const [totalsMenu, setTotalsMenu] = useState<
        { colId: string; rowId: string; anchor: { top: number; left: number; bottom: number } } | undefined
    >(undefined);
    const openTotalsMenu = useCallback(
        (rowId: string, colId: string, element: Element | null | undefined) => {
            const column = findColumn(colId);
            if (!totalsChangeable || !column || column.columnType === "customContent" || !element) {
                return false;
            }
            const rect = element.getBoundingClientRect();
            setTotalsMenu({ colId, rowId, anchor: { top: rect.top, left: rect.left, bottom: rect.bottom } });
            return true;
        },
        [findColumn, totalsChangeable]
    );
    const chooseTotal = useCallback(
        (choice: AggregateChoice) => {
            const menu = totalsMenu;
            if (!menu) {
                return;
            }
            setTotalsOverrides(previous => ({
                ...previous,
                [menu.rowId]: { ...previous[menu.rowId], [menu.colId]: choice }
            }));
            setTotalsMenu(undefined);
            announce(`${captionOf(menu.colId)}: ${aggregateLabel(texts, choice)}`);
            // Back to the totals cell, so keyboard users continue where they were.
            window.requestAnimationFrame(() => {
                const api = apiRef.current;
                const pinned = totalsRow === "top" || menu.rowId === TOTALS_TOP_ROW_ID ? "top" : "bottom";
                api?.setFocusedCell(0, menu.colId, pinned);
            });
        },
        [totalsMenu, announce, captionOf, texts, totalsRow]
    );
    useEffect(() => {
        if (apiRef.current) {
            refreshTotals(apiRef.current);
        }
    }, [totalsOverrides, refreshTotals]);
    const handleCellKeyDown = useCallback(
        (event: CellKeyDownEvent<GridRow>) => {
            const keyboard = event.event as
                | { key: string; altKey: boolean; preventDefault: () => void }
                | null
                | undefined;
            if (!keyboard || !event.data?.totals || !totalsChangeable) {
                return;
            }
            if (keyboard.key === "Enter" || keyboard.key === " " || (keyboard.altKey && keyboard.key === "ArrowDown")) {
                const active = document.activeElement?.closest(".ag-cell");
                if (openTotalsMenu(event.data.id, event.column.getColId(), active)) {
                    keyboard.preventDefault();
                }
            }
        },
        [totalsChangeable, openTotalsMenu]
    );

    const handleCellClicked = useCallback(
        (event: CellClickedEvent<GridRow>) => {
            if (event.data?.totals && totalsChangeable) {
                const target = (event.event?.target as Element | null)?.closest(".ag-cell");
                openTotalsMenu(event.data.id, event.column.getColId(), target);
                return;
            }
            const item = event.data?.item;
            if (
                !item ||
                event.data?.totals ||
                event.data?.detail ||
                event.data?.group ||
                event.colDef.colId === DETAIL_COLUMN_ID
            ) {
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
        [findColumn, onRowClick, totalsChangeable, openTotalsMenu]
    );

    const handleRowDoubleClicked = useCallback(
        (event: RowDoubleClickedEvent<GridRow>) => {
            const item = event.data?.item;
            if (!item || !isDataRow(event.data)) {
                return;
            }
            const action = onRowDoubleClick?.get(item);
            if (canRun(action)) {
                action?.execute();
            }
        },
        [onRowDoubleClick]
    );

    // ---- Issue navigation and the focused cell's error ----------------------------------------
    const goToIssue = useCallback(
        (direction: 1 | -1) => {
            const api = apiRef.current;
            if (!api) {
                return;
            }
            const colOrder = api.getAllDisplayedColumns().map(column => column.getColId());
            const focused = api.getFocusedCell();
            const current =
                focused && !focused.rowPinned
                    ? { rowIndex: focused.rowIndex, colId: focused.column.getColId() }
                    : undefined;
            const target = nextIssue(issuesRef.current, current, colOrder, direction);
            if (!target) {
                return;
            }
            // An issue in a hidden column: go to the row's first data cell instead.
            const colId = colOrder.includes(target.colId)
                ? target.colId
                : colOrder.find(id => !SYSTEM_COLUMN_IDS.has(id));
            if (pagination) {
                const page = Math.floor(target.rowIndex / Math.max(1, api.paginationGetPageSize()));
                if (page !== api.paginationGetCurrentPage()) {
                    api.paginationGoToPage(page);
                }
            }
            api.ensureIndexVisible(target.rowIndex, "middle");
            if (colId) {
                api.ensureColumnVisible(colId);
                api.setFocusedCell(target.rowIndex, colId);
            }
            announce(target.message);
        },
        [pagination, announce]
    );

    // The focused invalid cell points to a hidden description with its error (aria-describedby).
    const issueDescriptionId = `${useId()}-issue`;
    const [focusedIssue, setFocusedIssue] = useState("");
    const describedCell = useRef<Element | null>(null);
    const handleCellFocused = useCallback(
        (event: CellFocusedEvent<GridRow>) => {
            if (!validationEnabled) {
                return;
            }
            const colId = typeof event.column === "string" ? event.column : event.column?.getColId();
            const node =
                event.rowIndex != null && !event.rowPinned
                    ? event.api.getDisplayedRowAtIndex(event.rowIndex)
                    : undefined;
            const message = (node?.data && colId ? cellError(node.data.cells[colId]) : undefined) ?? "";
            setFocusedIssue(message);
            window.requestAnimationFrame(() => {
                describedCell.current?.removeAttribute("aria-describedby");
                describedCell.current?.removeAttribute("aria-invalid");
                describedCell.current = null;
                const active = document.activeElement;
                if (message && active?.classList.contains("ag-cell") && rootRef.current?.contains(active)) {
                    active.setAttribute("aria-describedby", issueDescriptionId);
                    active.setAttribute("aria-invalid", "true");
                    describedCell.current = active;
                }
            });
        },
        [validationEnabled, issueDescriptionId]
    );

    // ---- Copy the focused cell or row (AG Grid Community has no clipboard support) -----------------
    const copyFocused = useCallback(
        (wholeRow: boolean): boolean => {
            const api = apiRef.current;
            const selected = window.getSelection()?.toString();
            if (!api || api.getEditingCells().length > 0 || selected) {
                return false;
            }
            const focused = api.getFocusedCell();
            if (!focused || focused.rowPinned) {
                return false;
            }
            const node = api.getDisplayedRowAtIndex(focused.rowIndex);
            const row = node?.data;
            if (!node || !row || row.detail || row.group || !navigator.clipboard) {
                return false;
            }
            const colIds = wholeRow
                ? api
                      .getAllDisplayedColumns()
                      .map(column => column.getColId())
                      .filter(id => !SYSTEM_COLUMN_IDS.has(id) && findColumn(id)?.columnType !== "customContent")
                : [focused.column.getColId()];
            navigator.clipboard
                .writeText(rowAsText(row, colIds))
                .then(() => {
                    announce(wholeRow ? "Row copied" : "Cell copied");
                    if (fullMotion) {
                        api.flashCells({ rowNodes: [node], columns: colIds, flashDuration: 250, fadeDuration: 500 });
                    }
                })
                .catch(() => undefined);
            return true;
        },
        [findColumn, announce, fullMotion]
    );

    const [helpOpen, setHelpOpen] = useState(false);
    const shortcuts = useMemo(
        () =>
            shortcutsFor({
                editing: columns.some(column => Boolean(column.editable)),
                undoRedo,
                selection: Boolean(selection),
                detail: detailEnabled,
                validation: validationEnabled,
                quickSearch: showQuickFilter,
                paste: clipboardPaste,
                grouping: groupingAllowed || serverGroupingAllowed,
                tree: treeEnabled,
                range: rangeEnabled,
                fill: rangeEnabled && Boolean(fillHandle),
                chart: rangeEnabled && Boolean(rangeChart),
                totals: totalsChangeable
            }),
        [
            serverGroupingAllowed,
            treeEnabled,
            rangeEnabled,
            fillHandle,
            rangeChart,
            totalsChangeable,
            columns,
            undoRedo,
            selection,
            detailEnabled,
            validationEnabled,
            showQuickFilter,
            clipboardPaste,
            groupingAllowed
        ]
    );

    // ---- Undo / redo (own stack: Mendix data refreshes would clear the AG Grid one) ------------
    // Every entry is one user action: a single edit, or all cells of one paste.
    const undoStack = useRef<EditRecord[][]>([]);
    const redoStack = useRef<EditRecord[][]>([]);

    const handleCellValueChanged = useCallback(
        (event: CellValueChangedEvent<GridRow>) => {
            const item = event.data?.item;
            if (!item) {
                return;
            }
            ownEdits.current.set(event.data.id, Date.now());
            const record: EditRecord = {
                rowId: event.data.id,
                colId: event.colDef.colId ?? "",
                oldValue: event.oldValue,
                newValue: event.newValue
            };
            // A paste records its edits itself, as one undo entry (grid events arrive asynchronously).
            if (!OWN_SOURCES.has(event.source ?? "")) {
                undoStack.current.push([record]);
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

    /** Applies the old (undo) or new (redo) values of one undo entry; false when none of its rows exists. */
    const applyEdit = useCallback((records: EditRecord[], undo: boolean): boolean => {
        const api = apiRef.current;
        if (!api) {
            return false;
        }
        let applied = false;
        const ordered = undo ? [...records].reverse() : records;
        ordered.forEach(record => {
            const node = api.getRowNode(record.rowId);
            if (node) {
                const value = undo ? record.oldValue : record.newValue;
                // Boolean columns are typed as text in AG Grid, which rejects a boolean in setDataValue.
                node.setDataValue(record.colId, typeof value === "boolean" ? String(value) : value, UNDO_SOURCE);
                api.flashCells({ rowNodes: [node], columns: [record.colId] });
                applied = true;
            }
        });
        return applied;
    }, []);

    // ---- Cell range selection (own implementation; range selection is Enterprise-only) -------------
    const isRangeColumn = useCallback(
        (colId: string) => !SYSTEM_COLUMN_IDS.has(colId) && findColumn(colId)?.columnType !== "customContent",
        [findColumn]
    );
    const fillRef = useRef<(range: NormalizedRange, target: FillTarget, invert: boolean) => void>(() => undefined);
    const rangeChangedRef = useRef<() => void>(() => undefined);
    const rangeSel = useRangeSelection({
        enabled: rangeEnabled && !pivotActive,
        fillHandle: Boolean(fillHandle),
        rootRef,
        apiRef,
        isRangeColumn,
        onFill: (range, target, invert) => fillRef.current(range, target, invert),
        onChange: () => rangeChangedRef.current()
    });
    const rangeCount = rangeSel.cellCount;
    const rangeSchedulePaint = rangeSel.schedulePaint;
    useLayoutEffect(() => {
        rangePaintRef.current = rangeEnabled ? rangeSchedulePaint : () => undefined;
    });
    /** The data row cell at a display index; undefined for group, detail, generated and pinned rows. */
    const cellAt = useCallback((rowIndex: number, colId: string): CellData | undefined => {
        const row = apiRef.current?.getDisplayedRowAtIndex(rowIndex)?.data;
        return isDataRow(row) ? row.cells[colId] ?? { value: undefined, display: "", readOnly: true } : undefined;
    }, []);

    /** Writes cells through the normal edit path (valueSetter, commit, On commit) as one undo step. */
    const writeCells = useCallback(
        (cells: Array<{ rowIndex: number; colId: string; value: unknown }>, source: string) => {
            const api = apiRef.current;
            const batch: EditRecord[] = [];
            let skipped = 0;
            if (!api) {
                return { batch, skipped };
            }
            const changedNodes = new Set<IRowNode<GridRow>>();
            const changedCols = new Set<string>();
            cells.forEach(cell => {
                const node = api.getDisplayedRowAtIndex(cell.rowIndex);
                const column = api.getColumn(cell.colId);
                const config = findColumn(cell.colId);
                if (!node || !isDataRow(node.data) || !column || !config || !column.isCellEditable(node)) {
                    skipped++;
                    return;
                }
                const kind = cellKind(config);
                const coerced = coerceForColumn(
                    kind,
                    cell.value,
                    kind === "enum" ? (config.attribute?.universe as string[] | undefined) : undefined
                );
                if (!coerced.ok) {
                    skipped++;
                    return;
                }
                const oldValue = node.data.cells[cell.colId]?.value;
                if (node.setDataValue(cell.colId, coerced.value, source) && node.data) {
                    batch.push({
                        rowId: node.data.id,
                        colId: cell.colId,
                        oldValue,
                        newValue: node.data.cells[cell.colId]?.value
                    });
                    changedNodes.add(node);
                    changedCols.add(cell.colId);
                }
            });
            if (batch.length > 0) {
                undoStack.current.push(batch);
                if (undoStack.current.length > 100) {
                    undoStack.current.shift();
                }
                redoStack.current = [];
                if (lively) {
                    api.flashCells({ rowNodes: Array.from(changedNodes), columns: Array.from(changedCols) });
                }
            }
            return { batch, skipped };
        },
        [findColumn, lively]
    );

    const onFillRef = useRef(onFill);
    useLayoutEffect(() => {
        onFillRef.current = onFill;
    });
    const finishFill = useCallback(
        (cells: Array<{ rowIndex: number; colId: string; value: unknown }>) => {
            const { batch, skipped } = writeCells(cells, FILL_SOURCE);
            announce(`${batch.length} cells filled${skipped > 0 ? `, ${skipped} skipped` : ""}`);
            const action = onFillRef.current;
            if (batch.length > 0 && canRun(action)) {
                action?.execute({ cellCount: new Big(batch.length) });
            }
            return batch.length;
        },
        [writeCells, announce]
    );
    const handleFill = useCallback(
        (range: NormalizedRange, target: FillTarget, invert: boolean) => {
            const cells = planFill(
                range,
                target,
                rangeSel.columnOrder(),
                (rowIndex, colId) => cellAt(rowIndex, colId)?.value,
                invert ? "invert" : "auto"
            );
            if (cells.length === 0) {
                return;
            }
            finishFill(cells);
            // Like a spreadsheet: the range grows over the filled cells.
            rangeSel.setRange({
                start: { rowIndex: range.top, colId: range.colIds[0] },
                end:
                    target.bottom !== undefined
                        ? { rowIndex: target.bottom, colId: range.colIds[range.colIds.length - 1] }
                        : { rowIndex: range.bottom, colId: target.rightColId as string }
            });
        },
        [rangeSel, cellAt, finishFill]
    );
    useLayoutEffect(() => {
        fillRef.current = handleFill;
    });
    const fillDown = useCallback((): boolean => {
        const range = rangeSel.normalized();
        if (!range || range.bottom === range.top) {
            return false;
        }
        finishFill(planFillDown(range, (rowIndex, colId) => cellAt(rowIndex, colId)?.value));
        return true;
    }, [rangeSel, cellAt, finishFill]);

    const copyRange = useCallback((): boolean => {
        const range = rangeSel.normalized();
        if (!range || rangeCount < 2 || !navigator.clipboard) {
            return false;
        }
        const text = rangeToTsv(range, (rowIndex, colId) => cellAt(rowIndex, colId)?.display);
        navigator.clipboard
            .writeText(text)
            .then(() => announce(`${rangeCount} cells copied`))
            .catch(() => undefined);
        return true;
    }, [rangeSel, rangeCount, cellAt, announce]);

    const [chartData, setChartData] = useState<ChartData | undefined>(undefined);
    const openChart = useCallback(() => {
        const range = rangeSel.normalized();
        if (!range) {
            announce(texts.noChartData);
            return;
        }
        const data = chartDataFromRange(range, cellAt, captionOf);
        if (!hasChartData(data)) {
            announce(texts.noChartData);
            return;
        }
        setChartData(data);
    }, [rangeSel, cellAt, captionOf, announce, texts]);

    // Count, sum and average of the range for the status bar.
    const [rangeSummary, setRangeSummary] = useState<Array<{ label: string; value: string }> | undefined>(undefined);
    const updateRangeSummary = useCallback(() => {
        const range = rangeEnabled ? rangeSel.normalized() : undefined;
        if (!range || (range.bottom - range.top + 1) * range.colIds.length < 2) {
            setRangeSummary(undefined);
            return;
        }
        const values: unknown[] = [];
        for (let row = range.top; row <= range.bottom; row++) {
            range.colIds.forEach(colId => {
                const cell = cellAt(row, colId);
                if (cell) {
                    values.push(cell.value);
                }
            });
        }
        const stats = rangeStats(values);
        const format = new Intl.NumberFormat(intlLocale(), { maximumFractionDigits: 2 });
        setRangeSummary([
            { label: texts.rangeCount, value: format.format(stats.count) },
            ...(stats.numbers > 0
                ? [
                      { label: texts.rangeSum, value: format.format(stats.sum) },
                      { label: texts.rangeAvg, value: format.format(stats.avg ?? 0) }
                  ]
                : [])
        ]);
    }, [rangeEnabled, rangeSel, cellAt, texts]);
    useLayoutEffect(() => {
        rangeChangedRef.current = updateRangeSummary;
    });

    // ---- Paste from Excel (AG Grid Community has no clipboard support) ---------------------------
    const onPasteRef = useRef(onPaste);
    useLayoutEffect(() => {
        onPasteRef.current = onPaste;
    });
    const handlePaste = useCallback(
        (event: ClipboardEvent<HTMLDivElement>) => {
            const api = apiRef.current;
            if (!clipboardPaste || !api || isTypingTarget(event.target) || api.getEditingCells().length > 0) {
                return;
            }
            const focused = api.getFocusedCell();
            const text = event.clipboardData?.getData("text/plain");
            if (!focused || focused.rowPinned || !text) {
                return;
            }
            const block = parseClipboard(text);
            if (block.length === 0) {
                return;
            }
            const range = rangeEnabled && rangeCount > 1 ? rangeSel.normalized() : undefined;
            if (range && block.length === 1 && block[0].length === 1) {
                // One copied value fills the whole selected range, like a spreadsheet.
                event.preventDefault();
                const monthFirstRange = localeIsMonthFirst(intlLocale());
                const cells: Array<{ rowIndex: number; colId: string; value: unknown }> = [];
                range.colIds.forEach(colId => {
                    const config = findColumn(colId);
                    if (!config) {
                        return;
                    }
                    const kind = cellKind(config);
                    const attribute = config.attribute;
                    const parsed = parsePastedValue(kind, block[0][0], {
                        monthFirst: monthFirstRange,
                        enumCaptions: kind === "enum" && attribute ? enumCaptions(attribute) : undefined,
                        booleanCaptions:
                            kind === "boolean" && attribute
                                ? {
                                      yes: formatValue(attribute, "boolean", true),
                                      no: formatValue(attribute, "boolean", false)
                                  }
                                : undefined
                    });
                    if (!parsed.ok) {
                        return;
                    }
                    for (let rowIndex = range.top; rowIndex <= range.bottom; rowIndex++) {
                        cells.push({ rowIndex, colId, value: parsed.value });
                    }
                });
                const { batch, skipped } = writeCells(cells, PASTE_SOURCE);
                announce(batch.length + " cells pasted" + (skipped > 0 ? ", " + skipped + " skipped" : ""));
                const pasteAction = onPasteRef.current;
                if (batch.length > 0 && canRun(pasteAction)) {
                    pasteAction?.execute({ cellCount: new Big(batch.length) });
                }
                return;
            }
            // Target rows: data rows from the focused one downwards; a single value fills the selected rows.
            const selectedNodes = api.getSelectedNodes().filter(node => isDataRow(node.data));
            const single = block.length === 1 && block[0].length === 1;
            let targetRows: Array<IRowNode<GridRow>> = [];
            if (single && selectedNodes.length > 1) {
                targetRows = selectedNodes;
            } else {
                for (let index = focused.rowIndex; index < api.getDisplayedRowCount(); index++) {
                    const node = api.getDisplayedRowAtIndex(index);
                    if (node && isDataRow(node.data)) {
                        targetRows.push(node);
                        if (targetRows.length >= block.length) {
                            break;
                        }
                    }
                }
            }
            const displayed = api.getAllDisplayedColumns().map(column => column.getColId());
            const targetCols = displayed
                .slice(Math.max(0, displayed.indexOf(focused.column.getColId())))
                .filter(id => !SYSTEM_COLUMN_IDS.has(id));
            const plan = planPaste(block, targetRows.length, targetCols.length, single ? targetRows.length : 0);
            if (plan.length === 0) {
                return;
            }
            event.preventDefault();
            const monthFirst = localeIsMonthFirst(intlLocale());
            const batch: EditRecord[] = [];
            const changedNodes = new Set<IRowNode<GridRow>>();
            const changedCols = new Set<string>();
            let skipped = 0;
            plan.forEach(cell => {
                const node = targetRows[cell.rowOffset];
                const colId = targetCols[cell.colOffset];
                const column = api.getColumn(colId);
                const config = findColumn(colId);
                if (!node || !column || !config || !column.isCellEditable(node)) {
                    skipped++;
                    return;
                }
                const kind = cellKind(config);
                const attribute = config.attribute;
                const parsed = parsePastedValue(kind, cell.text, {
                    monthFirst,
                    enumCaptions: kind === "enum" && attribute ? enumCaptions(attribute) : undefined,
                    booleanCaptions:
                        kind === "boolean" && attribute
                            ? {
                                  yes: formatValue(attribute, "boolean", true),
                                  no: formatValue(attribute, "boolean", false)
                              }
                            : undefined
                });
                if (!parsed.ok) {
                    skipped++;
                    return;
                }
                const oldValue = node.data?.cells[colId]?.value;
                // Boolean columns are typed as text in AG Grid (so filters match Yes/No); hand over text.
                const gridValue = kind === "boolean" ? String(parsed.value) : parsed.value;
                if (node.setDataValue(colId, gridValue, PASTE_SOURCE) && node.data) {
                    batch.push({ rowId: node.data.id, colId, oldValue, newValue: node.data.cells[colId]?.value });
                    changedNodes.add(node);
                    changedCols.add(colId);
                }
            });
            if (batch.length > 0) {
                undoStack.current.push(batch);
                if (undoStack.current.length > 100) {
                    undoStack.current.shift();
                }
                redoStack.current = [];
                if (lively) {
                    api.flashCells({ rowNodes: Array.from(changedNodes), columns: Array.from(changedCols) });
                }
            }
            announce(batch.length + " cells pasted" + (skipped > 0 ? ", " + skipped + " skipped" : ""));
            const action = onPasteRef.current;
            if (batch.length > 0 && canRun(action)) {
                action?.execute({ cellCount: new Big(batch.length) });
            }
        },
        [clipboardPaste, findColumn, lively, announce, rangeEnabled, rangeCount, rangeSel, writeCells]
    );

    const handleKeyDown = useCallback(
        (event: KeyboardEvent<HTMLDivElement>) => {
            // Never steal keys from the search box, a cell editor or inputs inside custom content.
            if (isTypingTarget(event.target)) {
                return;
            }
            const api = apiRef.current;
            const modifier = event.ctrlKey || event.metaKey;
            const keyName = event.key.toLowerCase();
            if (rangeEnabled && api && !pivotActive) {
                if (event.shiftKey && !modifier && !event.altKey && ARROW_KEYS.has(event.key)) {
                    const focused = api.getFocusedCell();
                    const colId = focused?.column.getColId();
                    if (focused && !focused.rowPinned && colId && isRangeColumn(colId)) {
                        event.preventDefault();
                        const here = { rowIndex: focused.rowIndex, colId };
                        const current: CellRange = rangeSel.range ?? { start: here, end: here };
                        const next = extendRange(
                            current,
                            event.key as ArrowKey,
                            rangeSel.columnOrder(),
                            api.getDisplayedRowCount(),
                            rtl
                        );
                        rangeSel.setRange(next);
                        api.ensureIndexVisible(next.end.rowIndex);
                        api.ensureColumnVisible(next.end.colId);
                        api.setFocusedCell(next.end.rowIndex, next.end.colId);
                        return;
                    }
                }
                if (
                    rangeSel.range &&
                    !event.shiftKey &&
                    (ARROW_KEYS.has(event.key) || event.key === "Tab" || event.key === "Escape")
                ) {
                    rangeSel.setRange(undefined);
                }
                if (modifier && keyName === "d" && !event.shiftKey && fillHandle && fillDown()) {
                    event.preventDefault();
                    return;
                }
                if (event.altKey && event.key === "F1" && rangeChart) {
                    event.preventDefault();
                    openChart();
                    return;
                }
                if (modifier && keyName === "c" && !event.altKey && !event.shiftKey && copyRange()) {
                    event.preventDefault();
                    return;
                }
            }
            if (event.key === "F8" && validationEnabled) {
                event.preventDefault();
                goToIssue(event.shiftKey ? -1 : 1);
                return;
            }
            if (event.key === "?" && showKeyboardHelp && !modifier) {
                event.preventDefault();
                setHelpOpen(true);
                return;
            }
            if (event.key === "/" && showQuickFilter && !modifier) {
                const search = rootRef.current?.querySelector<HTMLInputElement>(".mxt-ag-toolbar__search");
                if (search) {
                    event.preventDefault();
                    search.focus();
                }
                return;
            }
            if (detailEnabled && event.altKey && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
                const focused = api?.getFocusedCell();
                const row =
                    focused && !focused.rowPinned ? api?.getDisplayedRowAtIndex(focused.rowIndex)?.data : undefined;
                if (row && row.item && !row.detail) {
                    event.preventDefault();
                    if ((event.key === "ArrowDown") !== isExpanded(row.id)) {
                        toggleDetail(row.id);
                    }
                }
                return;
            }
            if (modifier && keyName === "c" && !event.altKey) {
                if (copyFocused(event.shiftKey)) {
                    event.preventDefault();
                }
                return;
            }
            if (!undoRedo || !modifier || api?.getEditingCells().length) {
                return;
            }
            const isUndo = keyName === "z" && !event.shiftKey;
            const isRedo = keyName === "y" || (keyName === "z" && event.shiftKey);
            if (isUndo) {
                const records = undoStack.current.pop();
                if (records) {
                    event.preventDefault();
                    if (applyEdit(records, true)) {
                        redoStack.current.push(records);
                    }
                }
            } else if (isRedo) {
                const records = redoStack.current.pop();
                if (records) {
                    event.preventDefault();
                    if (applyEdit(records, false)) {
                        undoStack.current.push(records);
                    }
                }
            }
        },
        [
            undoRedo,
            applyEdit,
            validationEnabled,
            goToIssue,
            showKeyboardHelp,
            setHelpOpen,
            showQuickFilter,
            detailEnabled,
            isExpanded,
            toggleDetail,
            copyFocused,
            rangeEnabled,
            pivotActive,
            isRangeColumn,
            rangeSel,
            rtl,
            fillHandle,
            fillDown,
            rangeChart,
            openChart,
            copyRange
        ]
    );

    // AG Grid only moves rows itself ("managed" drag) without pagination; with pagination the drop
    // position is applied here, so dragging keeps working on paged grids.
    const managedRowDrag = rowDrag && !pagination;
    const handleRowDragEnd = useCallback(
        (event: RowDragEndEvent<GridRow>) => {
            const ordered: ObjectItem[] = [];
            event.api.forEachNodeAfterFilterAndSort(node => {
                if (node.data?.item && !node.data.detail) {
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
                        commit: commitOnEdit && !holdCommits,
                        onWritten: name => commitAfterWrite(item, name, previous?.toNumber(), position + 1)
                    });
                }
            });
            setDragOrder(order);
            if (canRun(onRowDragEnd)) {
                onRowDragEnd?.execute();
            }
        },
        [managedRowDrag, rowDragAttribute, onRowDragEnd, commitOnEdit, holdCommits, commitAfterWrite]
    );

    const getRowClass = useCallback(
        (params: RowClassParams<GridRow>): string | string[] | undefined => {
            if (params.data?.totals) {
                return "mxt-ag-row-totals";
            }
            if (params.data?.detail) {
                return "mxt-ag-row-detail";
            }
            if (params.data?.group) {
                return `mxt-ag-row-group mxt-ag-row-group--level-${params.data.group.level}`;
            }
            if (params.data?.loadMore) {
                return "mxt-ag-row-loadmore";
            }
            const item = params.data?.item;
            const custom = item && rowClass ? rowClass.get(item).value : undefined;
            const tree = params.data?.tree;
            if (tree) {
                const classes = ["mxt-ag-row-tree"];
                if (tree.hasChildren) {
                    classes.push("mxt-ag-row-tree-parent");
                }
                if (tree.filler) {
                    classes.push("mxt-ag-row-tree-filler");
                }
                if (tree.context) {
                    classes.push("mxt-ag-row-tree-context");
                }
                if (custom) {
                    classes.push(custom);
                }
                return classes;
            }
            return custom;
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
                    if (SYSTEM_COLUMN_IDS.has(id)) {
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
            if (!serverMode && arrangedTreeRef.current) {
                // Tree: every included row in tree order, also below closed rows.
                return Promise.resolve(arrangedTreeRef.current.sequence.map(entry => entry.row));
            }
            if (serverMode && serverGroupActiveRef.current) {
                const base = serverRequestBase();
                return dsQueue.request({
                    filter: base.filter,
                    sortOrder: base.sortOrder,
                    offset: 0,
                    limit: EXPORT_ROW_LIMIT,
                    build: loaded => buildRows(loaded, columnsRef.current)
                });
            }
            if (!serverMode && arrangedRef.current) {
                // Grouped: every group header and row in grouped order, also inside collapsed groups.
                return Promise.resolve(arrangedRef.current.sequence.map(entry => entry.row));
            }
            if (!serverMode) {
                const collected: GridRow[] = [];
                api.forEachNodeAfterFilterAndSort(node => {
                    if (node.data && !node.data.totals && !node.data.detail) {
                        collected.push(node.data);
                    }
                });
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
        [serverMode, processQueue, serverRequestBase, dsQueue]
    );

    const treeHeader = labelTreeColumn?.value ?? "Hierarchy";
    const handleExportCsv = useCallback(() => {
        const api = apiRef.current;
        if (!api) {
            return;
        }
        const fileName = `${exportFileName.trim() || "export"}.csv`;
        const columnKeys = exportColumnIds(api);
        if (!serverMode && !groupingActive && !treeEnabled) {
            api.exportDataAsCsv({
                fileName,
                columnKeys,
                shouldRowBeSkipped: params => Boolean(params.node.data?.detail)
            });
            return;
        }
        setExporting(true);
        collectExportRows(api)
            .then(all => {
                const tree = treeEnabled;
                const header = columnKeys.map(id => api.getColumn(id)?.getColDef().headerName ?? id);
                const escape = (text: string): string => `"${text.replace(/"/g, '""')}"`;
                const lines = [(tree ? [treeHeader, ...header] : header).map(escape).join(",")];
                all.filter(row => !row.group).forEach(row => {
                    const cells = columnKeys.map(id => escape(row.cells[id]?.display ?? ""));
                    lines.push((tree ? [escape(row.tree?.label ?? ""), ...cells] : cells).join(","));
                });
                downloadFile(
                    new TextEncoder().encode(CSV_BOM + lines.join("\r\n")),
                    fileName,
                    "text/csv;charset=utf-8"
                );
            })
            .catch(error => console.error("AGGrid: CSV export failed", error))
            .finally(() => setExporting(false));
    }, [exportFileName, exportColumnIds, serverMode, groupingActive, treeEnabled, treeHeader, collectExportRows]);

    // ---- Pivot table ------------------------------------------------------------------------
    const pivotInfo = useMemo(
        () => ({
            caption: captionOf,
            fnLabel: (fn: AggregateFn) => aggregateLabel(texts, fn),
            format: (colId: string, fn: AggregateFn, value: number): string => {
                if (fn === "count" || fn === "distinctCount") {
                    return new Intl.NumberFormat(intlLocale()).format(value);
                }
                const match = /^col(\d+)$/.exec(colId);
                const column = match ? columns[Number(match[1])] : undefined;
                if (!column) {
                    return String(value);
                }
                const kind = cellKind(column);
                if (kind === "date") {
                    return formatValue(column.attribute, "date", new Date(value));
                }
                return formatValue(column.attribute, "number", roundAggregate(value, fn, column.decimalPrecision), {
                    precision: column.decimalPrecision,
                    groupDigits: column.groupDigits
                });
            }
        }),
        [captionOf, texts, columns]
    );
    const pivotTotalLabel = labelPivotTotal?.value ?? "Total";
    const pivotResult = useMemo(
        () =>
            pivotActive
                ? computePivot(pivotSource, pivot, pivotInfo, {
                      totals: pivotTotals !== false,
                      totalLabel: pivotTotalLabel,
                      emptyLabel: EMPTY_GROUP_LABEL
                  })
                : undefined,
        [pivotActive, pivotSource, pivot, pivotInfo, pivotTotals, pivotTotalLabel]
    );
    useEffect(() => {
        if (pivotActive && apiRef.current) {
            refreshPivotSource(apiRef.current);
        }
    }, [pivotActive, refreshPivotSource]);
    const togglePivot = useCallback(() => {
        const next = !pivotRef.current.active;
        setPivot(previous => ({ ...previous, active: next }));
        const current = pivotRef.current;
        if (next && showSidePanel && current.rows.length + current.columns.length + current.values.length === 0) {
            // Nothing to pivot yet: show where the layout is made.
            setPanel({ open: true, tab: "columns" });
        }
        announce(next ? texts.pivotMode : texts.columns);
    }, [showSidePanel, announce, texts]);

    // ---- Excel export: data, pivot and selection sheets ------------------------------------------------
    const excelColumnFor = useCallback(
        (api: GridApi<GridRow>, id: string): ExcelColumn => {
            const column = findColumn(id);
            const kind = column ? cellKind(column) : "text";
            const type: ExcelColumnType = kind === "number" || kind === "date" || kind === "boolean" ? kind : "text";
            const gridColumn = api.getColumn(id);
            const conditional = column?.conditionalFormat;
            return {
                name: gridColumn?.getColDef().headerName ?? id,
                type,
                precision: column?.decimalPrecision,
                groupDigits: column?.groupDigits,
                width: gridColumn ? gridColumn.getActualWidth() / 7 : undefined,
                conditional: kind === "number" && conditional && conditional !== "none" ? conditional : undefined,
                conditionalColor: column?.formatColor?.trim() || accentColor.trim() || undefined,
                conditionalReverse: column?.formatReverse
            };
        },
        [findColumn, accentColor]
    );
    const excelValue = useCallback((cell: CellData | undefined, type: ExcelColumnType): ExcelCell => {
        if (!cell) {
            return "";
        }
        const value = cell.value;
        switch (type) {
            case "number":
                return typeof value === "number" ? value : "";
            case "date":
                return value instanceof Date ? value : "";
            case "boolean":
                return typeof value === "boolean" ? value : "";
            default:
                return cell.display;
        }
    }, []);

    const handleExportExcel = useCallback(() => {
        const api = apiRef.current;
        if (!api) {
            return;
        }
        const baseName = exportFileName.trim() || "export";
        const columnKeys = exportColumnIds(api);
        const excelColumns: ExcelColumn[] = columnKeys.map(id => excelColumnFor(api, id));
        const styled = exportStyled !== false;
        const moreSheets = exportSheets !== "data";
        const range = moreSheets && rangeEnabled && rangeCount > 1 ? rangeSel.normalized() : undefined;
        setExporting(true);
        collectExportRows(api)
            .then(all => {
                const groupLevels = groupByRef.current.length;
                const tree = treeEnabled ? arrangedTreeRef.current?.sequence : undefined;
                let columnsOut = excelColumns;
                let rows: ExcelCell[][];
                let rowOptions: ExcelRowOptions[] | undefined;
                if (tree) {
                    columnsOut = [{ name: treeHeader, type: "text", width: 32 }, ...excelColumns];
                    rows = tree.map(({ row, level }) => [
                        `${"   ".repeat(level)}${row.tree?.label ?? ""}`,
                        ...columnKeys.map((id, index) =>
                            excelValue(
                                row.aggCells?.[id]?.display ? row.aggCells[id] : row.cells[id],
                                excelColumns[index].type
                            )
                        )
                    ]);
                    rowOptions = tree.map(({ row, level }) => ({
                        outlineLevel: level,
                        bold: Boolean(row.tree?.hasChildren)
                    }));
                } else {
                    rows = all.map(row =>
                        columnKeys.map((id, index) =>
                            row.group && index === 0
                                ? `${row.group.caption}: ${row.group.label} (${row.group.count})`
                                : excelValue(row.cells[id], excelColumns[index].type)
                        )
                    );
                    rowOptions =
                        groupLevels > 0
                            ? all.map(row =>
                                  row.group
                                      ? { outlineLevel: row.group.level, bold: true }
                                      : { outlineLevel: groupLevels }
                              )
                            : undefined;
                }
                // Totals rows as SUBTOTAL formulas (they follow filters in Excel too); not for grouped or tree data.
                const totalsSource = [...totalsRows.top, ...totalsRows.bottom];
                const totals =
                    styled && !tree && groupLevels === 0 && totalsSource.length > 0
                        ? totalsSource.map(row => ({
                              cells: columnKeys.map(id => {
                                  const cell = row.cells[id];
                                  const fn = cell?.aggregate as ExcelTotalFn | undefined;
                                  return {
                                      fn,
                                      value: typeof cell?.value === "number" && fn ? cell.value : cell?.display ?? ""
                                  };
                              })
                          }))
                        : undefined;
                let freezeColumns = tree ? 1 : 0;
                for (const id of columnKeys) {
                    if (api.getColumn(id)?.getPinned() !== "left") {
                        break;
                    }
                    freezeColumns++;
                }
                const sheets: ExcelSheet[] = [
                    { name: baseName, columns: columnsOut, rows, rowOptions, totals, freezeColumns }
                ];
                if (moreSheets && pivotActive && pivotResult) {
                    const levels = pivot.columns.length;
                    const keyRows = pivotHeaderRows(pivotResult, levels, pivotTotalLabel).slice(0, levels);
                    // Repeated column labels are written once, like merged headers.
                    const headerRows = keyRows.map((cells, level) => [
                        "",
                        ...cells.map((cell, index) =>
                            index > 0 && keyRows.slice(0, level + 1).every(row => row[index] === row[index - 1])
                                ? ""
                                : cell
                        )
                    ]);
                    const pivotRows = [
                        ...pivotResult.rows,
                        ...(pivotResult.grandTotal ? [pivotResult.grandTotal] : [])
                    ];
                    sheets.push({
                        name: texts.sheetPivot,
                        columns: [
                            { name: pivot.rows.map(captionOf).join(" > ") || pivotTotalLabel, type: "text", width: 32 },
                            ...pivotResult.columns.map(column => ({
                                name: column.header,
                                type: "number" as ExcelColumnType,
                                width: Math.max(12, column.header.length + 2)
                            }))
                        ],
                        headerRows,
                        rows: pivotRows.map(row => [
                            `${"   ".repeat(row.group?.level ?? 0)}${row.group?.label ?? ""}`,
                            ...pivotResult.columns.map(column => {
                                const value = row.cells[column.id]?.value;
                                return typeof value === "number" ? value : "";
                            })
                        ]),
                        rowOptions: pivotRows.map(row => ({
                            outlineLevel: row.totals ? 0 : row.group?.level ?? 0,
                            bold: Boolean(row.totals) || (row.group?.level ?? 0) < pivot.rows.length - 1
                        })),
                        freezeColumns: 1,
                        autoFilter: false
                    });
                }
                if (range) {
                    const rangeRows: ExcelCell[][] = [];
                    const rangeColumns = range.colIds.map(id => excelColumnFor(api, id));
                    for (let rowIndex = range.top; rowIndex <= range.bottom; rowIndex++) {
                        if (cellAt(rowIndex, range.colIds[0]) !== undefined) {
                            rangeRows.push(
                                range.colIds.map((id, index) =>
                                    excelValue(cellAt(rowIndex, id), rangeColumns[index].type)
                                )
                            );
                        }
                    }
                    sheets.push({ name: texts.sheetSelection, columns: rangeColumns, rows: rangeRows });
                }
                if (sheets.length > 1) {
                    sheets[0].name = texts.sheetData;
                }
                downloadFile(
                    buildWorkbook(sheets, { styled, headerFill: "#EEF1F8" }),
                    `${baseName}.xlsx`,
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                );
            })
            .catch(error => console.error("AGGrid: Excel export failed", error))
            .finally(() => setExporting(false));
    }, [
        exportFileName,
        exportColumnIds,
        excelColumnFor,
        excelValue,
        collectExportRows,
        exportStyled,
        exportSheets,
        rangeEnabled,
        rangeCount,
        rangeSel,
        treeEnabled,
        treeHeader,
        totalsRows,
        pivotActive,
        pivotResult,
        pivot,
        pivotTotalLabel,
        texts,
        captionOf,
        cellAt
    ]);

    // Grouping, density, pivot, side panel and totals functions are part of the remembered layout and views.
    const layoutExtrasKey = JSON.stringify([
        groupBy,
        density ?? "",
        pivotAllowed ? pivot : null,
        showSidePanel ? panel : null,
        totalsOverrides
    ]);
    const layoutExtrasSeen = useRef(layoutExtrasKey);
    useEffect(() => {
        const api = apiRef.current;
        if (!api || layoutExtrasSeen.current === layoutExtrasKey) {
            return;
        }
        layoutExtrasSeen.current = layoutExtrasKey;
        persistState(api);
        scheduleViewCheck();
    }, [layoutExtrasKey, persistState, scheduleViewCheck]);

    const cycleDensity = useCallback(() => {
        const next = nextDensity(densityRef.current);
        setDensity(next);
        announce(`Row density: ${next}`);
    }, [announce]);

    const handleReset = useCallback(() => {
        const api = apiRef.current;
        if (!api) {
            return;
        }
        api.setFilterModel(null);
        api.resetColumnState();
        handleQuickFilterChange("");
        stateStore?.write("");
        setGroupState({ touched: false, groupBy: NO_GROUPING });
        setDensity(undefined);
        setPivot(initialPivotFrom(columnsRef.current, Boolean(pivotStartActive) && pivotAllowed));
        setTotalsOverrides({});
        setTreeExpand({ depth: treeExpandDepth ?? 1, toggled: new Set<string>() });
        rangeSel.setRange(undefined);
        if (serverGroupActiveRef.current) {
            changeServerGroupBy(undefined);
        }
        if (autoSizeColumnIds.length > 0) {
            api.autoSizeColumns(autoSizeColumnIds);
        }
        refreshChooser(api);
        markViewActive(undefined);
    }, [
        handleQuickFilterChange,
        stateStore,
        autoSizeColumnIds,
        refreshChooser,
        markViewActive,
        pivotStartActive,
        pivotAllowed,
        treeExpandDepth,
        rangeSel,
        changeServerGroupBy
    ]);

    const handleRefresh = useCallback(() => {
        if (serverGroupActiveRef.current) {
            loadServerGroups();
            return;
        }
        reloadPending.current = serverMode;
        datasourceRef.current.reload();
    }, [serverMode, loadServerGroups]);

    // ---- Filters state for the empty state ----------------------------------------------------
    const [columnFiltersActive, setColumnFiltersActive] = useState(false);
    const handleFilterChanged = useCallback(
        (event: FilterChangedEvent<GridRow>) => {
            refreshTotals(event.api);
            persistState(event.api);
            setColumnFiltersActive(event.api.isColumnFilterPresent());
            setFilterModelState(event.api.getFilterModel() as FilterModel);
            rangeSel.setRange(undefined);
            if (serverGroupActiveRef.current) {
                scheduleServerGroups(300);
            }
            if (event.source !== "api") {
                scheduleViewCheck();
            }
        },
        [refreshTotals, persistState, scheduleViewCheck, rangeSel, scheduleServerGroups]
    );
    const handleSortChanged = useCallback(
        (event: { api: GridApi<GridRow>; source: string }) => {
            handleColumnStateEvent(event);
            rangeSel.setRange(undefined);
            if (serverGroupActiveRef.current && event.source !== "api") {
                scheduleServerGroups(0);
            }
        },
        [handleColumnStateEvent, rangeSel, scheduleServerGroups]
    );

    // ---- Side panel content ----------------------------------------------------------------------
    const panelColumns = useMemo<PanelColumn[]>(
        () =>
            chooserColumns.map(entry => {
                const match = /^col(\d+)$/.exec(entry.id);
                const column = match ? columns[Number(match[1])] : undefined;
                const kind = column ? cellKind(column) : "object";
                return {
                    id: entry.id,
                    name: entry.name,
                    visible: entry.visible,
                    groupable: Boolean(column && canGroupBy(column)),
                    pivotable: Boolean(column && column.columnType !== "customContent" && column.pivotable !== false),
                    numeric: kind === "number"
                };
            }),
        [chooserColumns, columns]
    );
    const panelFilters = useMemo<PanelFilter[]>(
        () =>
            columns
                .map((column, index) => ({ column, id: `col${index}` }))
                .filter(
                    ({ column }) =>
                        column.columnType !== "customContent" &&
                        column.filterType !== "none" &&
                        column.visible?.value !== false &&
                        (!serverMode || (column.columnType === "attribute" && Boolean(column.attribute?.filterable)))
                )
                .map(({ column, id }) => {
                    const kind = cellKind(column);
                    const model = filterModelState[id] as Record<string, unknown> | undefined;
                    const name = column.header?.value || id;
                    const setKind = kind === "enum" || kind === "boolean";
                    if (column.filterType === "set" && (!serverMode || setKind)) {
                        const attribute = column.attribute;
                        const params: SetFilterParams = {
                            colId: id,
                            fixed:
                                kind === "enum" && attribute
                                    ? Object.values(enumCaptions(attribute))
                                    : kind === "boolean" && attribute
                                    ? [
                                          formatValue(attribute, "boolean", true),
                                          formatValue(attribute, "boolean", false)
                                      ]
                                    : undefined,
                            fixedOnly: serverMode,
                            texts: getTexts
                        };
                        return {
                            id,
                            name,
                            active: Boolean(model),
                            set: {
                                // Read when the filter is opened, never while rendering.
                                list: () => columnValues(apiRef.current ?? undefined, params),
                                model: isSetFilterModel(model) ? (model as SetFilterModel) : null
                            }
                        };
                    }
                    const natural: ConditionKind = kind === "number" ? "number" : kind === "date" ? "date" : "text";
                    const conditionKind: ConditionKind =
                        column.filterType === "number" || column.filterType === "date" || column.filterType === "text"
                            ? column.filterType
                            : natural;
                    const filterValue =
                        model?.filter ?? (typeof model?.dateFrom === "string" ? model.dateFrom.slice(0, 10) : "");
                    return {
                        id,
                        name,
                        active: Boolean(model),
                        condition: {
                            kind: conditionKind,
                            type:
                                typeof model?.type === "string"
                                    ? model.type
                                    : conditionKind === "text"
                                    ? "contains"
                                    : "equals",
                            value: filterValue === undefined || filterValue === null ? "" : String(filterValue)
                        }
                    };
                }),
        [columns, filterModelState, serverMode, getTexts]
    );
    const setPanelFilterModel = useCallback((colId: string, model: unknown) => {
        const api = apiRef.current;
        if (!api) {
            return;
        }
        Promise.resolve(api.setColumnFilterModel(colId, model as never)).then(() => api.onFilterChanged());
    }, []);
    const handlePanelCondition = useCallback(
        (colId: string, kind: ConditionKind, type: string, value: string) => {
            const valueless = type === "blank" || type === "notBlank";
            let model: unknown = null;
            if (valueless) {
                model = { filterType: kind, type };
            } else if (value.trim() !== "") {
                if (kind === "number") {
                    const numeric = Number(value);
                    model = Number.isFinite(numeric) ? { filterType: "number", type, filter: numeric } : null;
                } else if (kind === "date") {
                    model = { filterType: "date", type, dateFrom: `${value} 00:00:00`, dateTo: null };
                } else {
                    model = { filterType: "text", type, filter: value };
                }
            }
            setPanelFilterModel(colId, model);
        },
        [setPanelFilterModel]
    );
    const movePanelColumn = useCallback(
        (id: string, beforeId: string | undefined) => {
            const api = apiRef.current;
            if (!api) {
                return;
            }
            const all = api.getAllGridColumns().map(column => column.getColId());
            const from = all.indexOf(id);
            let to = beforeId ? all.indexOf(beforeId) : all.length - 1;
            if (from < 0 || to < 0) {
                return;
            }
            if (beforeId && from < to) {
                to -= 1;
            }
            api.moveColumns([id], to);
            refreshChooser(api);
            announce(`${captionOf(id)}: ${to + 1}`);
        },
        [refreshChooser, announce, captionOf]
    );
    const panelId = `${useId()}-panel`;
    const togglePanel = useCallback(() => setPanel(previous => ({ ...previous, open: !previous.open })), []);

    // ---- Failed saves: discard rolls the cells back to their old values --------------------------------
    const discardCommits = useCallback(() => {
        const api = apiRef.current;
        const failed = commitTracker.discardAll();
        failed.reverse().forEach(entry => {
            const node = api?.getRowNode(entry.rowId);
            const value = typeof entry.oldValue === "boolean" ? String(entry.oldValue) : entry.oldValue;
            node?.setDataValue(entry.colId, value, ROLLBACK_SOURCE);
        });
        announce(`${failed.length} changes discarded`);
    }, [commitTracker, announce]);
    const clearFilters = useCallback(() => {
        apiRef.current?.setFilterModel(null);
        handleQuickFilterChange("");
        announce("Filters cleared");
    }, [handleQuickFilterChange, announce]);

    // ---- Lively overlays: skeleton rows while loading, friendly empty state ---------------------
    const noRows = noRowsText?.value ?? "No rows to show";
    const overlayParams = useMemo<LivelyOverlayParams>(
        () => ({
            skeletonColumns: Math.max(1, Math.min(6, columns.length)),
            noRowsText: noRows,
            clearFiltersLabel: labelClearFilters?.value ?? "Clear filters",
            filtersActive: columnFiltersActive || quickFilter.trim() !== "",
            onClearFilters: clearFilters
        }),
        [columns.length, noRows, labelClearFilters?.value, columnFiltersActive, quickFilter, clearFilters]
    );
    const overlaySelector = useCallback((params: IOverlayParams<GridRow>): OverlaySelectorResult | undefined => {
        if (params.overlayType === "loading") {
            return { component: SkeletonOverlay };
        }
        if (params.overlayType === "noRows" || params.overlayType === "noMatchingRows") {
            return { component: EmptyStateOverlay };
        }
        return undefined;
    }, []);

    // Set filters are also applied as an external filter: AG Grid only asks a custom filter component once it
    // was created (opened), while the floating filter sets the model before that.
    const setFilterColIds = useMemo(
        () =>
            serverMode
                ? []
                : columns
                      .map((column, index) => ({ column, id: `col${index}` }))
                      .filter(entry => entry.column.filterType === "set" && entry.column.columnType !== "customContent")
                      .map(entry => entry.id),
        [columns, serverMode]
    );
    const activeSetModels = useRef<Array<[string, SetFilterModel]>>([]);
    const isExternalFilterPresent = useCallback(() => {
        const api = apiRef.current;
        const active: Array<[string, SetFilterModel]> = [];
        setFilterColIds.forEach(id => {
            const model = api?.getColumnFilterModel(id);
            if (isSetFilterModel(model)) {
                active.push([id, model]);
            }
        });
        activeSetModels.current = active;
        return active.length > 0;
    }, [setFilterColIds]);
    const doesExternalFilterPass = useCallback((node: IRowNode<GridRow>) => {
        const row = node.data;
        if (!isDataRow(row)) {
            return true;
        }
        return activeSetModels.current.every(([id, model]) => setFilterPasses(model, row.cells[id]?.display ?? ""));
    }, []);

    const alwaysPassGroupRows = useCallback((node: IRowNode<GridRow>) => Boolean(node.data?.group), []);
    const formatStatusNumber = useCallback((value: number) => new Intl.NumberFormat(intlLocale()).format(value), []);

    // ---- Render -----------------------------------------------------------------------------
    const pageSizes = useMemo(
        () => parsePageSizes(pageSizeSelector, effectivePageSize),
        [pageSizeSelector, effectivePageSize]
    );
    const domLayout = layout === "fixedHeight" ? "normal" : layout;
    const infiniteModel = serverMode && !serverGroupActive;
    const sizedStyle = layout === "fixedHeight" ? { ...style, height: height.trim() || "500px" } : style;
    // The widget's own accents (progress bar, detail rows, menus) follow the configured accent color.
    const wrapperStyle = accentColor.trim()
        ? ({ ...sizedStyle, "--mxt-ag-accent": accentColor.trim() } as CSSProperties)
        : sizedStyle;
    const atlas = themeName === "atlas";
    const atlasPager = pagination && atlas;
    const anyPinnedLeft =
        columns.some(column => column.pinned === "left") ||
        showRowNumbers ||
        detailEnabled ||
        groupingActive ||
        treeEnabled ||
        serverGroupActive;
    const serverGroupableColumns = useMemo<GroupableColumn[]>(
        () =>
            columns
                .map((column, index) => ({ column, id: `col${index}` }))
                .filter(entry => canServerGroup(entry.column) && entry.column.visible?.value !== false)
                .map(entry => ({ id: entry.id, name: entry.column.header?.value ?? entry.id })),
        [columns]
    );
    const alwaysPass = useCallback(() => true, []);
    const handleBodyScroll = useCallback(() => {
        if (highlightSearchOn && quickFilterRef.current) {
            scheduleHighlight();
        }
        rangePaintRef.current();
    }, [highlightSearchOn, scheduleHighlight]);
    const fullWidthParams = useMemo<FullWidthParams>(
        () => ({ ...detailRowParams, ...loadMoreParams }),
        [detailRowParams, loadMoreParams]
    );
    const panelOpen = Boolean(showSidePanel) && panel.open;
    const totalsMenuMatch = totalsMenu ? /^col(\d+)$/.exec(totalsMenu.colId) : null;
    const totalsMenuColumn = totalsMenuMatch ? columns[Number(totalsMenuMatch[1])] : undefined;
    const totalsMenuKind = totalsMenuColumn ? cellKind(totalsMenuColumn) : "text";
    const selectionColumnDef = useMemo<ColDef<GridRow>>(
        () => (anyPinnedLeft ? { pinned: "left", lockPosition: "left" } : { lockPosition: "left" }),
        [anyPinnedLeft]
    );
    const isEmpty = serverMode ? serverEmpty : datasource.status === "available" && rows.length === 0;
    const showPlaceholder = Boolean(emptyPlaceholder) && isEmpty;
    const selectedCount = selection?.type === "Multi" ? selectedIds.size : selectedIds.size;
    // Loading: skeleton rows the first time (Lively effects), a slim progress bar while existing rows refresh.
    const clientLoading = !serverMode && datasource.status === "loading";
    const firstLoad = serverMode ? !serverLoaded : clientLoading && rows.length === 0;
    const gridLoading = animate ? firstLoad : clientLoading;
    const refreshing = animate && datasource.status === "loading" && !firstLoad;
    const issueCount = issues.length;

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
            ref={rootRef}
            className={classNames(
                "mxt-ag-grid",
                `mxt-ag-grid--${domLayout}`,
                {
                    "mxt-ag-grid--atlas": atlas,
                    "mxt-ag-grid--dark": colorScheme === "dark",
                    "mxt-ag-grid--animate": lively,
                    "mxt-ag-grid--subtle": motionLevel === "subtle",
                    "mxt-ag-grid--detail": detailEnabled,
                    "mxt-ag-grid--grouped": groupingActive || serverGroupActive,
                    "mxt-ag-grid--tree": treeEnabled,
                    "mxt-ag-grid--pivot": pivotActive,
                    "mxt-ag-grid--range": rangeEnabled,
                    "mxt-ag-grid--panel-open": panelOpen,
                    "mxt-ag-grid--rtl": rtl,
                    [`mxt-ag-grid--density-${density}`]: Boolean(density)
                },
                className
            )}
            style={wrapperStyle}
            tabIndex={tabIndex}
            aria-busy={datasource.status === "loading" || undefined}
            onKeyDown={handleKeyDown}
            onPaste={clipboardPaste ? handlePaste : undefined}
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
                animate={lively}
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
                leading={
                    validationEnabled && (issueCount > 0 || heldCount > 0) ? (
                        <IssuesBadge
                            text={issuesText(labelIssues?.value ?? "Issues: [count]", issueCount)}
                            count={issueCount}
                            held={heldCount}
                            onNext={() => goToIssue(1)}
                        />
                    ) : undefined
                }
                after={
                    showKeyboardHelp ? (
                        <KeyboardHelp
                            label={labelKeyboardHelp?.value ?? "Keyboard shortcuts"}
                            shortcuts={shortcuts}
                            open={helpOpen}
                            onOpenChange={setHelpOpen}
                        />
                    ) : undefined
                }
            >
                {showViews && (
                    <ViewsMenu
                        label={labelViews?.value ?? "Views"}
                        saveLabel={labelSaveView?.value ?? "Save current view as..."}
                        views={viewsDoc.views}
                        activeId={activeView?.id}
                        dirty={viewDirty}
                        readOnly={viewsReadOnly || !viewsReady}
                        outdatedIds={outdatedViewIds}
                        nameProblem={viewNameCheck}
                        onApply={handleApplyView}
                        onSaveAs={handleSaveViewAs}
                        onUpdate={handleUpdateView}
                        onRename={handleRenameView}
                        onDelete={handleDeleteView}
                        onToggleDefault={handleToggleDefaultView}
                    />
                )}
                {groupingAllowed && !pivotActive && (
                    <GroupByMenu
                        label={labelGroupBy?.value ?? "Group by"}
                        columns={groupableColumns}
                        groupBy={groupBy}
                        onToggle={id => changeGroupBy(toggleGroupBy(groupBy, id))}
                        onMove={(id, delta) => changeGroupBy(moveGroupBy(groupBy, id, delta))}
                        onExpandAll={() => setAllGroups(true)}
                        onCollapseAll={() => setAllGroups(false)}
                        onClear={() => changeGroupBy([])}
                    />
                )}
                {serverGroupingAllowed && (
                    <GroupByMenu
                        label={labelGroupBy?.value ?? "Group by"}
                        columns={serverGroupableColumns}
                        groupBy={serverGroupBy && serverGroupActive ? [serverGroupBy] : NO_GROUPING}
                        onToggle={id => changeServerGroupBy(serverGroupBy === id ? undefined : id)}
                        onMove={() => undefined}
                        onExpandAll={() =>
                            serverGroupsRef.current
                                .filter(group => !group.open && (group.count ?? 0) > 0)
                                .forEach(group => toggleServerGroup(group.path))
                        }
                        onCollapseAll={() =>
                            setServerGroups(current => current.map(group => ({ ...group, open: false })))
                        }
                        onClear={() => changeServerGroupBy(undefined)}
                    />
                )}
                {showSidePanel && (
                    <button
                        type="button"
                        className={classNames("btn btn-default mxt-ag-btn mxt-ag-panel-toggle", {
                            "mxt-ag-btn--active": panelOpen
                        })}
                        aria-expanded={panelOpen}
                        aria-controls={panelOpen ? panelId : undefined}
                        onClick={togglePanel}
                    >
                        <PanelIcon />
                        <span>{labelSidePanel?.value ?? "Panel"}</span>
                    </button>
                )}
                {pivotAllowed && (
                    <button
                        type="button"
                        className={classNames("btn btn-default mxt-ag-btn mxt-ag-pivot-toggle", {
                            "mxt-ag-btn--active": pivotActive
                        })}
                        aria-pressed={pivotActive}
                        onClick={togglePivot}
                    >
                        <PivotIcon />
                        <span>{labelPivot?.value ?? "Pivot"}</span>
                    </button>
                )}
                {rangeEnabled && rangeChart && !pivotActive && (
                    <button
                        type="button"
                        className="btn btn-default mxt-ag-btn mxt-ag-chart-toggle"
                        disabled={rangeCount < 2}
                        title={`${labelChartRange?.value ?? "Chart range"} (Alt+F1)`}
                        onClick={openChart}
                    >
                        <ChartIcon />
                        <span>{labelChartRange?.value ?? "Chart range"}</span>
                    </button>
                )}
                {treeEnabled && (
                    <span className="mxt-ag-tree-buttons">
                        <button
                            type="button"
                            className="btn btn-default mxt-ag-btn mxt-ag-btn--icon mxt-ag-tree-expand"
                            aria-label={texts.expandAll}
                            title={texts.expandAll}
                            onClick={() => setAllTree(true)}
                        >
                            <ExpandIcon />
                        </button>
                        <button
                            type="button"
                            className="btn btn-default mxt-ag-btn mxt-ag-btn--icon mxt-ag-tree-collapse"
                            aria-label={texts.collapseAll}
                            title={texts.collapseAll}
                            onClick={() => setAllTree(false)}
                        >
                            <CollapseIcon />
                        </button>
                    </span>
                )}
                {showDensityToggle && (
                    <button
                        type="button"
                        className="btn btn-default mxt-ag-btn mxt-ag-btn--icon mxt-ag-density"
                        aria-label={`${labelDensity?.value ?? "Row density"}: ${density ?? "normal"}`}
                        title={`${labelDensity?.value ?? "Row density"}: ${density ?? "normal"}`}
                        data-density={density ?? "normal"}
                        onClick={cycleDensity}
                    >
                        <DensityIcon />
                    </button>
                )}
                {showColumnChooser && chooserColumns.length > 0 && (
                    <ColumnChooser
                        label={labelColumns?.value ?? "Columns"}
                        columns={chooserColumns}
                        onToggle={toggleColumn}
                    />
                )}
            </Toolbar>
            <CommitBanner
                snapshot={commitSnapshot}
                failedTemplate={labelSaveFailed?.value ?? "[count] change(s) could not be saved."}
                retryLabel={labelRetry?.value ?? "Retry"}
                discardLabel={labelDiscard?.value ?? "Discard"}
                savingLabel={texts.saving}
                onRetry={() => commitTracker.retryAll()}
                onDiscard={discardCommits}
            />
            {showPlaceholder && <div className="mxt-ag-grid__empty">{emptyPlaceholder}</div>}
            <div className="mxt-ag-grid__main">
                <div className="mxt-ag-grid__grid" hidden={showPlaceholder || pivotActive}>
                    {refreshing && !showPlaceholder && (
                        <div className="mxt-ag-progress" role="progressbar" aria-label="Refreshing">
                            <span className="mxt-ag-progress__bar" />
                        </div>
                    )}
                    <AgGridReact<GridRow>
                        // A remount is needed for another row model (lazy server groups) or text direction.
                        key={`${rtl ? "rtl" : "ltr"}-${serverGroupActive ? "groups" : "rows"}`}
                        theme={theme}
                        localeText={localeText}
                        columnDefs={columnDefs}
                        defaultColDef={defaultColDef}
                        rowModelType={infiniteModel ? "infinite" : "clientSide"}
                        rowData={serverGroupActive ? serverGroupRows : serverMode ? undefined : displayRows}
                        datasource={infiniteModel ? serverDatasource : undefined}
                        cacheBlockSize={infiniteModel ? effectivePageSize : undefined}
                        maxBlocksInCache={infiniteModel && !pagination ? 10 : undefined}
                        infiniteInitialRowCount={infiniteModel ? 1 : undefined}
                        getRowId={params => params.data.id}
                        rowSelection={rowSelection}
                        selectionColumnDef={selectionColumnDef}
                        domLayout={domLayout}
                        enableRtl={rtl}
                        rowHeight={rowHeight > 0 ? densityRowHeight(rowHeight, density) : undefined}
                        getRowHeight={detailEnabled ? getRowHeight : undefined}
                        headerHeight={headerHeight > 0 ? headerHeight : undefined}
                        floatingFiltersHeight={themeName === "atlas" ? 52 : undefined}
                        animateRows={animateRows && fullMotion}
                        suppressRowHoverHighlight={!rowHoverHighlight}
                        columnHoverHighlight={columnHoverHighlight}
                        enableCellTextSelection={cellTextSelection}
                        ensureDomOrder={cellTextSelection}
                        // Lazy server groups page with their own Load more rows; client pages would split a group.
                        pagination={pagination && !serverGroupActive}
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
                        isFullWidthRow={detailEnabled || serverGroupActive ? isFullWidthRow : undefined}
                        fullWidthCellRenderer={detailEnabled || serverGroupActive ? FullWidthRow : undefined}
                        fullWidthCellRendererParams={detailEnabled || serverGroupActive ? fullWidthParams : undefined}
                        postSortRows={
                            detailEnabled || groupingActive || treeEnabled || serverGroupActive
                                ? handlePostSortRows
                                : undefined
                        }
                        alwaysPassFilter={
                            serverGroupActive ? alwaysPass : groupingActive ? alwaysPassGroupRows : undefined
                        }
                        isExternalFilterPresent={setFilterColIds.length > 0 ? isExternalFilterPresent : undefined}
                        doesExternalFilterPass={setFilterColIds.length > 0 ? doesExternalFilterPass : undefined}
                        onBodyScroll={handleBodyScroll}
                        onViewportChanged={rangeEnabled ? rangeSchedulePaint : undefined}
                        pinnedTopRowData={totalsRow === "top" || totalsRow === "both" ? totalsRows.top : undefined}
                        pinnedBottomRowData={
                            totalsRow === "bottom" || totalsRow === "both" ? totalsRows.bottom : undefined
                        }
                        loading={gridLoading}
                        overlayComponentSelector={animate ? overlaySelector : undefined}
                        overlayComponentParams={animate ? overlayParams : undefined}
                        overlayNoRowsTemplate={
                            animate ? undefined : `<span class="mxt-ag-norows">${escapeHtml(noRows)}</span>`
                        }
                        tooltipShowDelay={300}
                        onGridReady={handleGridReady}
                        onFirstDataRendered={handleFirstDataRendered}
                        onCellClicked={handleCellClicked}
                        onCellFocused={handleCellFocused}
                        onCellKeyDown={totalsChangeable ? handleCellKeyDown : undefined}
                        onRowDoubleClicked={handleRowDoubleClicked}
                        onSelectionChanged={handleSelectionChanged}
                        onCellValueChanged={handleCellValueChanged}
                        onRowDragEnd={handleRowDragEnd}
                        onModelUpdated={handleModelUpdated}
                        onFilterChanged={handleFilterChanged}
                        onColumnMoved={handleColumnMoved}
                        onColumnResized={handleColumnStateEvent}
                        onColumnPinned={handleColumnStateEvent}
                        onColumnVisible={handleColumnVisible}
                        onSortChanged={handleSortChanged}
                    />
                </div>
                {pivotActive && pivotResult && !showPlaceholder && (
                    <PivotGrid
                        result={pivotResult}
                        theme={theme}
                        localeText={localeText}
                        groupHeader={pivot.rows.map(captionOf).join(" > ") || pivotTotalLabel}
                        totalLabel={pivotTotalLabel}
                        domLayout={domLayout}
                        rowHeight={rowHeight > 0 ? densityRowHeight(rowHeight, density) : undefined}
                        headerHeight={headerHeight > 0 ? headerHeight : undefined}
                        rtl={rtl}
                        formatCount={formatCount}
                        notice={
                            pivotResult.truncated
                                ? texts.tooManyPivotColumns.replace("[count]", String(pivotResult.columns.length))
                                : undefined
                        }
                        onAnnounce={announce}
                    />
                )}
                {panelOpen && (
                    <div className="mxt-ag-grid__panel" id={panelId}>
                        <SidePanel
                            title={labelSidePanel?.value ?? "Panel"}
                            texts={texts}
                            operatorLabel={operatorLabel}
                            tab={panel.tab}
                            onTab={tab => setPanel(previous => ({ ...previous, tab }))}
                            onClose={() => setPanel(previous => ({ ...previous, open: false }))}
                            columns={panelColumns}
                            onToggleVisible={toggleColumn}
                            onMove={movePanelColumn}
                            groupingEnabled={groupingAllowed}
                            groupBy={groupBy}
                            maxGroupLevels={MAX_GROUP_LEVELS}
                            onGroupBy={next => changeGroupBy(next)}
                            pivotEnabled={pivotAllowed}
                            pivot={pivot}
                            onPivot={setPivot}
                            filters={panelFilters}
                            onSetFilter={setPanelFilterModel}
                            onCondition={handlePanelCondition}
                            onClearFilter={id => setPanelFilterModel(id, null)}
                        />
                    </div>
                )}
            </div>
            {atlasPager && !showPlaceholder && !pivotActive && !serverGroupActive && (
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
            {showStatusBar && status && !showPlaceholder && (
                <StatusBar
                    summary={status}
                    rowsTemplate={labelStatusRows?.value ?? "[shown] of [total] rows"}
                    selectedTemplate={labelSelected?.value ?? "[count] selected"}
                    animate={fullMotion}
                    formatNumber={formatStatusNumber}
                    range={rangeSummary}
                />
            )}
            {!showStatusBar && rangeSummary && !showPlaceholder && (
                <div className="mxt-ag-status mxt-ag-status--range" role="status" aria-live="polite">
                    <span className="mxt-ag-status__range">
                        {rangeSummary.map(entry => (
                            <span key={entry.label} className="mxt-ag-status__agg">
                                <span className="mxt-ag-status__kind">{entry.label}</span>
                                <strong className="mxt-ag-status__value">{entry.value}</strong>
                            </span>
                        ))}
                    </span>
                </div>
            )}
            {chartData && (
                <RangeChart
                    title={labelChartRange?.value ?? "Chart range"}
                    data={chartData}
                    texts={texts}
                    dark={colorScheme === "dark"}
                    animate={fullMotion}
                    formatNumber={formatStatusNumber}
                    onClose={() => setChartData(undefined)}
                />
            )}
            {totalsMenu && totalsMenuColumn && (
                <TotalsMenu
                    columnName={captionOf(totalsMenu.colId)}
                    current={totalsFunctionFor(
                        totalsMenuColumn,
                        totalsMenu.colId,
                        totalsOverrides[totalsMenu.rowId],
                        totalsMenu.rowId === TOTALS_TOP_ROW_ID ? "top" : "bottom"
                    )}
                    choices={
                        totalsMenuKind === "number" || totalsMenuKind === "date"
                            ? ALL_TOTAL_CHOICES
                            : (["none", "count", "distinctCount"] as AggregateChoice[])
                    }
                    anchor={totalsMenu.anchor}
                    texts={texts}
                    dark={colorScheme === "dark"}
                    rtl={rtl}
                    onChoose={chooseTotal}
                    onClose={() => setTotalsMenu(undefined)}
                />
            )}
            <span id={issueDescriptionId} className="mxt-ag-sr-only">
                {focusedIssue}
            </span>
            <div className="mxt-ag-sr-only" role="status" aria-live="polite">
                {announcement}
            </div>
        </div>
    );
}
