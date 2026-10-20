// Browser harness: renders the real AGGrid container with mocked Mendix props.
//   node harness/build.mjs && node harness/test.mjs && node harness/test13.mjs
// Query parameters pick the configuration (see baseProps): group, motion, server, paste, status, density, store,
// and for 1.3: tree, pivot, range, panel, set, totals, tchange, sgroup, commit, crash, rtl, rows, sheets.
import { Big } from "big.js";
import { unzipSync, strFromU8 } from "fflate";
import { createRoot, Root } from "react-dom/client";
import { AGGrid } from "../src/AGGrid";

type AnyProps = Record<string, any>;
const params = new URLSearchParams(location.search);
const events: Array<{ name: string; args?: unknown }> = [];
if (params.get("rtl") === "1") {
    document.documentElement.dir = "rtl";
}

const DEPARTMENTS = ["Sales", "IT", "Finance", "Support"];
const CITIES = ["Oslo", "Paris", "Rome"];
const FIRST = ["Ann", "Bob", "Cid", "Dee", "Eve", "Fay", "Gus", "Hal", "Ivy", "Jon"];
const LEVELS = ["junior", "senior", "lead"];
const LEVEL_CAPTIONS: Record<string, string> = { junior: "Junior", senior: "Senior", lead: "Lead" };

interface Employee {
    [key: string]: unknown;
}
const ROW_COUNT = Number(params.get("rows") ?? 30);
const store = new Map<string, Employee>();
for (let index = 0; index < ROW_COUNT; index++) {
    const id = `e${index + 1}`;
    const department = DEPARTMENTS[index % DEPARTMENTS.length];
    const city = CITIES[index % CITIES.length];
    const name = `${FIRST[index % FIRST.length]} ${index + 1}`;
    store.set(id, {
        name,
        department,
        city,
        salary: new Big(1000 + index * 100),
        rating: new Big((index * 7) % 10),
        active: index % 3 !== 0,
        hired: new Date(2020, index % 12, 1 + (index % 27)),
        trend: [index % 5, (index * 3) % 7, (index * 2) % 9, index % 4, (index * 5) % 11].join(","),
        level: index % 10 === 9 ? undefined : LEVELS[index % LEVELS.length],
        // Tree data: e1 is the root, every row reports to the row with a 5 times smaller number.
        code: id,
        parent: index === 0 ? "" : `e${Math.floor(index / 5) + 1}`,
        path: `${department}/${city}/${name}`
    });
}
let items = Array.from(store.keys()).map(id => ({ id } as any));

function format(value: unknown): string {
    if (value === undefined || value === null) {
        return "";
    }
    if (value instanceof Big) {
        return value.toString();
    }
    if (typeof value === "boolean") {
        return value ? "Yes" : "No";
    }
    if (value instanceof Date) {
        return value.toISOString().slice(0, 10);
    }
    if (typeof value === "string" && LEVEL_CAPTIONS[value]) {
        return LEVEL_CAPTIONS[value];
    }
    return String(value);
}

function attribute(key: string, type: string, editable = false, universe?: string[]): any {
    return {
        id: `attr_${key}`,
        type,
        sortable: true,
        filterable: true,
        isList: false,
        universe,
        get: (target: { id: string }) => ({
            status: "available",
            value: store.get(target.id)?.[key],
            displayValue: format(store.get(target.id)?.[key]),
            readOnly: !editable,
            validation: undefined,
            setValue: (value: unknown) => {
                (store.get(target.id) as Employee)[key] = value;
                events.push({ name: "setValue", args: { id: target.id, key, value: format(value) } });
                // Like Mendix: the data source pushes new items after a change.
                items = items.map(entry => (entry.id === target.id ? ({ id: target.id } as any) : entry));
                schedule();
            }
        }),
        formatter: { format }
    };
}

const dv = <T,>(value: T): any => ({ status: "available", value });
const expression = (fn: (id: string) => unknown): any => ({ get: (target: { id: string }) => dv(fn(target.id)) });

function action(name: string): any {
    return {
        canExecute: true,
        isExecuting: false,
        execute: (args?: any) => events.push({ name, args: serialize(args) })
    };
}
function listAction(name: string): any {
    return { get: (target: { id: string }) => action(`${name}:${target.id}`) };
}
function serialize(args: any): any {
    if (!args) {
        return args;
    }
    const out: Record<string, unknown> = {};
    Object.entries(args).forEach(([key, value]) => (out[key] = value instanceof Big ? value.toNumber() : value));
    return out;
}

let selected: any[] = [];
const selection = {
    type: "Multi",
    get selection() {
        return selected;
    },
    setSelection: (next: any[]) => {
        selected = next;
        events.push({ name: "setSelection", args: next.map(entry => entry.id) });
        schedule();
    }
};

function column(overrides: AnyProps): AnyProps {
    return {
        columnType: "attribute",
        attribute: undefined,
        dynamicText: undefined,
        content: undefined,
        header: dv(""),
        headerGroup: "",
        tooltip: undefined,
        renderAs: "text",
        attributeName: "",
        totalAttribute: undefined,
        widthMode: "flex",
        flex: 1,
        width: 150,
        minWidth: 0,
        maxWidth: 0,
        sortable: true,
        filterType: "auto",
        editable: undefined,
        pinned: "none",
        visible: dv(true),
        resizable: true,
        movable: true,
        aggregate: "none",
        aggregateTop: "same",
        alignment: "auto",
        decimalPrecision: -1,
        groupDigits: false,
        wrapText: false,
        autoHeight: false,
        cellClass: undefined,
        onClick: undefined,
        onChange: undefined,
        validation: undefined,
        groupIndex: 0,
        groupable: true,
        conditionalFormat: "none",
        formatColor: "",
        formatReverse: false,
        pivotRole: "none",
        pivotAggregate: "sum",
        pivotable: true,
        ...overrides
    };
}

const editable = expression(() => true);
const group = params.get("group") ?? "";
const pivotStart = params.get("pivotStart") === "1";

// ---- Mendix client API stand-in (mx.data) for commits; can fail on purpose ------------------------------
let failCommits = params.get("commit") === "fail" ? 1 : 0;
(window as any).mx = {
    data: {
        get: (options: any) => options.callback((options.guids ?? [options.guid]).map((guid: string) => ({ guid }))),
        commit: (options: any) => {
            window.setTimeout(() => {
                if (failCommits > 0) {
                    failCommits--;
                    events.push({ name: "commitFailed" });
                    options.error(new Error("Network error (harness)"));
                } else {
                    events.push({ name: "commit" });
                    options.callback();
                }
            }, 30);
        }
    }
};

// ---- A data source that really pages, sorts and filters (server data loading) -----------------------------
function evaluate(node: any, item: Employee): any {
    if (!node) {
        return true;
    }
    if (node.type === "attribute") {
        return item[String(node.attributeId).replace(/^attr_/, "")];
    }
    if (node.type === "literal") {
        return node.value;
    }
    const plain = (value: unknown): unknown =>
        value instanceof Big ? value.toNumber() : value instanceof Date ? value.getTime() : value;
    const isEmpty = (value: unknown): boolean => value === undefined || value === null || value === "";
    switch (node.name) {
        case "and":
            return node.args.every((arg: any) => evaluate(arg, item));
        case "or":
            return node.args.some((arg: any) => evaluate(arg, item));
        case "not":
            return !evaluate(node.arg, item);
        case "=": {
            const a = plain(evaluate(node.arg1, item));
            const b = plain(evaluate(node.arg2, item));
            return isEmpty(b) ? isEmpty(a) : String(a) === String(b);
        }
        case "!=": {
            const a = plain(evaluate(node.arg1, item));
            const b = plain(evaluate(node.arg2, item));
            return isEmpty(b) ? !isEmpty(a) : String(a) !== String(b);
        }
        case "contains":
            return String(evaluate(node.arg1, item) ?? "")
                .toLowerCase()
                .includes(String(evaluate(node.arg2, item) ?? "").toLowerCase());
        default:
            return true;
    }
}
const serverDs: AnyProps = {
    status: "loading",
    items: undefined,
    offset: 0,
    limit: 20,
    totalCount: undefined,
    hasMoreItems: false,
    sortOrder: [],
    filter: undefined,
    requests: 0
};
const pendingServer: AnyProps = { offset: 0, limit: 20, sortOrder: [], filter: undefined };
let serverTimer: number | undefined;
function applyServer(): void {
    window.clearTimeout(serverTimer);
    serverDs.status = "loading";
    serverTimer = window.setTimeout(() => {
        let list = Array.from(store.entries()).filter(([, item]) => evaluate(pendingServer.filter, item));
        (pendingServer.sortOrder as Array<[string, string]>).forEach(([attrId, direction]) => {
            const key = attrId.replace(/^attr_/, "");
            list = list.sort(([, a], [, b]) => {
                const x = format(a[key]);
                const y = format(b[key]);
                return (direction === "desc" ? -1 : 1) * x.localeCompare(y, undefined, { numeric: true });
            });
        });
        Object.assign(serverDs, {
            status: "available",
            offset: pendingServer.offset,
            limit: pendingServer.limit,
            sortOrder: pendingServer.sortOrder,
            filter: pendingServer.filter,
            totalCount: list.length,
            items: list.slice(pendingServer.offset, pendingServer.offset + pendingServer.limit).map(([id]) => ({ id })),
            requests: serverDs.requests + 1
        });
        schedule();
    }, 15);
    schedule();
}
function serverDatasource(): AnyProps {
    return {
        ...serverDs,
        setOffset: (value: number) => {
            pendingServer.offset = value;
            applyServer();
        },
        setLimit: (value: number) => {
            pendingServer.limit = value;
            applyServer();
        },
        setSortOrder: (value: unknown[]) => {
            pendingServer.sortOrder = value ?? [];
            applyServer();
        },
        setFilter: (value: unknown) => {
            pendingServer.filter = value;
            applyServer();
        },
        requestTotalCount: () => undefined,
        reload: () => applyServer()
    };
}

// The Crash column throws while window.harnessCrash is true (the test clears it before pressing Retry).
(window as any).harnessCrash = params.get("crash") === "1";
const crashes = (window as any).harnessCrash ? 1 : 0;

function baseProps(): AnyProps {
    const server = params.get("server") === "1";
    const setFilter = params.get("set") === "1";
    const pivotRole = (role: string): string => (pivotStart ? role : "none");
    return {
        name: "harnessGrid",
        class: "",
        style: undefined,
        tabIndex: 0,
        datasource: server
            ? serverDatasource()
            : {
                  status: "available",
                  items,
                  offset: 0,
                  limit: 1000,
                  totalCount: items.length,
                  hasMoreItems: false,
                  sortOrder: [],
                  filter: undefined,
                  setLimit: () => undefined,
                  setOffset: () => undefined,
                  setSortOrder: () => undefined,
                  setFilter: () => undefined,
                  requestTotalCount: () => undefined,
                  reload: () => undefined
              },
        dataMode: server ? "server" : "client",
        rowLimit: 0,
        refreshInterval: 0,
        columns: [
            column({
                attribute: attribute("name", "String", true),
                header: dv("Name"),
                editable,
                aggregate: params.get("totals") ? "count" : "none"
            }),
            column({
                attribute: attribute("department", "String"),
                header: dv("Department"),
                groupIndex: group.includes("dept") ? 1 : 0,
                filterType: setFilter ? "set" : "auto",
                pivotRole: pivotRole("row")
            }),
            column({
                attribute: attribute("city", "String"),
                header: dv("City"),
                groupIndex: group.includes("city") ? 2 : 0,
                pivotRole: pivotRole("column")
            }),
            column({
                attribute: attribute("salary", "Decimal", true),
                header: dv("Salary"),
                editable,
                aggregate: "sum",
                aggregateTop: params.get("totals") === "both" ? "avg" : "same",
                conditionalFormat: "dataBar",
                formatColor: "#0ea58f",
                pivotRole: pivotRole("value")
            }),
            column({
                attribute: attribute("rating", "Integer", true),
                header: dv("Rating"),
                editable,
                aggregate: "avg",
                conditionalFormat: "iconSet",
                pivotAggregate: "avg"
            }),
            column({ attribute: attribute("active", "Boolean", true), header: dv("Active"), editable }),
            column({ attribute: attribute("hired", "DateTime"), header: dv("Hired") }),
            column({
                attribute: attribute("trend", "String"),
                header: dv("Trend"),
                renderAs: "sparkline",
                sortable: false
            }),
            column({
                attribute: attribute("level", "Enum", false, LEVELS),
                header: dv("Level"),
                filterType: setFilter ? "set" : "auto"
            }),
            ...(crashes > 0
                ? [
                      column({
                          columnType: "dynamicText",
                          attribute: undefined,
                          header: dv("Crash"),
                          dynamicText: {
                              get: () => {
                                  if ((window as any).harnessCrash) {
                                      throw new Error("Harness crash on purpose");
                                  }
                                  return dv("ok");
                              }
                          }
                      })
                  ]
                : [])
        ],
        selection,
        checkboxSelection: true,
        headerCheckbox: true,
        clickSelection: false,
        showQuickFilter: true,
        quickFilterPlaceholder: dv("Search..."),
        showExportButton: true,
        exportFormat: "both",
        exportFileName: "people",
        exportSheets: params.get("sheets") ?? "auto",
        exportStyled: params.get("styled") !== "0",
        showResetButton: true,
        showRefreshButton: false,
        showColumnChooser: true,
        showSelectionCount: true,
        showKeyboardHelp: true,
        showDensityToggle: params.get("density") !== "0",
        alwaysMultiSort: false,
        floatingFilters: params.get("ff") === "1",
        pagination: params.get("paged") === "1",
        pageSize: Number(params.get("pageSize") ?? 50),
        pageSizeSelector: "",
        autoPageSize: false,
        editType: "cell",
        singleClickEdit: false,
        commitMode: params.get("commit") ? "client" : "none",
        undoRedo: true,
        enterNavigatesVertically: true,
        flashOnChange: true,
        clipboardPaste: params.get("paste") !== "0",
        blockInvalidCommit: false,
        autoSizeStrategy: "none",
        stateStorage: params.get("store") === "1" ? "browser" : "none",
        showViews: true,
        viewsKey: "",
        enableGrouping: params.get("grouping") !== "0",
        serverGrouping: params.get("sgroup") === "1",
        groupsExpanded: params.get("collapsed") !== "1",
        hideGroupedColumns: params.get("hide") === "1",
        showStatusBar: params.get("status") !== "0",
        enablePivot: params.get("pivot") === "1",
        pivotStartActive: pivotStart,
        pivotTotals: true,
        treeMode: params.get("tree") === "path" ? "path" : params.get("tree") ? "parentKey" : "none",
        treeKey: expression(id => store.get(id)?.code),
        // ?lateParent=1: parent keys are still loading (undefined) until harness.releaseParents(), like an
        // expression over an association in Mendix
        treeParentKey: expression(id => (parentsLoading ? undefined : store.get(id)?.parent)),
        treePath: expression(id => store.get(id)?.path),
        treePathSeparator: "/",
        treeLabel: undefined,
        treeExpandDepth: Number(params.get("depth") ?? -1),
        treeAggregates: params.get("treeAgg") === "1",
        rangeSelection: params.get("range") === "1",
        fillHandle: true,
        rangeChart: true,
        showSidePanel: params.get("panel") === "1",
        sidePanelStartOpen: params.get("panelOpen") === "1",
        detailContent: undefined,
        detailExpandMode: "single",
        detailStartCollapsed: true,
        detailHeight: 0,
        rowDrag: false,
        theme: "atlas",
        colorScheme: params.get("dark") === "1" ? "dark" : "light",
        accentColor: "",
        fontSize: 0,
        spacing: 0,
        layout: params.get("auto") === "1" ? "autoHeight" : "fixedHeight",
        height: "620px",
        rowHeight: 0,
        headerHeight: 0,
        wrapHeaderText: false,
        showRowNumbers: false,
        animateRows: true,
        animate: true,
        motion: params.get("motion") ?? "full",
        highlightSearch: true,
        rowHoverHighlight: true,
        columnHoverHighlight: false,
        cellTextSelection: false,
        totalsRow: params.get("totals") ?? "none",
        totalsUserChange: params.get("tchange") === "1",
        totalsSource: "loaded",
        labelGroupBy: dv("Group by"),
        labelGroupColumn: dv("Group"),
        labelDensity: dv("Row density"),
        labelStatusRows: dv("[shown] of [total] rows"),
        labelSelected: dv("[count] selected"),
        labelSidePanel: dv("Panel"),
        labelPivot: dv("Pivot"),
        labelPivotTotal: dv("Total"),
        labelTreeColumn: dv("Hierarchy"),
        labelChartRange: dv("Chart range"),
        labelSaveFailed: dv("[count] change(s) could not be saved."),
        labelRetry: dv("Retry"),
        labelDiscard: dv("Discard"),
        labelError: dv("The grid ran into a problem and was stopped."),
        onGroupByChange: action("onGroupByChange"),
        onPaste: action("onPaste"),
        onFill: action("onFill"),
        onCellValueChange: listAction("onCellValueChange")
    };
}

let parentsLoading = params.get("lateParent") === "1";
const container = document.getElementById("root") as HTMLElement;
let root: Root | undefined = createRoot(container);
let pending = false;
function render(): void {
    root?.render(<AGGrid {...(baseProps() as any)} />);
}
function schedule(): void {
    if (!pending) {
        pending = true;
        queueMicrotask(() => {
            pending = false;
            render();
        });
    }
}

// Captures downloads (exports) so the test can inspect the files.
const downloads: Array<{ name: string; text: string; files?: Record<string, string> }> = [];
const originalCreate = URL.createObjectURL.bind(URL);
let lastBlob: Blob | undefined;
URL.createObjectURL = (blob: Blob) => {
    lastBlob = blob;
    return originalCreate(blob);
};
HTMLAnchorElement.prototype.click = function click(this: HTMLAnchorElement) {
    const name = this.download;
    const blob = lastBlob;
    if (!blob) {
        return;
    }
    blob.arrayBuffer().then(buffer => {
        const bytes = new Uint8Array(buffer);
        let text: string;
        let files: Record<string, string> | undefined;
        if (name.endsWith(".xlsx")) {
            const unzipped = unzipSync(bytes);
            files = {};
            Object.entries(unzipped).forEach(
                ([path, content]) => ((files as Record<string, string>)[path] = strFromU8(content))
            );
            text = files["xl/worksheets/sheet1.xml"];
        } else {
            text = new TextDecoder().decode(bytes);
        }
        downloads.push({ name, text, files });
    });
};

(window as any).harness = {
    releaseParents: () => {
        parentsLoading = false;
        render();
    },
    events,
    downloads,
    value: (id: string, key: string) => format(store.get(id)?.[key]),
    rerender: render,
    serverRequests: () => serverDs.requests,
    setFailCommits: (count: number) => (failCommits = count),
    unmount: () => {
        root?.unmount();
        root = undefined;
    },
    mount: () => {
        root = createRoot(container);
        render();
    }
};
render();
