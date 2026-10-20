import type { ObjectItem } from "mendix";

import type { ColumnsType } from "../../typings/AGGridProps";
import { CellData, GridRow, columnId, validationMessage } from "./rows";

/** One invalid cell, in display order. */
export interface CellIssue {
    rowId: string;
    colId: string;
    /** Index of the row among the displayed (filtered and sorted) rows. */
    rowIndex: number;
    message: string;
}

/** Error shown for a cell: the column Validation expression first, then Mendix validation feedback. */
export function cellError(cell: CellData | undefined): string | undefined {
    if (!cell) {
        return undefined;
    }
    return cell.error || cell.validation || undefined;
}

/**
 * Collects the invalid cells of the displayed rows, row by row and within a row in column order.
 * Totals and detail rows never count.
 */
export function collectIssues(
    rows: Array<{ row: GridRow | undefined; rowIndex: number }>,
    colIds: string[]
): CellIssue[] {
    const issues: CellIssue[] = [];
    rows.forEach(({ row, rowIndex }) => {
        if (!row || row.totals || row.detail) {
            return;
        }
        colIds.forEach(colId => {
            const message = cellError(row.cells[colId]);
            if (message) {
                issues.push({ rowId: row.id, colId, rowIndex, message });
            }
        });
    });
    return issues;
}

/** Stable key of an issue list, so state only changes when the issues really change. */
export function issuesKey(issues: CellIssue[]): string {
    return issues.map(issue => `${issue.rowId}|${issue.colId}|${issue.message}`).join("\n");
}

/**
 * The issue after (direction 1) or before (direction -1) the given cell, wrapping around.
 * `colOrder` is the display order of the columns, used to compare cells within one row.
 */
export function nextIssue(
    issues: CellIssue[],
    current: { rowIndex: number; colId: string } | undefined,
    colOrder: string[],
    direction: 1 | -1 = 1
): CellIssue | undefined {
    if (issues.length === 0) {
        return undefined;
    }
    const position = (rowIndex: number, colId: string): number => {
        const col = colOrder.indexOf(colId);
        return rowIndex * (colOrder.length + 1) + (col < 0 ? colOrder.length : col);
    };
    const sorted = [...issues].sort((a, b) => position(a.rowIndex, a.colId) - position(b.rowIndex, b.colId));
    if (!current) {
        return direction === 1 ? sorted[0] : sorted[sorted.length - 1];
    }
    const here = position(current.rowIndex, current.colId);
    if (direction === 1) {
        return sorted.find(issue => position(issue.rowIndex, issue.colId) > here) ?? sorted[0];
    }
    for (let index = sorted.length - 1; index >= 0; index--) {
        if (position(sorted[index].rowIndex, sorted[index].colId) < here) {
            return sorted[index];
        }
    }
    return sorted[sorted.length - 1];
}

/**
 * Current validation messages of an object: every column Validation expression plus Mendix validation
 * feedback on the attribute columns. Used to decide whether a held commit may run.
 */
export function objectErrors(item: ObjectItem, columns: ColumnsType[]): string[] {
    const errors: string[] = [];
    columns.forEach(column => {
        const message = validationMessage(column, item);
        if (message) {
            errors.push(message);
        }
        if (column.columnType === "attribute" && column.attribute) {
            try {
                const feedback = column.attribute.get(item).validation;
                if (feedback) {
                    errors.push(feedback);
                }
            } catch {
                // An attribute that cannot be read has no validation feedback.
            }
        }
    });
    return errors;
}

/** True when at least one column has a Validation expression. */
export function hasValidation(columns: ColumnsType[]): boolean {
    return columns.some(column => Boolean(column.validation));
}

/** Column ids of the data columns, in configuration order. */
export function dataColumnIds(columns: ColumnsType[]): string[] {
    return columns.map((_, index) => columnId(index));
}

/** Badge text from the template; [count] is replaced. */
export function issuesText(template: string, count: number): string {
    return template.includes("[count]") ? template.replace("[count]", String(count)) : `${template} ${count}`;
}

/** Rows whose set of issues differs between two issue lists; their cells need a forced refresh. */
export function changedIssueRows(previous: CellIssue[], next: CellIssue[]): string[] {
    const byRow = (list: CellIssue[]): Map<string, string> => {
        const map = new Map<string, string>();
        list.forEach(issue => map.set(issue.rowId, `${map.get(issue.rowId) ?? ""}${issue.colId}:${issue.message};`));
        return map;
    };
    const before = byRow(previous);
    const after = byRow(next);
    const ids = new Set<string>();
    before.forEach((value, id) => after.get(id) !== value && ids.add(id));
    after.forEach((value, id) => before.get(id) !== value && ids.add(id));
    return Array.from(ids);
}
