import { Big } from "big.js";

import { GridRow } from "../utils/rows";
import { computeTotalsFromRows, totalsFromItem } from "../utils/totals";
import { fakeAttribute, fakeColumn, item } from "./helpers";

function row(id: string, cells: Record<string, unknown>): GridRow {
    const data: GridRow = { id, cells: {} };
    Object.entries(cells).forEach(([key, value]) => {
        data.cells[key] = { value, display: String(value ?? ""), readOnly: false };
    });
    return data;
}

const name = fakeAttribute({ id: "attr_name", type: "String" });
const salary = fakeAttribute({ id: "attr_salary", type: "Decimal" });
const hired = fakeAttribute({ id: "attr_hired", type: "DateTime" });

describe("computeTotalsFromRows", () => {
    const rows = [
        row("1", { col0: "Ann", col1: 1000.1, col2: new Date(2020, 0, 1) }),
        row("2", { col0: "Bob", col1: 2000.2, col2: new Date(2021, 0, 1) }),
        row("3", { col0: "", col1: undefined, col2: undefined })
    ];

    it("sums, averages and counts, and puts the label in the first free column", () => {
        const totals = computeTotalsFromRows(
            rows,
            [
                fakeColumn({ attribute: name }),
                fakeColumn({ attribute: salary, aggregate: "sum", decimalPrecision: 2 }),
                fakeColumn({ attribute: hired, aggregate: "max" })
            ],
            "Total"
        );
        expect(totals.totals).toBe(true);
        expect(totals.cells.col0.display).toBe("Total");
        expect(totals.cells.col1.value).toBe(3000.3);
        expect(totals.cells.col1.display).toBe("3000.30");
        expect(totals.cells.col2.value).toEqual(new Date(2021, 0, 1));
    });

    it("counts non-empty values and averages numbers", () => {
        const totals = computeTotalsFromRows(
            rows,
            [fakeColumn({ attribute: name, aggregate: "count" }), fakeColumn({ attribute: salary, aggregate: "avg" })],
            "Total"
        );
        expect(totals.cells.col0.display).toBe("2");
        expect(totals.cells.col1.value).toBe(1500.15);
    });

    it("drops floating point noise from sums", () => {
        const noisy = [row("1", { col0: 0.1 }), row("2", { col0: 0.2 })];
        const totals = computeTotalsFromRows(noisy, [fakeColumn({ attribute: salary, aggregate: "sum" })], "T");
        expect(totals.cells.col0.value).toBe(0.3);
    });
});

describe("totalsFromItem", () => {
    const totalSalary = fakeAttribute({
        id: "attr_total",
        type: "Decimal",
        values: { totals1: new Big("123456.789") }
    });
    const totalCount = fakeAttribute({ id: "attr_count", type: "Long", values: { totals1: new Big(8) } });

    it("reads the mapped attributes of the totals object", () => {
        const totals = totalsFromItem(
            item("totals1"),
            [
                fakeColumn({ attribute: name }),
                fakeColumn({ attribute: salary, totalAttribute: totalSalary, decimalPrecision: 1, groupDigits: true }),
                fakeColumn({ attribute: hired, totalAttribute: totalCount })
            ],
            "Total"
        );
        expect(totals.cells.col0.display).toBe("Total");
        expect(totals.cells.col1.display).toBe("123,456.8");
        expect(totals.cells.col2.display).toBe("8");
    });

    it("shows only the label when there is no totals object yet", () => {
        const totals = totalsFromItem(undefined, [fakeColumn({ attribute: name, totalAttribute: totalCount })], "Sum");
        expect(totals.cells.col0.display).toBe("Sum");
    });
});
