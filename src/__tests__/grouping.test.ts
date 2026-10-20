import { GridRow } from "../utils/rows";
import {
    CollapseState,
    arrangeGroups,
    buildGroupRows,
    canGroupBy,
    compareGroupValues,
    describeGroupBy,
    initialGroupBy,
    isCollapsed,
    moveGroupBy,
    pathFor,
    sanitizeGroupBy,
    toggleCollapsed,
    toggleGroupBy
} from "../utils/grouping";
import { fakeAttribute, fakeColumn } from "./helpers";

function row(id: string, cells: Record<string, unknown>): GridRow {
    const data: GridRow = { id, item: { id } as never, cells: {} };
    Object.entries(cells).forEach(([key, value]) => {
        data.cells[key] = { value, display: value === undefined ? "" : String(value), readOnly: false };
    });
    return data;
}

const dept = fakeAttribute({ id: "attr_dept", type: "String" });
const city = fakeAttribute({ id: "attr_city", type: "String" });
const salary = fakeAttribute({ id: "attr_salary", type: "Decimal" });
const columns = [
    fakeColumn({ attribute: dept, header: { value: "Department" } as never }),
    fakeColumn({ attribute: city, header: { value: "City" } as never }),
    fakeColumn({ attribute: salary, header: { value: "Salary" } as never, aggregate: "sum" })
];
const caption = (id: string): string => ({ col0: "Department", col1: "City", col2: "Salary" }[id] ?? id);

const data = [
    row("1", { col0: "Sales", col1: "Paris", col2: 100 }),
    row("2", { col0: "IT", col1: "Oslo", col2: 200 }),
    row("3", { col0: "Sales", col1: "Oslo", col2: 50 }),
    row("4", { col0: "IT", col1: "Oslo", col2: 25 }),
    row("5", { col0: undefined, col1: "Rome", col2: 1 })
];
const expanded: CollapseState = { mode: "expanded", exceptions: new Set() };
const ids = (rows: GridRow[]): string[] => rows.map(r => (r.group ? `[${r.group.label}]` : r.id));

describe("grouping configuration", () => {
    it("reads the configured levels in order and ignores custom content", () => {
        const configured = [
            fakeColumn({ attribute: dept, groupIndex: 2 }),
            fakeColumn({ attribute: city, groupIndex: 1 }),
            fakeColumn({ columnType: "customContent", groupIndex: 3 })
        ];
        expect(initialGroupBy(configured)).toEqual(["col1", "col0"]);
    });

    it("limits grouping to three levels and toggles columns", () => {
        expect(toggleGroupBy(["col0"], "col1")).toEqual(["col0", "col1"]);
        expect(toggleGroupBy(["col0", "col1"], "col0")).toEqual(["col1"]);
        expect(toggleGroupBy(["a", "b", "c"], "d")).toEqual(["a", "b", "c"]);
    });

    it("moves levels and keeps the ends in place", () => {
        expect(moveGroupBy(["a", "b", "c"], "c", -1)).toEqual(["a", "c", "b"]);
        expect(moveGroupBy(["a", "b"], "a", -1)).toEqual(["a", "b"]);
    });

    it("sanitizes remembered groupings", () => {
        expect(sanitizeGroupBy(["col1", "col1", "col9", 4, "x"], columns)).toEqual(["col1"]);
        expect(sanitizeGroupBy("nope", columns)).toEqual([]);
    });

    it("only allows grouping on value columns that permit it", () => {
        expect(canGroupBy(columns[0])).toBe(true);
        expect(canGroupBy(fakeColumn({ attribute: dept, groupable: false }))).toBe(false);
        expect(canGroupBy(fakeColumn({ columnType: "customContent" }))).toBe(false);
    });

    it("describes a grouping for the action variable", () => {
        expect(describeGroupBy(["col0", "col1"], caption)).toBe("Department > City");
    });
});

describe("group rows and arranging", () => {
    it("creates one header per distinct path", () => {
        const groups = buildGroupRows(data, ["col0", "col1"], caption, "(empty)");
        const labels = groups.map(g => `${g.group?.level}:${g.group?.label}`);
        expect(labels).toEqual(["0:Sales", "1:Paris", "0:IT", "1:Oslo", "1:Oslo", "0:(empty)", "1:Rome"]);
        expect(new Set(groups.map(g => g.id)).size).toBe(groups.length);
    });

    it("puts rows under their group in sorted group order with counts and aggregates", () => {
        const groups = buildGroupRows(data, ["col0"], caption, "(empty)");
        const result = arrangeGroups([...groups, ...data], {
            rowOf: r => r,
            groupBy: ["col0"],
            collapse: expanded,
            direction: () => undefined,
            columns
        });
        expect(ids(result.display)).toEqual(["[(empty)]", "5", "[IT]", "2", "4", "[Sales]", "1", "3"]);
        const it = result.display.find(r => r.group?.label === "IT") as GridRow;
        expect(it.group?.count).toBe(2);
        expect(it.cells.col2.value).toBe(225);
    });

    it("follows a descending sort on the grouped column", () => {
        const groups = buildGroupRows(data, ["col0"], caption, "(empty)");
        const result = arrangeGroups([...groups, ...data], {
            rowOf: r => r,
            groupBy: ["col0"],
            collapse: expanded,
            direction: id => (id === "col0" ? "desc" : undefined),
            columns
        });
        expect(ids(result.display).filter(id => id.startsWith("["))).toEqual(["[Sales]", "[IT]", "[(empty)]"]);
    });

    it("hides the rows of collapsed groups but keeps them for exports", () => {
        const groups = buildGroupRows(data, ["col0", "col1"], caption, "(empty)");
        const collapse = toggleCollapsed(expanded, pathFor(["IT"]));
        const result = arrangeGroups([...groups, ...data], {
            rowOf: r => r,
            groupBy: ["col0", "col1"],
            collapse,
            direction: () => undefined,
            columns
        });
        expect(ids(result.display)).toEqual([
            "[(empty)]",
            "[Rome]",
            "5",
            "[IT]",
            "[Sales]",
            "[Oslo]",
            "3",
            "[Paris]",
            "1"
        ]);
        expect(result.leaves.map(r => r.id)).toEqual(["5", "2", "4", "3", "1"]);
        expect(result.sequence.filter(e => e.row.group).map(e => e.level)).toEqual([0, 1, 0, 1, 0, 1, 1]);
    });

    it("drops groups whose rows are all filtered out", () => {
        const groups = buildGroupRows(data, ["col0"], caption, "(empty)");
        const filtered = data.filter(r => r.cells.col0.display !== "IT");
        const result = arrangeGroups([...groups, ...filtered], {
            rowOf: r => r,
            groupBy: ["col0"],
            collapse: expanded,
            direction: () => undefined,
            columns
        });
        expect(ids(result.display)).not.toContain("[IT]");
    });

    it("keeps a detail row under its parent and drops it inside a collapsed group", () => {
        const groups = buildGroupRows(data, ["col0"], caption, "(empty)");
        const detail: GridRow = { id: "2__d", cells: {}, detail: true, parentId: "2" };
        const open = arrangeGroups([detail, ...groups, ...data], {
            rowOf: r => r,
            groupBy: ["col0"],
            collapse: expanded,
            direction: () => undefined,
            columns
        });
        expect(ids(open.display).slice(2, 6)).toEqual(["[IT]", "2", "2__d", "4"]);
        const closed = arrangeGroups([detail, ...groups, ...data], {
            rowOf: r => r,
            groupBy: ["col0"],
            collapse: { mode: "collapsed", exceptions: new Set() },
            direction: () => undefined,
            columns
        });
        expect(ids(closed.display)).toEqual(["[(empty)]", "[IT]", "[Sales]"]);
    });

    it("tracks collapsed groups in both modes", () => {
        const collapsedAll: CollapseState = { mode: "collapsed", exceptions: new Set() };
        expect(isCollapsed(collapsedAll, "x")).toBe(true);
        expect(isCollapsed(toggleCollapsed(collapsedAll, "x"), "x")).toBe(false);
        expect(isCollapsed(toggleCollapsed(toggleCollapsed(expanded, "x"), "x"), "x")).toBe(false);
    });

    it("compares group values naturally", () => {
        expect(compareGroupValues(2, 10)).toBeLessThan(0);
        expect(compareGroupValues("item 2", "item 10")).toBeLessThan(0);
        expect(compareGroupValues(undefined, "a")).toBeLessThan(0);
        expect(compareGroupValues(new Date(2020, 1, 1), new Date(2019, 1, 1))).toBeGreaterThan(0);
    });
});
