/* Performance budgets on 10,000 rows for the pure parts of the grid (the browser work AG Grid does is measured
   in the browser harness). Budgets are generous so slow CI machines pass; the measured numbers are printed and
   recorded in the CHANGELOG. */
import { Big } from "big.js";

import { ColumnsType } from "../../typings/AGGridProps";
import { buildRows } from "../utils/rows";
import { arrangeGroups, buildGroupRows } from "../utils/grouping";
import { computePivot } from "../utils/pivot";
import { arrangeTree, buildTree, splitPath } from "../utils/tree";
import { computeTotalsFromRows } from "../utils/totals";
import { distinctValues } from "../utils/setFilter";
import { normalizeRange, rangeToTsv } from "../utils/range";
import { buildWorkbook } from "../utils/xlsx";
import { fakeAttribute, fakeColumn, item } from "./helpers";

const ROWS = 10000;
const ids = Array.from({ length: ROWS }, (_, index) => `r${index}`);
const valuesOf = (fn: (index: number) => unknown): Record<string, unknown> =>
    Object.fromEntries(ids.map((id, index) => [id, fn(index)]));
const REGIONS = ["North", "South", "East", "West"];
const columns: ColumnsType[] = [
    fakeColumn({ attribute: fakeAttribute({ id: "name", type: "String", values: valuesOf(i => `Name ${i}`) }) }),
    fakeColumn({ attribute: fakeAttribute({ id: "region", type: "String", values: valuesOf(i => REGIONS[i % 4]) }) }),
    fakeColumn({ attribute: fakeAttribute({ id: "team", type: "String", values: valuesOf(i => `Team ${i % 25}`) }) }),
    fakeColumn({
        attribute: fakeAttribute({ id: "amount", type: "Decimal", values: valuesOf(i => new Big((i * 37) % 1000)) }),
        aggregate: "sum"
    }),
    fakeColumn({
        attribute: fakeAttribute({ id: "year", type: "Integer", values: valuesOf(i => new Big(2020 + (i % 6))) })
    }),
    fakeColumn({
        attribute: fakeAttribute({
            id: "path",
            type: "String",
            values: valuesOf(i => `${REGIONS[i % 4]}/T${i % 25}/${i}`)
        })
    })
];
const results: Record<string, number> = {};

function measure<T>(name: string, budgetMs: number, run: () => T): T {
    const start = performance.now();
    const result = run();
    const elapsed = performance.now() - start;
    results[name] = Math.round(elapsed);
    expect(elapsed).toBeLessThan(budgetMs);
    return result;
}

const rows = measure("buildRows (10k x 6 columns)", 3000, () => buildRows(ids.map(item), columns));

afterAll(() => {
    process.stdout.write(`\nAGGrid perf (ms, ${ROWS} rows): ${JSON.stringify(results)}\n`);
});

describe("performance budgets on 10,000 rows", () => {
    it("groups two levels with aggregates", () => {
        const groupRows = buildGroupRows(rows, ["col1", "col2"], id => id, "(empty)");
        const result = measure("arrangeGroups (2 levels)", 1500, () =>
            arrangeGroups([...groupRows, ...rows], {
                rowOf: row => row,
                groupBy: ["col1", "col2"],
                collapse: { mode: "expanded", exceptions: new Set() },
                direction: () => undefined,
                columns
            })
        );
        expect(result.leaves).toHaveLength(ROWS);
    });

    it("pivots region x year with sum and distinct count", () => {
        const pivot = measure("computePivot (2 row groups x 1 column label, 2 values)", 1500, () =>
            computePivot(
                rows,
                {
                    rows: ["col1", "col2"],
                    columns: ["col4"],
                    values: [
                        { colId: "col3", fn: "sum" },
                        { colId: "col0", fn: "distinctCount" }
                    ]
                },
                { caption: id => id, format: (_c, _f, v) => String(v), fnLabel: fn => fn },
                { totals: true, totalLabel: "Total", emptyLabel: "-" }
            )
        );
        expect(pivot.rows.length).toBe(4 + 100);
        expect(pivot.columns.length).toBe(6 * 2 + 2);
    });

    it("builds and arranges a path tree", () => {
        const model = measure("buildTree (path, 3 levels)", 1500, () =>
            buildTree(rows, row => ({ path: splitPath(String(row.cells.col5.value), "/") }), "path")
        );
        const arranged = measure("arrangeTree (all open, aggregates)", 1500, () =>
            arrangeTree(model.rows, {
                rowOf: row => row,
                nodeOf: id => model.byId.get(id),
                model,
                expand: { depth: -1, toggled: new Set() },
                columns,
                aggregateParents: true
            })
        );
        expect(arranged.display.length).toBe(ROWS + 4 + 100);
    });

    it("computes totals, distinct values and copies a large range", () => {
        measure("computeTotalsFromRows", 500, () => computeTotalsFromRows(rows, columns, "Total"));
        const list = measure("distinctValues (set filter list)", 500, () => distinctValues(rows, "col0"));
        expect(list.values).toHaveLength(ROWS);
        const range = normalizeRange(
            { start: { rowIndex: 0, colId: "col0" }, end: { rowIndex: ROWS - 1, colId: "col4" } },
            ["col0", "col1", "col2", "col3", "col4"]
        );
        const text = measure("rangeToTsv (10k x 5)", 800, () =>
            rangeToTsv(range!, (row, col) => rows[row].cells[col]?.display)
        );
        expect(text.split("\r\n")).toHaveLength(ROWS);
    });

    it("writes a styled Excel workbook", () => {
        const bytes = measure("buildWorkbook (styled, 10k x 6)", 4000, () =>
            buildWorkbook(
                [
                    {
                        name: "Data",
                        columns: columns.map((_, index) => ({
                            name: `C${index}`,
                            type: index === 3 || index === 4 ? "number" : "text",
                            conditional: index === 3 ? "dataBar" : undefined
                        })),
                        rows: rows.map(row => columns.map((_, index) => row.cells[`col${index}`].value as string)),
                        totals: [
                            { cells: columns.map((_, index) => ({ fn: index === 3 ? "sum" : undefined, value: "" })) }
                        ]
                    }
                ],
                { styled: true }
            )
        );
        expect(bytes.length).toBeGreaterThan(1000);
    });
});
