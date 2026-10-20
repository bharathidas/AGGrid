/**
 * @jest-environment jsdom
 */
/* Renders the 1.3 features with the real AG Grid in jsdom: tree data, pivot, side panel, set filter, totals rows
   at the top and bottom and the error boundary. Catches runtime errors and AG Grid option warnings. */
import { act, configure, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Big } from "big.js";

import { AGGrid } from "../AGGrid";
import { fakeAttribute, fakeColumn, item } from "./helpers";

configure({ asyncUtilTimeout: 8000 });
jest.setTimeout(60000);

Object.defineProperty(window.navigator, "clipboard", {
    value: { writeText: jest.fn(() => Promise.resolve()) },
    configurable: true
});
(globalThis as any).ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
};
window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    onchange: null,
    dispatchEvent: () => false
})) as any;

const ids = ["a", "b", "c", "d"];
const names = fakeAttribute({ id: "name", type: "String", values: { a: "Ann", b: "Bob", c: "Cid", d: "Dee" } });
const depts = fakeAttribute({ id: "dept", type: "String", values: { a: "Sales", b: "IT", c: "Sales", d: "IT" } });
const salaries = fakeAttribute({
    id: "salary",
    type: "Decimal",
    values: { a: new Big(10), b: new Big(20), c: new Big(30), d: new Big(40) }
});
const parents: Record<string, string> = { a: "", b: "a", c: "a", d: "b" };
const expr = (fn: (id: string) => string): any => ({ get: (target: { id: string }) => ({ value: fn(target.id) }) });

function datasource(): any {
    return {
        status: "available",
        items: ids.map(item),
        offset: 0,
        limit: Number.POSITIVE_INFINITY,
        totalCount: ids.length,
        hasMoreItems: false,
        sortOrder: [],
        filter: undefined,
        setLimit: jest.fn(),
        setOffset: jest.fn(),
        setSortOrder: jest.fn(),
        setFilter: jest.fn(),
        requestTotalCount: jest.fn(),
        reload: jest.fn()
    };
}

function props(overrides: Record<string, unknown> = {}): any {
    return {
        name: "grid13",
        class: "",
        datasource: datasource(),
        dataMode: "client",
        rowLimit: 0,
        refreshInterval: 0,
        columns: [
            fakeColumn({ attribute: names, header: { value: "Name" } as any, aggregate: "count" } as any),
            fakeColumn({
                attribute: depts,
                header: { value: "Dept" } as any,
                pivotRole: "row",
                filterType: "set"
            } as any),
            fakeColumn({
                attribute: salaries,
                header: { value: "Salary" } as any,
                aggregate: "sum",
                aggregateTop: "max",
                pivotRole: "value",
                pivotAggregate: "sum"
            } as any)
        ],
        selection: undefined,
        checkboxSelection: false,
        headerCheckbox: false,
        clickSelection: false,
        showQuickFilter: true,
        showExportButton: true,
        exportFormat: "both",
        exportFileName: "export",
        exportSheets: "auto",
        exportStyled: true,
        showResetButton: true,
        showRefreshButton: false,
        showColumnChooser: true,
        showSelectionCount: false,
        showKeyboardHelp: true,
        alwaysMultiSort: false,
        floatingFilters: true,
        pagination: false,
        pageSize: 20,
        pageSizeSelector: "",
        autoPageSize: false,
        editType: "cell",
        singleClickEdit: false,
        commitMode: "none",
        undoRedo: true,
        enterNavigatesVertically: true,
        flashOnChange: true,
        blockInvalidCommit: false,
        autoSizeStrategy: "none",
        stateStorage: "none",
        showViews: false,
        viewsKey: "",
        detailContent: undefined,
        detailExpandMode: "single",
        detailStartCollapsed: true,
        detailHeight: 0,
        rowDrag: false,
        theme: "atlas",
        colorScheme: "light",
        accentColor: "",
        fontSize: 0,
        spacing: 0,
        layout: "autoHeight",
        height: "500px",
        rowHeight: 0,
        headerHeight: 0,
        wrapHeaderText: false,
        showRowNumbers: false,
        animateRows: true,
        animate: true,
        motion: "full",
        rowHoverHighlight: true,
        columnHoverHighlight: false,
        cellTextSelection: false,
        totalsRow: "none",
        totalsSource: "loaded",
        treeMode: "none",
        treeExpandDepth: -1,
        treePathSeparator: "/",
        enablePivot: false,
        pivotStartActive: false,
        pivotTotals: true,
        rangeSelection: false,
        fillHandle: true,
        rangeChart: true,
        showSidePanel: false,
        sidePanelStartOpen: false,
        serverGrouping: false,
        totalsUserChange: false,
        ...overrides
    };
}

describe("AGGrid 1.3 in the browser", () => {
    let errors: jest.SpyInstance;
    let warnings: jest.SpyInstance;
    beforeEach(() => {
        window.localStorage.clear();
        errors = jest.spyOn(console, "error").mockImplementation(() => undefined);
        warnings = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    });
    afterEach(() => {
        errors.mockRestore();
        warnings.mockRestore();
    });
    const agGridMessages = (): string[] =>
        [...errors.mock.calls, ...warnings.mock.calls]
            .map(call => call.map(String).join(" "))
            .filter(text => /AG Grid/i.test(text));

    it("shows tree data with the tree column and descendant counts", async () => {
        render(
            <AGGrid
                {...props({
                    treeMode: "parentKey",
                    treeKey: expr(id => id),
                    treeParentKey: expr(id => parents[id]),
                    treeLabel: expr(id => `Node ${id}`)
                })}
            />
        );
        await waitFor(() => expect(document.querySelectorAll(".mxt-ag-tree").length).toBe(4));
        expect(screen.getByText("Node a")).toBeTruthy();
        const counts = Array.from(document.querySelectorAll(".mxt-ag-tree .mxt-ag-group__count")).map(
            el => el.textContent
        );
        expect(counts).toContain("3");
        expect(screen.getByRole("button", { name: "Expand all" })).toBeTruthy();
        expect(agGridMessages()).toEqual([]);
    });

    it("starts in pivot mode with the configured layout and switches back", async () => {
        render(<AGGrid {...props({ enablePivot: true, pivotStartActive: true, showSidePanel: true })} />);
        await waitFor(() => expect(document.querySelector(".mxt-ag-pivot .mxt-ag-group")).toBeTruthy());
        await waitFor(() =>
            expect(document.querySelector(".mxt-ag-pivot .mxt-ag-group__label")?.textContent).toMatch(/IT|Sales/)
        );
        const pivotButton = screen.getByRole("button", { name: /Pivot/ });
        expect(pivotButton.getAttribute("aria-pressed")).toBe("true");
        act(() => {
            fireEvent.click(pivotButton);
        });
        await waitFor(() => expect(document.querySelector(".mxt-ag-pivot")).toBeNull());
        expect(agGridMessages()).toEqual([]);
    });

    it("opens the side panel with columns, drop zones and filters", async () => {
        render(<AGGrid {...props({ showSidePanel: true, sidePanelStartOpen: true, enableGrouping: true })} />);
        await screen.findByRole("tablist");
        expect(screen.getByRole("tab", { name: "Columns" }).getAttribute("aria-selected")).toBe("true");
        expect(screen.getByText("Row Groups")).toBeTruthy();
        fireEvent.click(screen.getByRole("tab", { name: "Filters" }));
        await waitFor(() => expect(document.querySelectorAll(".mxt-ag-panel__filter-toggle").length).toBe(3));
        expect(agGridMessages()).toEqual([]);
    });

    it("renders a set filter checklist from the floating filter", async () => {
        render(<AGGrid {...props()} />);
        const button = await waitFor(() => {
            const found = document.querySelector<HTMLButtonElement>(".mxt-ag-set-floating__button");
            expect(found).toBeTruthy();
            return found as HTMLButtonElement;
        });
        act(() => {
            fireEvent.click(button);
        });
        const dialog = await screen.findByRole("dialog");
        expect(dialog.textContent).toContain("IT");
        expect(dialog.textContent).toContain("Sales");
        expect(agGridMessages()).toEqual([]);
    });

    it("shows totals rows at the top and the bottom", async () => {
        render(<AGGrid {...props({ totalsRow: "both", totalsUserChange: true })} />);
        await waitFor(() => expect(document.querySelectorAll(".ag-row-pinned").length).toBeGreaterThanOrEqual(2));
        const texts = Array.from(document.querySelectorAll(".ag-row-pinned [col-id='col2']")).map(el => el.textContent);
        expect(texts).toEqual(expect.arrayContaining(["40", "100"]));
        expect(document.querySelector(".mxt-ag-totals-cell")).toBeTruthy();
        expect(agGridMessages()).toEqual([]);
    });

    it("catches a rendering error and offers Retry", async () => {
        let fail = true;
        const broken = fakeColumn({
            columnType: "dynamicText",
            header: { value: "Broken" } as any,
            dynamicText: {
                get: () => {
                    if (fail) {
                        throw new Error("boom");
                    }
                    return { value: "fine" };
                }
            } as any
        });
        render(<AGGrid {...props({ columns: [broken] })} />);
        const alert = await screen.findByRole("alert");
        expect(alert.textContent).toContain("The grid ran into a problem");
        fail = false;
        act(() => {
            fireEvent.click(screen.getByRole("button", { name: "Retry" }));
        });
        await waitFor(() => expect(screen.getAllByText("fine").length).toBeGreaterThan(0));
    });
});
