import { Big } from "big.js";

import { GridRow, buildRow } from "../utils/rows";
import {
    CellIssue,
    cellError,
    changedIssueRows,
    collectIssues,
    hasValidation,
    issuesKey,
    issuesText,
    nextIssue,
    objectErrors
} from "../utils/validation";
import { fakeAttribute, fakeColumn, item } from "./helpers";

function row(id: string, errors: Record<string, string | undefined>, extra: Partial<GridRow> = {}): GridRow {
    const cells: GridRow["cells"] = {};
    Object.entries(errors).forEach(([colId, error]) => {
        cells[colId] = { value: 1, display: "1", error, readOnly: true };
    });
    return { id, cells, ...extra };
}

function expression(values: Record<string, string>): any {
    return { get: (target: { id: string }) => ({ value: values[target.id] ?? "" }) };
}

describe("cell validation", () => {
    it("prefers the expression message over Mendix validation feedback", () => {
        expect(cellError(undefined)).toBeUndefined();
        expect(cellError({ value: 1, display: "1", readOnly: true })).toBeUndefined();
        expect(cellError({ value: 1, display: "1", readOnly: true, validation: "Mendix" })).toBe("Mendix");
        expect(cellError({ value: 1, display: "1", readOnly: true, validation: "Mendix", error: "Rule" })).toBe("Rule");
    });

    it("collects issues in display order and skips totals and detail rows", () => {
        const issues = collectIssues(
            [
                { row: row("b", { col0: undefined, col1: "Too high" }), rowIndex: 1 },
                { row: row("a", { col0: "Empty", col1: "Negative" }), rowIndex: 0 },
                { row: row("t", { col0: "x" }, { totals: true }), rowIndex: 2 },
                { row: row("d", { col0: "x" }, { detail: true }), rowIndex: 3 },
                { row: undefined, rowIndex: 4 }
            ],
            ["col0", "col1"]
        );
        expect(issues.map(issue => `${issue.rowId}:${issue.colId}`)).toEqual(["b:col1", "a:col0", "a:col1"]);
        expect(issues[0].message).toBe("Too high");
    });

    it("finds the next and previous issue, wrapping around", () => {
        const issues: CellIssue[] = [
            { rowId: "r2", colId: "col0", rowIndex: 2, message: "c" },
            { rowId: "r0", colId: "col1", rowIndex: 0, message: "b" },
            { rowId: "r0", colId: "col0", rowIndex: 0, message: "a" }
        ];
        const order = ["col0", "col1"];
        expect(nextIssue([], undefined, order)).toBeUndefined();
        expect(nextIssue(issues, undefined, order)?.message).toBe("a");
        expect(nextIssue(issues, undefined, order, -1)?.message).toBe("c");
        expect(nextIssue(issues, { rowIndex: 0, colId: "col0" }, order)?.message).toBe("b");
        expect(nextIssue(issues, { rowIndex: 0, colId: "col1" }, order)?.message).toBe("c");
        expect(nextIssue(issues, { rowIndex: 2, colId: "col0" }, order)?.message).toBe("a");
        expect(nextIssue(issues, { rowIndex: 0, colId: "col0" }, order, -1)?.message).toBe("c");
        expect(nextIssue(issues, { rowIndex: 1, colId: "col0" }, order, -1)?.message).toBe("b");
    });

    it("keys issue lists and finds rows whose issues changed", () => {
        const a: CellIssue[] = [
            { rowId: "r1", colId: "col0", rowIndex: 0, message: "x" },
            { rowId: "r2", colId: "col0", rowIndex: 1, message: "y" }
        ];
        const b: CellIssue[] = [
            { rowId: "r2", colId: "col0", rowIndex: 0, message: "y" },
            { rowId: "r3", colId: "col1", rowIndex: 1, message: "z" }
        ];
        expect(issuesKey(a)).not.toBe(issuesKey(b));
        expect(changedIssueRows(a, b).sort()).toEqual(["r1", "r3"]);
        expect(changedIssueRows(a, a)).toEqual([]);
    });

    it("evaluates the validation expression while building rows", () => {
        const salary = fakeAttribute({ id: "salary", type: "Decimal", values: { e1: new Big(-5), e2: new Big(10) } });
        const column = fakeColumn({
            attribute: salary,
            validation: expression({ e1: "Salary cannot be negative", e2: "  " })
        } as any);
        expect(buildRow(item("e1"), [column]).cells.col0.error).toBe("Salary cannot be negative");
        expect(buildRow(item("e2"), [column]).cells.col0.error).toBeUndefined();
        expect(hasValidation([column])).toBe(true);
        expect(hasValidation([fakeColumn()])).toBe(false);
    });

    it("reports the errors of an object for held commits", () => {
        const name = fakeAttribute({ id: "name", type: "String", values: { e1: "", e2: "Ann" } });
        const columns = [
            fakeColumn({ attribute: name, validation: expression({ e1: "Name is required" }) } as any),
            fakeColumn({ columnType: "dynamicText" } as any)
        ];
        expect(objectErrors(item("e1"), columns)).toEqual(["Name is required"]);
        expect(objectErrors(item("e2"), columns)).toEqual([]);
    });

    it("formats the badge text", () => {
        expect(issuesText("Issues: [count]", 3)).toBe("Issues: 3");
        expect(issuesText("Problems", 2)).toBe("Problems 2");
    });
});
