import { Big } from "big.js";
import { strFromU8, unzipSync } from "fflate";

import { ColumnsType } from "../../typings/AGGridProps";
import { GridRow, buildRows } from "../utils/rows";
import { aggregateValues, computeTotalsFromRows, totalsFunctionFor } from "../utils/totals";
import { computePivot, flattenPivot, pivotHeaderRows, sanitizePivot } from "../utils/pivot";
import { arrangeTree, buildTree, isTreeOpen, splitPath, toggleTreeKey } from "../utils/tree";
import {
    extendRange,
    fillValues,
    normalizeRange,
    planFill,
    planFillDown,
    rangeContains,
    rangeStats,
    rangeToTsv
} from "../utils/range";
import {
    distinctValues,
    matchingValues,
    selectionToModel,
    setFilterPasses,
    setFilterSummary,
    toggleAllMatching,
    toggleSetValue
} from "../utils/setFilter";
import { chartDataFromRange, niceScale, pieSlices } from "../utils/chart";
import { argb, buildWorkbook, buildXlsx } from "../utils/xlsx";
import { CommitTracker, failedText } from "../utils/commitTracker";
import { DatasourceQueue } from "../utils/datasourceQueue";
import { canServerGroup, initialServerGroups, serverGroupDisplay, serverGroupValues } from "../utils/serverGroups";
import { buildFilter } from "../utils/serverFilters";
import { fakeAttribute, fakeColumn, item } from "./helpers";

const ids = ["a", "b", "c", "d", "e", "f"];
const dept = fakeAttribute({
    id: "dept",
    type: "String",
    values: { a: "Sales", b: "IT", c: "Sales", d: "IT", e: "Sales", f: "" }
});
const city = fakeAttribute({
    id: "city",
    type: "String",
    values: { a: "Oslo", b: "Oslo", c: "Rome", d: "Rome", e: "Oslo", f: "Rome" }
});
const salary = fakeAttribute({
    id: "salary",
    type: "Decimal",
    values: { a: new Big(10), b: new Big(20), c: new Big(30), d: new Big(40), e: new Big(50), f: new Big(60) }
});
const columns: ColumnsType[] = [
    fakeColumn({ attribute: dept, header: { value: "Dept" } as any, aggregate: "count" }),
    fakeColumn({ attribute: city, header: { value: "City" } as any }),
    fakeColumn({ attribute: salary, header: { value: "Salary" } as any, aggregate: "sum" })
];
const rows: GridRow[] = buildRows(ids.map(item), columns);
const info = {
    caption: (colId: string) => ({ col0: "Dept", col1: "City", col2: "Salary" }[colId] ?? colId),
    format: (_colId: string, _fn: string, value: number) => String(value),
    fnLabel: (fn: string) => fn
};

describe("aggregations", () => {
    it("computes every function, distinct count included", () => {
        const values = [1, 2, 2, undefined, "", 5];
        expect(aggregateValues(values, "sum")).toBe(10);
        expect(aggregateValues(values, "avg")).toBe(2.5);
        expect(aggregateValues(values, "min")).toBe(1);
        expect(aggregateValues(values, "max")).toBe(5);
        expect(aggregateValues(values, "count")).toBe(4);
        expect(aggregateValues(values, "distinctCount")).toBe(3);
        expect(aggregateValues(["x"], "sum")).toBeUndefined();
    });

    it("lets the user override a totals function and uses the top value for the top row", () => {
        const top = fakeColumn({ attribute: salary, aggregate: "sum", aggregateTop: "max" } as any);
        expect(totalsFunctionFor(top, "col0", undefined, "top")).toBe("max");
        expect(totalsFunctionFor(top, "col0", { col0: "avg" }, "top")).toBe("avg");
        expect(totalsFunctionFor(top, "col0", undefined, "bottom")).toBe("sum");
        const totals = computeTotalsFromRows(rows, columns, "Total", { col2: "distinctCount" });
        expect(totals.cells.col2.display).toBe("6");
        expect(totals.cells.col0.display).toBe("5");
    });
});

describe("pivot", () => {
    it("pivots row groups x column labels with sums, subtotals and totals", () => {
        const result = computePivot(
            rows,
            { rows: ["col0"], columns: ["col1"], values: [{ colId: "col2", fn: "sum" }] },
            info,
            { totals: true, totalLabel: "Total", emptyLabel: "(empty)" }
        );
        expect(result.columns.map(c => c.keys.join("/") || "T")).toEqual(["Oslo", "Rome", "T"]);
        const labels = result.rows.map(r => r.group?.label);
        expect(labels).toEqual(["(empty)", "IT", "Sales"]);
        const sales = result.rows.find(r => r.group?.label === "Sales") as GridRow;
        expect(sales.cells.p0_0.value).toBe(60); // Oslo: a + e
        expect(sales.cells.p1_0.value).toBe(30); // Rome: c
        expect(sales.cells.pt_0.value).toBe(90);
        expect(result.grandTotal?.cells.pt_0.value).toBe(210);
        expect(result.grandTotal?.cells.p0_0.value).toBe(80);
        expect(result.columns[2].header).toBe("Total sum(Salary)");
    });

    it("nests row groups, counts without values and hides collapsed children", () => {
        const result = computePivot(rows, { rows: ["col1", "col0"], columns: [], values: [] }, info, {
            totals: true,
            totalLabel: "Total",
            emptyLabel: "-"
        });
        expect(result.rows.map(r => `${r.group?.level}:${r.group?.label}=${r.cells.pt_0.value}`)).toEqual([
            "0:Oslo=3",
            "1:IT=1",
            "1:Sales=2",
            "0:Rome=3",
            "1:-=1",
            "1:IT=1",
            "1:Sales=1"
        ]);
        const collapsed = flattenPivot(result.rows, { mode: "expanded", exceptions: new Set(['["Oslo"]']) });
        expect(collapsed.map(r => r.group?.label)).toEqual(["Oslo", "Rome", "-", "IT", "Sales"]);
        const sorted = flattenPivot(
            result.rows,
            { mode: "expanded", exceptions: new Set() },
            { colId: "pt_0", direction: "desc" }
        );
        expect(sorted[0].group?.label).toBe("Oslo");
        expect(pivotHeaderRows(result, 0, "Total")).toEqual([["count"]]);
    });

    it("uses distinct count, averages and a single total row without row groups", () => {
        const result = computePivot(
            rows,
            {
                rows: [],
                columns: ["col1"],
                values: [
                    { colId: "col0", fn: "distinctCount" },
                    { colId: "col2", fn: "avg" }
                ]
            },
            info,
            { totals: true, totalLabel: "Total", emptyLabel: "-" }
        );
        expect(result.rows).toHaveLength(1);
        const only = result.rows[0];
        expect(only.cells.p0_0.value).toBe(2); // Oslo: Sales, IT
        expect(only.cells.p1_1.value).toBe(130 / 3);
        expect(result.grandTotal).toBeUndefined();
    });

    it("sanitizes a remembered pivot", () => {
        const valid = (id: string): boolean => /^col[0-2]$/.test(id);
        expect(
            sanitizePivot(
                {
                    active: true,
                    rows: ["col0", "col9", "col0"],
                    columns: 5,
                    values: [
                        { colId: "col2", fn: "sum" },
                        { colId: "col1", fn: "bad" }
                    ]
                },
                valid
            )
        ).toEqual({ active: true, rows: ["col0"], columns: [], values: [{ colId: "col2", fn: "sum" }] });
        expect(sanitizePivot("x", valid)).toBeUndefined();
    });
});

describe("tree data", () => {
    const tasks: GridRow[] = ["1", "2", "3", "4", "5"].map(id => ({
        id,
        item: item(id),
        cells: { col0: { value: Number(id) * 10, display: String(Number(id) * 10), readOnly: true } }
    }));
    const parents: Record<string, string> = { "1": "", "2": "1", "3": "2", "4": "1", "5": "9" };
    const sumColumn = [fakeColumn({ attribute: salary, aggregate: "sum" })];

    it("builds a hierarchy from key and parent key, orphans become top level", () => {
        const model = buildTree(
            tasks,
            row => ({ key: row.id, parentKey: parents[row.id], label: `T${row.id}` }),
            "parentKey"
        );
        expect(model.rows.map(r => `${r.id}:${r.tree?.level}:${r.tree?.hasChildren}`)).toEqual([
            "1:0:true",
            "2:1:true",
            "3:2:false",
            "4:1:false",
            "5:0:false"
        ]);
    });

    it("breaks parent cycles", () => {
        const model = buildTree(
            tasks.slice(0, 2),
            row => ({ key: row.id, parentKey: row.id === "1" ? "2" : "1" }),
            "parentKey"
        );
        expect(model.rows.some(r => r.tree?.level === 0)).toBe(true);
    });

    it("arranges depth first, closes levels and keeps ancestors of matching rows", () => {
        const model = buildTree(tasks, row => ({ key: row.id, parentKey: parents[row.id] }), "parentKey");
        const expand = { depth: -1, toggled: new Set<string>() };
        const all = arrangeTree(model.rows, { rowOf: r => r, nodeOf: id => model.byId.get(id), model, expand });
        expect(all.display.map(r => r.id)).toEqual(["1", "2", "3", "4", "5"]);
        const closed = arrangeTree(model.rows, {
            rowOf: r => r,
            nodeOf: id => model.byId.get(id),
            model,
            expand: toggleTreeKey(expand, "2")
        });
        expect(closed.display.map(r => r.id)).toEqual(["1", "2", "4", "5"]);
        // Only row 3 matches the filter: its parent and grandparent stay as context.
        const filtered = arrangeTree([model.byId.get("3") as GridRow], {
            rowOf: r => r,
            nodeOf: id => model.byId.get(id),
            model,
            expand,
            columns: sumColumn,
            aggregateParents: true
        });
        expect(filtered.display.map(r => r.id)).toEqual(["1", "2", "3"]);
        expect([...filtered.contextIds].sort()).toEqual(["1", "2"]);
        expect(model.byId.get("1")?.tree?.descendants).toBe(1);
        expect(model.byId.get("1")?.aggCells?.col0.value).toBe(30);
    });

    it("builds a path tree with generated levels and aggregates", () => {
        const paths: Record<string, string> = {
            "1": "EU/NO/Oslo",
            "2": "EU/NO/Bergen",
            "3": "EU/IT",
            "4": "US",
            "5": "EU/IT/Rome"
        };
        const model = buildTree(tasks, row => ({ path: splitPath(paths[row.id], "/") }), "path");
        const fillers = model.rows.filter(r => r.tree?.filler).map(r => r.tree?.label);
        expect(fillers.sort()).toEqual(["EU", "NO"]);
        const result = arrangeTree(model.rows, {
            rowOf: r => r,
            nodeOf: id => model.byId.get(id),
            model,
            expand: { depth: -1, toggled: new Set() },
            columns: sumColumn
        });
        expect(result.display.map(r => r.tree?.label)).toEqual(["EU", "NO", "Oslo", "Bergen", "IT", "Rome", "US"]);
        const eu = model.rows.find(r => r.tree?.label === "EU");
        expect(eu?.aggCells?.col0.value).toBe(10 + 20 + 30 + 50);
        expect(isTreeOpen({ depth: 1, toggled: new Set() }, "x", 0)).toBe(true);
        expect(isTreeOpen({ depth: 1, toggled: new Set() }, "x", 1)).toBe(false);
        expect(splitPath(" a // b ", "/")).toEqual(["a", "b"]);
    });
});

describe("cell ranges and fill", () => {
    const order = ["col0", "col1", "col2"];
    const values: Record<string, unknown[]> = {
        col0: ["A", "B", "C", "D"],
        col1: [1, 2, 3, 4],
        col2: [10, 20, undefined, 40]
    };
    const valueAt = (row: number, col: string): unknown => values[col][row];

    it("normalizes, contains and copies as TSV", () => {
        const range = normalizeRange(
            { start: { rowIndex: 2, colId: "col2" }, end: { rowIndex: 0, colId: "col1" } },
            order
        )!;
        expect(range).toEqual({ top: 0, bottom: 2, colIds: ["col1", "col2"] });
        expect(rangeContains(range, 1, "col2")).toBe(true);
        expect(rangeContains(range, 1, "col0")).toBe(false);
        expect(rangeToTsv(range, (r, c) => String(valueAt(r, c) ?? ""), ["X", "Y"])).toBe(
            "X\tY\r\n1\t10\r\n2\t20\r\n3\t"
        );
        expect(rangeStats([1, 2, "x", undefined, 3])).toEqual({ count: 4, numbers: 3, sum: 6, avg: 2, min: 1, max: 3 });
    });

    it("extends with Shift+arrows and mirrors left/right in RTL", () => {
        const start = { start: { rowIndex: 0, colId: "col0" }, end: { rowIndex: 0, colId: "col0" } };
        expect(extendRange(start, "ArrowDown", order, 4).end).toEqual({ rowIndex: 1, colId: "col0" });
        expect(extendRange(start, "ArrowRight", order, 4).end.colId).toBe("col1");
        expect(extendRange(start, "ArrowRight", order, 4, true).end.colId).toBe("col0");
        expect(extendRange(start, "ArrowUp", order, 4).end.rowIndex).toBe(0);
    });

    it("continues series and copies patterns", () => {
        expect(fillValues([1, 2], 3)).toEqual([3, 4, 5]);
        expect(fillValues([5], 2)).toEqual([5, 5]);
        expect(fillValues([5], 2, "series")).toEqual([6, 7]);
        expect(fillValues(["Item 1", "Item 2"], 2)).toEqual(["Item 3", "Item 4"]);
        expect(fillValues(["a", "b"], 3)).toEqual(["a", "b", "a"]);
        expect(fillValues([1, 2], 2, "copy")).toEqual([1, 2]);
        const days = fillValues([new Date(2026, 0, 1), new Date(2026, 0, 3)], 1) as Date[];
        expect(days[0].getDate()).toBe(5);
    });

    it("plans fills down, right and Ctrl+D", () => {
        const range = normalizeRange(
            { start: { rowIndex: 0, colId: "col1" }, end: { rowIndex: 1, colId: "col1" } },
            order
        )!;
        expect(planFill(range, { bottom: 3 }, order, valueAt)).toEqual([
            { rowIndex: 2, colId: "col1", value: 3 },
            { rowIndex: 3, colId: "col1", value: 4 }
        ]);
        const right = planFill(range, { rightColId: "col2" }, order, valueAt);
        expect(right).toEqual([
            { rowIndex: 0, colId: "col2", value: 1 },
            { rowIndex: 1, colId: "col2", value: 2 }
        ]);
        const block = normalizeRange(
            { start: { rowIndex: 0, colId: "col0" }, end: { rowIndex: 2, colId: "col0" } },
            order
        )!;
        expect(planFillDown(block, valueAt).map(cell => cell.value)).toEqual(["A", "A"]);
    });
});

describe("set filter", () => {
    it("lists distinct values in natural order with blanks", () => {
        const list = distinctValues(rows, "col2");
        expect(list.values).toEqual(["10", "20", "30", "40", "50", "60"]);
        const depts = distinctValues(rows, "col0");
        expect(depts).toEqual({ values: ["IT", "Sales"], hasBlanks: true });
        expect(distinctValues(rows, "col0", ["Sales", "IT", "HR"]).values).toEqual(["Sales", "IT", "HR"]);
    });

    it("toggles values, select all with search and reports a summary", () => {
        const list = distinctValues(rows, "col0");
        let model = toggleSetValue(null, "IT", list);
        expect(model).toEqual({ filterType: "set", values: ["Sales", ""] });
        expect(setFilterPasses(model, "IT")).toBe(false);
        expect(setFilterPasses(model, "")).toBe(true);
        model = toggleSetValue(model, "IT", list);
        expect(model).toBeNull();
        const matching = matchingValues(list, "blan", "(Blanks)");
        expect(matching).toEqual([""]);
        model = toggleAllMatching(null, matching, list);
        expect(model?.values).toEqual(["IT", "Sales"]);
        expect(selectionToModel([], list)).toEqual({ filterType: "set", values: [] });
        expect(setFilterSummary({ filterType: "set", values: ["IT"] }, 3, "(Blanks)")).toBe("IT");
        expect(setFilterSummary({ filterType: "set", values: ["IT", ""] }, 3, "(Blanks)")).toBe("2 / 3");
    });

    it("sends set filters on enumerations to the server", () => {
        const status = fakeAttribute({
            id: "status",
            type: "Enum",
            universe: ["new", "done"],
            captions: { new: "New", done: "Done" }
        });
        const filter = buildFilter({ col0: { filterType: "set", values: ["Done", ""] } as any }, "", [
            fakeColumn({ attribute: status })
        ]) as any;
        expect(filter.name).toBe("or");
        expect(filter.args.map((arg: any) => arg.arg2.value)).toEqual([undefined, "done"]);
    });
});

describe("range chart", () => {
    it("derives categories and series from a range", () => {
        const range = { top: 0, bottom: 2, colIds: ["col0", "col2"] };
        const data = chartDataFromRange(
            range,
            (row, col) => rows[row] && rows[row].cells[col],
            col => info.caption(col)
        );
        expect(data.categories).toEqual(["Sales", "IT", "Sales"]);
        expect(data.series).toEqual([{ name: "Salary", values: [10, 20, 30] }]);
        expect(niceScale(0, 87).ticks).toEqual([0, 20, 40, 60, 80, 100]);
        const slices = pieSlices(data, 50, 50, 40);
        expect(slices.map(s => Math.round(s.share * 100))).toEqual([17, 33, 50]);
    });

    it("folds small pie slices into Other", () => {
        const many = {
            categories: "abcdefghij".split(""),
            series: [{ name: "x", values: [10, 9, 8, 7, 6, 5, 4, 3, 2, 1] }]
        };
        const slices = pieSlices(many, 0, 0, 10, "Other");
        expect(slices).toHaveLength(8);
        expect(slices[7]).toMatchObject({ label: "Other", value: 6 });
    });
});

describe("Excel workbook", () => {
    function unpack(bytes: Uint8Array): Record<string, string> {
        const files = unzipSync(bytes);
        const out: Record<string, string> = {};
        Object.entries(files).forEach(([path, content]) => (out[path] = strFromU8(content)));
        return out;
    }

    it("writes several sheets with styles, conditional formats, frozen columns and SUBTOTAL totals", () => {
        const files = unpack(
            buildWorkbook(
                [
                    {
                        name: "Data",
                        columns: [
                            { name: "Name", type: "text", width: 20 },
                            {
                                name: "Salary",
                                type: "number",
                                precision: 2,
                                conditional: "dataBar",
                                conditionalColor: "#0ea58f"
                            },
                            { name: "Score", type: "number", conditional: "iconSet", conditionalReverse: true }
                        ],
                        rows: [
                            ["Ann", 10, 1],
                            ["Bob", 20, 2]
                        ],
                        freezeColumns: 1,
                        totals: [
                            { cells: [{ value: "Total" }, { fn: "sum", value: 30 }, { fn: "distinctCount", value: 2 }] }
                        ]
                    },
                    { name: "Data", columns: [{ name: "X", type: "text" }], rows: [], headerRows: [["Group"]] }
                ],
                { styled: true, headerFill: "#264ae5" }
            )
        );
        expect(files["xl/workbook.xml"]).toContain('<sheet name="Data" sheetId="1"');
        expect(files["xl/workbook.xml"]).toContain('<sheet name="Data (2)" sheetId="2"');
        const sheet = files["xl/worksheets/sheet1.xml"];
        expect(sheet).toContain('<pane xSplit="1" ySplit="1" topLeftCell="B2"');
        expect(sheet).toContain('<col min="1" max="1" width="20"');
        expect(sheet).toContain("<f>SUBTOTAL(109,B2:B3)</f><v>30</v>");
        expect(sheet).toContain('type="dataBar"');
        expect(sheet).toContain('rgb="FF0EA58F"');
        expect(sheet).toContain('iconSet="3Arrows" reverse="1"');
        expect(files["xl/styles.xml"]).toContain('fgColor rgb="FF264AE5"');
        expect(files["xl/worksheets/sheet2.xml"]).toContain('ySplit="2"');
        expect(files["[Content_Types].xml"]).toContain("sheet2.xml");
        expect(argb("#abc")).toBe("FFAABBCC");
    });

    it("keeps the plain 1.2 output for buildXlsx", () => {
        const sheet = unpack(buildXlsx("S", [{ name: "A", type: "text" }], [["\u0001x"]]))["xl/worksheets/sheet1.xml"];
        expect(sheet).not.toContain("conditionalFormatting");
        expect(sheet).toContain('<pane ySplit="1" topLeftCell="A2"');
        expect(sheet).toContain(">x</t>");
    });
});

describe("commit tracker", () => {
    it("tracks running, slow, failed, retried and discarded saves", () => {
        let now = 0;
        const tracker = new CommitTracker(() => now, 1000);
        const events: number[] = [];
        tracker.subscribe(() => events.push(tracker.snapshot().pending));
        const ok = tracker.monitor({ rowId: "a", colId: "col0", oldValue: 1, newValue: 2 }).start();
        const bad = tracker.monitor({ rowId: "b", colId: "col0", oldValue: 3, newValue: 4 }).start();
        now = 2000;
        expect(tracker.snapshot()).toMatchObject({ pending: 2, slow: 2 });
        ok.done();
        const retry = jest.fn();
        bad.failed(new Error("network down"), retry);
        bad.done(); // ignored after failing
        const snap = tracker.snapshot();
        expect(snap.pending).toBe(0);
        expect(snap.failed.map(f => f.message)).toEqual(["network down"]);
        tracker.retryAll();
        expect(retry).toHaveBeenCalledTimes(1);
        expect(tracker.snapshot().failed).toHaveLength(0);
        tracker.monitor({ rowId: "c", colId: "col1", oldValue: 1, newValue: 2 }).start().failed("x", jest.fn());
        expect(tracker.discardAll().map(f => f.oldValue)).toEqual([1]);
        expect(tracker.hasWork()).toBe(false);
        expect(failedText("[count] change(s) could not be saved.", 2)).toBe("2 change(s) could not be saved.");
        expect(events.length).toBeGreaterThan(3);
    });
});

describe("data source queue", () => {
    function fakeDs(): any {
        const ds: any = {
            status: "available",
            offset: 0,
            limit: 10,
            sortOrder: [],
            filter: undefined,
            items: [],
            totalCount: 0,
            setOffset: (v: number) => (ds.offset = v),
            setLimit: (v: number) => (ds.limit = v),
            setSortOrder: (v: unknown) => (ds.sortOrder = v),
            setFilter: (v: unknown) => (ds.filter = v),
            requestTotalCount: () => undefined
        };
        return ds;
    }

    it("answers requests one after the other once the data source holds the page", async () => {
        const ds = fakeDs();
        // The data source answers only after an update (like Mendix after a round trip).
        ds.setLimit = (v: number) => {
            ds.limit = v;
            ds.status = "loading";
        };
        const queue = new DatasourceQueue(() => ds, 1000);
        const first = queue.request({
            filter: undefined,
            sortOrder: [],
            offset: 0,
            limit: 1,
            build: (_items, total) => `A${total}`
        });
        const second = queue.request({ filter: { f: 1 } as any, sortOrder: [], offset: 5, limit: 2, build: () => "B" });
        expect(queue.busy).toBe(true);
        ds.status = "available";
        ds.totalCount = 7;
        queue.pump();
        await expect(first).resolves.toBe("A7");
        expect(ds.offset).toBe(5);
        ds.status = "available";
        queue.pump();
        await expect(second).resolves.toBe("B");
        expect(queue.busy).toBe(false);
    });

    it("cancels and times out", async () => {
        jest.useFakeTimers();
        const ds = fakeDs();
        ds.setLimit = () => (ds.status = "loading");
        const queue = new DatasourceQueue(() => ds, 50);
        const slow = queue.request({ filter: undefined, sortOrder: [], offset: 0, limit: 3, build: () => 1 });
        jest.advanceTimersByTime(60);
        await expect(slow).rejects.toThrow("did not answer");
        const cancelled = queue.request({ filter: undefined, sortOrder: [], offset: 0, limit: 3, build: () => 1 });
        queue.cancelAll();
        await expect(cancelled).rejects.toThrow("cancelled");
        jest.useRealTimers();
    });
});

describe("lazy server groups", () => {
    const status = fakeAttribute({
        id: "status",
        type: "Enum",
        universe: ["new", "done"],
        captions: { new: "New", done: "Done" }
    });
    const statusColumn = fakeColumn({ attribute: status });

    it("knows which columns can be grouped and their values", () => {
        expect(canServerGroup(statusColumn)).toBe(true);
        expect(canServerGroup(columns[0])).toBe(false);
        expect(serverGroupValues(statusColumn).map(v => v.label)).toEqual(["New", "Done", ""]);
    });

    it("shows headers, loaded rows of open groups and a load more row", () => {
        const groups = initialServerGroups(serverGroupValues(statusColumn));
        groups[0] = { ...groups[0], count: 3, open: true, rows: rows.slice(0, 2) };
        groups[1] = { ...groups[1], count: 0 };
        groups[2] = { ...groups[2], count: 1 };
        const display = serverGroupDisplay(groups, "col0", "Status", "(empty)");
        expect(
            display.map(row => (row.group ? `[${row.group.label} ${row.group.count}]` : row.loadMore ? "more" : row.id))
        ).toEqual(["[New 3]", "a", "b", "more", "[(empty) 1]"]);
    });
});
