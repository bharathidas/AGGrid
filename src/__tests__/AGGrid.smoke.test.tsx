/**
 * @jest-environment jsdom
 */
/* Renders the real widget with AG Grid in jsdom: catches runtime errors, invalid grid options (the AG Grid
   validation module is active outside production builds) and checks the new features end to end. */
import { act, configure, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Big } from "big.js";

import { AGGrid } from "../AGGrid";
import { fakeAttribute, fakeColumn, item } from "./helpers";

// AG Grid renders asynchronously; leave room for slow machines and parallel test workers.
configure({ asyncUtilTimeout: 8000 });
jest.setTimeout(60000);

// jsdom lacks these browser APIs.
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

const ids = ["e1", "e2", "e3"];
const names = fakeAttribute({ id: "name", type: "String", values: { e1: "Ann", e2: "Bob", e3: "Cid" } });
const salaries = fakeAttribute({
    id: "salary",
    type: "Decimal",
    values: { e1: new Big(-5), e2: new Big(100), e3: new Big(200) }
});

function datasource(status: "available" | "loading", rows: string[]): any {
    return {
        status,
        items: status === "loading" ? undefined : rows.map(item),
        offset: 0,
        limit: Number.POSITIVE_INFINITY,
        totalCount: rows.length,
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
        name: "grid1",
        class: "",
        datasource: datasource("available", ids),
        dataMode: "client",
        rowLimit: 0,
        refreshInterval: 0,
        columns: [
            fakeColumn({ attribute: names, header: { value: "Name" } as any }),
            fakeColumn({
                attribute: salaries,
                header: { value: "Salary" } as any,
                validation: {
                    get: (target: { id: string }) => ({
                        value: target.id === "e1" ? "Salary cannot be negative" : ""
                    })
                }
            } as any)
        ],
        selection: undefined,
        checkboxSelection: true,
        headerCheckbox: true,
        clickSelection: true,
        showQuickFilter: true,
        showExportButton: false,
        exportFormat: "both",
        exportFileName: "export",
        showResetButton: true,
        showRefreshButton: false,
        showColumnChooser: true,
        showSelectionCount: true,
        showKeyboardHelp: true,
        alwaysMultiSort: false,
        floatingFilters: false,
        pagination: false,
        pageSize: 20,
        pageSizeSelector: "10,20",
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
        showViews: true,
        viewsKey: "",
        detailContent: { get: (target: { id: string }) => <span>Detail of {target.id}</span> },
        detailExpandMode: "single",
        detailStartCollapsed: true,
        detailHeight: 0,
        rowDrag: false,
        theme: "quartz",
        colorScheme: "light",
        accentColor: "",
        fontSize: 0,
        spacing: 0,
        layout: "autoHeight",
        height: "500px",
        rowHeight: 0,
        headerHeight: 0,
        wrapHeaderText: false,
        showRowNumbers: true,
        animateRows: true,
        animate: true,
        rowHoverHighlight: true,
        columnHoverHighlight: false,
        cellTextSelection: false,
        totalsRow: "none",
        totalsSource: "loaded",
        ...overrides
    };
}

describe("AGGrid in the browser", () => {
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

    function agGridMessages(): string[] {
        return [...errors.mock.calls, ...warnings.mock.calls]
            .map(call => call.map(String).join(" "))
            .filter(text => /AG Grid/i.test(text));
    }

    it("renders rows, the issues badge, detail rows and saved views without AG Grid warnings", async () => {
        render(<AGGrid {...props()} />);

        await screen.findByText("Ann");
        expect(screen.getByText("Cid")).toBeTruthy();

        // Validation: one invalid cell.
        const badge = await screen.findByRole("button", { name: /Issues: 1/ });
        expect(document.querySelectorAll(".mxt-ag-cell-invalid").length).toBeGreaterThan(0);
        fireEvent.click(badge);

        // Detail rows: the chevron expands a full-width row with the detail widgets.
        const chevrons = document.querySelectorAll<HTMLButtonElement>(".mxt-ag-detail-toggle");
        expect(chevrons.length).toBe(3);
        expect(chevrons[0].getAttribute("aria-expanded")).toBe("false");
        act(() => {
            chevrons[0].click();
        });
        await screen.findByText("Detail of e1");
        await waitFor(() =>
            expect(document.querySelector(".mxt-ag-detail-toggle")?.getAttribute("aria-expanded")).toBe("true")
        );
        // Row numbers skip the detail row.
        expect(document.querySelectorAll(".mxt-ag-rownum").length).toBeGreaterThan(0);

        // Saved views: save the current layout under a name.
        fireEvent.click(screen.getByRole("button", { name: /Views/ }));
        fireEvent.click(await screen.findByRole("menuitem", { name: /Save current view as/ }));
        fireEvent.change(screen.getByLabelText("View name"), { target: { value: "My view" } });
        fireEvent.click(screen.getByRole("button", { name: "Save" }));
        const stored = JSON.parse(window.localStorage.getItem("mxt-aggrid-views:grid1") ?? "{}");
        expect(stored.views.map((view: { name: string }) => view.name)).toEqual(["My view"]);
        expect(screen.getByRole("button", { name: /Views/ }).textContent).toContain("My view");

        // Keyboard help popover.
        fireEvent.click(screen.getByRole("button", { name: "Keyboard shortcuts" }));
        expect(await screen.findByRole("dialog", { name: "Keyboard shortcuts" })).toBeTruthy();

        expect(agGridMessages()).toEqual([]);
    });

    it("opens the default view on load", async () => {
        window.localStorage.setItem(
            "mxt-aggrid-views:grid1",
            JSON.stringify({
                version: 1,
                views: [{ id: "v1", name: "Bobs", isDefault: true, state: { quickFilter: "Bob" } }]
            })
        );
        render(<AGGrid {...props()} />);
        await waitFor(() => expect((screen.getByRole("searchbox") as HTMLInputElement).value).toBe("Bob"));
        expect(screen.getByRole("button", { name: /Views/ }).textContent).toContain("Bobs");
        expect(agGridMessages()).toEqual([]);
    });

    it("shows skeleton rows while loading and the friendly empty state without rows", async () => {
        const { rerender } = render(<AGGrid {...props({ datasource: datasource("loading", []) })} />);
        await waitFor(() => expect(document.querySelector(".mxt-ag-skeleton")).toBeTruthy());
        rerender(<AGGrid {...props({ datasource: datasource("available", []) })} />);
        await waitFor(() => expect(document.querySelector(".mxt-ag-empty-state")).toBeTruthy());
        expect(screen.getByText("No rows to show")).toBeTruthy();
        expect(agGridMessages()).toEqual([]);
    });

    it("loads pages from the data source in server mode", async () => {
        // A data source that applies paging settings immediately, like one that already holds the page.
        const ds = datasource("available", ids);
        ds.setOffset = jest.fn((offset: number) => (ds.offset = offset));
        ds.setLimit = jest.fn((limit: number) => (ds.limit = limit));
        ds.setSortOrder = jest.fn((order: unknown[]) => (ds.sortOrder = order));
        ds.setFilter = jest.fn((filter: unknown) => (ds.filter = filter));
        render(<AGGrid {...props({ dataMode: "server", datasource: ds, detailContent: undefined })} />);
        await screen.findByText("Bob");
        expect(ds.setLimit).toHaveBeenCalledWith(20);
        await waitFor(() => expect(document.querySelector(".mxt-ag-skeleton")).toBeNull());
        expect(await screen.findByRole("button", { name: /Issues: 1/ })).toBeTruthy();
        expect(agGridMessages()).toEqual([]);
    });

    it("keeps the classic overlays when lively effects are off", async () => {
        render(<AGGrid {...props({ animate: false, datasource: datasource("available", []), showViews: false })} />);
        await waitFor(() => expect(document.querySelector(".mxt-ag-norows")).toBeTruthy());
        expect(document.querySelector(".mxt-ag-empty-state")).toBeNull();
        expect(agGridMessages()).toEqual([]);
    });

    it("groups rows, shows the status bar and pastes without AG Grid warnings", async () => {
        const grouped = props({
            enableGrouping: true,
            groupsExpanded: true,
            showStatusBar: true,
            clipboardPaste: true,
            showViews: false,
            detailContent: undefined,
            columns: [
                fakeColumn({ attribute: names, header: { value: "Name" } as any, groupIndex: 1 }),
                fakeColumn({
                    attribute: salaries,
                    header: { value: "Salary" } as any,
                    aggregate: "sum",
                    conditionalFormat: "dataBar"
                })
            ]
        });
        render(<AGGrid {...grouped} />);
        await waitFor(() => expect(document.querySelectorAll(".mxt-ag-group").length).toBe(3));
        expect(screen.getByRole("button", { name: /Group by/ })).toBeTruthy();
        await waitFor(() => expect(document.querySelector(".mxt-ag-status")?.textContent).toContain("3 of 3 rows"));
        expect(agGridMessages()).toEqual([]);
    });
});
