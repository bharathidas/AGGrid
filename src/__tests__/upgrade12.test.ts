import { strFromU8, unzipSync } from "fflate";

import { GridRow } from "../utils/rows";
import { columnRanges, formatCell, ratio, scaleColor, trendIcon } from "../utils/conditional";
import {
    localeIsMonthFirst,
    parseBoolean,
    parseClipboard,
    parseDate,
    parseNumber,
    parsePastedValue,
    planPaste
} from "../utils/clipboard";
import { parseSeries, sparkline } from "../utils/sparkline";
import { countUpValue, statusRowsText, statusSummary } from "../utils/statusBar";
import { findMatches, searchTerms } from "../utils/highlight";
import { resolveMotion } from "../utils/motion";
import { densityRowHeight, isDensity, nextDensity } from "../utils/theme";
import { parseViews, viewStateKey } from "../utils/views";
import { shortcutsFor } from "../utils/shortcuts";
import { buildXlsx } from "../utils/xlsx";
import { fakeAttribute, fakeColumn } from "./helpers";

function row(id: string, cells: Record<string, unknown>): GridRow {
    const data: GridRow = { id, item: { id } as never, cells: {} };
    Object.entries(cells).forEach(([key, value]) => {
        data.cells[key] = { value, display: value === undefined ? "" : String(value), readOnly: false };
    });
    return data;
}

const amount = fakeAttribute({ id: "attr_amount", type: "Decimal" });
const label = fakeAttribute({ id: "attr_label", type: "String" });

describe("conditional formatting", () => {
    const columns = [
        fakeColumn({ attribute: label }),
        fakeColumn({ attribute: amount, conditionalFormat: "dataBar" }),
        fakeColumn({ attribute: label, conditionalFormat: "colorScale" })
    ];
    const rows = [row("1", { col0: "a", col1: -50 }), row("2", { col0: "b", col1: 150 }), row("3", { col1: 50 })];

    it("measures ranges of formatted number columns only", () => {
        const ranges = columnRanges(rows, columns);
        expect(Array.from(ranges.keys())).toEqual(["col1"]);
        expect(ranges.get("col1")).toEqual({ min: -50, max: 150 });
    });

    it("positions values in the range", () => {
        expect(ratio(50, { min: -50, max: 150 })).toBe(0.5);
        expect(ratio(7, { min: 7, max: 7 })).toBe(0.5);
        expect(ratio("x", { min: 0, max: 1 })).toBeUndefined();
    });

    it("draws data bars from the zero axis", () => {
        const negative = formatCell("dataBar", -50, { min: -50, max: 150 }, "#0ea58f", false);
        expect(negative.className).toBe("mxt-ag-cf-bar");
        expect(negative.style?.backgroundImage).toContain("transparent 0.00%");
        expect(negative.style?.backgroundImage).toContain("25.00%");
    });

    it("colors the scale red to green and reverses it", () => {
        expect(scaleColor(0)).toBe("rgb(248, 105, 107)");
        expect(scaleColor(1)).toBe("rgb(99, 190, 123)");
        expect(scaleColor(1, true)).toBe("rgb(248, 105, 107)");
    });

    it("picks icons by thirds", () => {
        expect(trendIcon(0.9)).toBe("up");
        expect(trendIcon(0.5)).toBe("flat");
        expect(trendIcon(0.1)).toBe("down");
        expect(trendIcon(0.1, true)).toBe("up");
        expect(formatCell("iconSet", 150, { min: 0, max: 150 }, "", false).className).toContain("--up");
    });
});

describe("paste from Excel", () => {
    it("parses tabs, lines and quoted cells", () => {
        expect(parseClipboard("a\tb\r\nc\td\r\n")).toEqual([
            ["a", "b"],
            ["c", "d"]
        ]);
        expect(parseClipboard('"x\ty"\t"he said ""hi"""\n"multi\nline"')).toEqual([
            ["x\ty", 'he said "hi"'],
            ["multi\nline"]
        ]);
        expect(parseClipboard("single")).toEqual([["single"]]);
    });

    it("plans a block and cuts it at the grid edge", () => {
        const plan = planPaste(
            [
                ["1", "2", "3"],
                ["4", "5", "6"]
            ],
            1,
            2
        );
        expect(plan).toEqual([
            { rowOffset: 0, colOffset: 0, text: "1" },
            { rowOffset: 0, colOffset: 1, text: "2" }
        ]);
        expect(planPaste([["x"]], 5, 3, 3)).toHaveLength(3);
    });

    it("reads numbers in common notations", () => {
        expect(parseNumber("1,234.50")).toBe(1234.5);
        expect(parseNumber("1.234,50")).toBe(1234.5);
        expect(parseNumber("12,5")).toBe(12.5);
        expect(parseNumber("1,234")).toBe(1234);
        expect(parseNumber("€ 99")).toBe(99);
        expect(parseNumber("(42)")).toBe(-42);
        expect(parseNumber("12%")).toBe(0.12);
        expect(parseNumber("abc")).toBeUndefined();
    });

    it("reads booleans and dates", () => {
        expect(parseBoolean("Yes")).toBe(true);
        expect(parseBoolean("nee")).toBe(false);
        expect(parseBoolean("Ja!", { yes: "Ja!" })).toBe(true);
        expect(parseBoolean("maybe")).toBeUndefined();
        expect(parseDate("2026-10-09")?.getDate()).toBe(9);
        expect(parseDate("09-10-2026")?.getMonth()).toBe(9);
        expect(parseDate("10/09/2026", true)?.getMonth()).toBe(9);
        expect(parseDate("31-02-2026")).toBeUndefined();
        expect(localeIsMonthFirst("en-US")).toBe(true);
        expect(localeIsMonthFirst("nl-NL")).toBe(false);
    });

    it("converts pasted text per column kind and skips misfits", () => {
        expect(parsePastedValue("number", "1,5")).toEqual({ ok: true, value: 1.5 });
        expect(parsePastedValue("number", "n/a")).toEqual({ ok: false });
        expect(parsePastedValue("enum", "in progress", { enumCaptions: { Busy: "In progress" } })).toEqual({
            ok: true,
            value: "Busy"
        });
        expect(parsePastedValue("enum", "unknown", { enumCaptions: { Busy: "In progress" } })).toEqual({ ok: false });
        expect(parsePastedValue("text", " keep ")).toEqual({ ok: true, value: " keep " });
        expect(parsePastedValue("object", "x")).toEqual({ ok: false });
    });
});

describe("sparklines", () => {
    it("parses series and computes geometry", () => {
        expect(parseSeries("3, 5;4 8|7")).toEqual([3, 5, 4, 8, 7]);
        expect(parseSeries(undefined)).toEqual([]);
        const geometry = sparkline([1, 3, 2], 100, 24);
        expect(geometry?.trend).toBe("up");
        expect(geometry?.points.split(" ")).toHaveLength(3);
        expect(geometry?.last.x).toBeCloseTo(98);
        expect(sparkline([], 100, 24)).toBeUndefined();
        expect(sparkline([5], 100, 24)?.trend).toBe("flat");
    });
});

describe("status bar", () => {
    const columns = [
        fakeColumn({ attribute: label }),
        fakeColumn({ attribute: amount, aggregate: "sum" }),
        fakeColumn({ attribute: amount, aggregate: "max" })
    ];
    const rows = [row("1", { col0: "a", col1: 10, col2: 10 }), row("2", { col0: "b", col1: 5, col2: 5 })];
    const caption = (id: string): string => id.toUpperCase();

    it("aggregates the shown rows when nothing is selected", () => {
        const summary = statusSummary(rows, [], 9, columns, caption);
        expect(summary).toMatchObject({ shown: 2, total: 9, selected: 0, ofSelection: false });
        expect(summary.aggregates.map(a => `${a.kind} ${a.caption} ${a.display}`)).toEqual([
            "Sum COL1 15",
            "Max COL2 10"
        ]);
    });

    it("aggregates the selection and leaves out hidden columns", () => {
        const summary = statusSummary(rows, [rows[1]], 2, columns, caption, id => id !== "col2");
        expect(summary.ofSelection).toBe(true);
        expect(summary.aggregates.map(a => a.display)).toEqual(["5"]);
    });

    it("fills the rows template and eases counts", () => {
        expect(statusRowsText("[shown] of [total] rows", { shown: 3, total: 10 })).toBe("3 of 10 rows");
        expect(countUpValue(0, 100, 0)).toBe(0);
        expect(countUpValue(0, 100, 1)).toBe(100);
        expect(countUpValue(0, 100, 0.5)).toBeGreaterThan(50);
    });
});

describe("search highlight", () => {
    it("splits terms and merges overlapping matches", () => {
        expect(searchTerms("  Ann  ann bob ")).toEqual(["ann", "bob"]);
        expect(findMatches("Annabel and Bob", ["ann", "bob"])).toEqual([
            [0, 3],
            [12, 15]
        ]);
        expect(findMatches("aaaa", ["aa", "aaa"])).toEqual([[0, 4]]);
        expect(findMatches("", ["a"])).toEqual([]);
    });
});

describe("motion and density", () => {
    it("resolves the motion level", () => {
        expect(resolveMotion("full", true, false)).toBe("full");
        expect(resolveMotion("subtle", true, false)).toBe("subtle");
        expect(resolveMotion("full", false, false)).toBe("off");
        expect(resolveMotion("full", true, true)).toBe("off");
        expect(resolveMotion(undefined, true, false)).toBe("full");
    });

    it("cycles densities and scales fixed row heights", () => {
        expect(nextDensity(undefined)).toBe("comfortable");
        expect(nextDensity("comfortable")).toBe("compact");
        expect(isDensity("normal")).toBe(true);
        expect(isDensity("huge")).toBe(false);
        expect(densityRowHeight(40, "compact")).toBe(30);
        expect(densityRowHeight(0, "compact")).toBe(0);
    });
});

describe("views and shortcuts with 1.2 state", () => {
    it("keeps grouping and density in saved views", () => {
        const doc = parseViews(
            JSON.stringify({
                version: 1,
                views: [{ id: "a", name: "A", state: { groupBy: ["col1", 3], density: "compact" } }]
            })
        );
        expect(doc.views[0].state.groupBy).toEqual(["col1"]);
        expect(doc.views[0].state.density).toBe("compact");
        expect(viewStateKey({ groupBy: ["col1"] })).not.toBe(viewStateKey({}));
        expect(viewStateKey({ quickFilter: "" })).toBe(viewStateKey({}));
    });

    it("lists paste and group shortcuts when enabled", () => {
        const base = {
            editing: true,
            undoRedo: true,
            selection: false,
            detail: false,
            validation: false,
            quickSearch: false
        };
        const keys = shortcutsFor({ ...base, paste: true, grouping: true }).map(s => s.keys);
        expect(keys).toContain("Ctrl+V");
        expect(shortcutsFor(base).map(s => s.keys)).not.toContain("Ctrl+V");
    });
});

describe("Excel outline", () => {
    it("writes outline levels and bold group rows", () => {
        const bytes = buildXlsx(
            "Sheet",
            [
                { name: "Name", type: "text" },
                { name: "Amount", type: "number" }
            ],
            [
                ["Dept: IT (2)", 30],
                ["Ann", 10],
                ["Bob", 20]
            ],
            [{ outlineLevel: 0, bold: true }, { outlineLevel: 1 }, { outlineLevel: 1 }]
        );
        const sheet = strFromU8(unzipSync(bytes)["xl/worksheets/sheet1.xml"]);
        expect(sheet).toContain('<sheetPr><outlinePr summaryBelow="0"/></sheetPr>');
        expect(sheet).toContain('outlineLevelRow="1"');
        expect(sheet).toContain('<row r="3" outlineLevel="1">');
        expect(sheet).toMatch(/<c r="A2" t="inlineStr" s="1">/);
    });

    it("leaves sheets without groups unchanged", () => {
        const sheet = strFromU8(
            unzipSync(buildXlsx("S", [{ name: "N", type: "text" }], [["a"]]))["xl/worksheets/sheet1.xml"]
        );
        expect(sheet).not.toContain("outline");
    });
});
