import type { ColumnsType } from "../../typings/AGGridProps";
import { GridRow, columnId } from "./rows";
import { computeTotalsFromRows } from "./totals";

/** Status bar under the grid: row counts and the column aggregates of the selected (or all shown) rows. */

export interface StatusAggregate {
    colId: string;
    /** e.g. "Sum", "Avg". */
    kind: string;
    caption: string;
    display: string;
}

export interface StatusSummary {
    shown: number;
    total: number;
    selected: number;
    /** True when the aggregates cover the selected rows, false when they cover all shown rows. */
    ofSelection: boolean;
    aggregates: StatusAggregate[];
}

const KIND_LABELS: Record<string, string> = {
    sum: "Sum",
    avg: "Avg",
    min: "Min",
    max: "Max",
    count: "Count",
    distinctCount: "Distinct"
};

export function statusSummary(
    shownRows: GridRow[],
    selectedRows: GridRow[],
    total: number,
    columns: ColumnsType[],
    captionOf: (colId: string) => string,
    visible: (colId: string) => boolean = () => true
): StatusSummary {
    const ofSelection = selectedRows.length > 0;
    const basis = ofSelection ? selectedRows : shownRows;
    const totals = computeTotalsFromRows(basis, columns, "").cells;
    const aggregates: StatusAggregate[] = [];
    columns.forEach((column, index) => {
        const id = columnId(index);
        if (column.aggregate === "none" || !visible(id)) {
            return;
        }
        const display = totals[id]?.display ?? "";
        if (!display) {
            return;
        }
        aggregates.push({
            colId: id,
            kind: KIND_LABELS[column.aggregate] ?? column.aggregate,
            caption: captionOf(id),
            display
        });
    });
    return { shown: shownRows.length, total, selected: selectedRows.length, ofSelection, aggregates };
}

export function statusRowsText(template: string, summary: Pick<StatusSummary, "shown" | "total">): string {
    return template.replace(/\[shown\]/g, String(summary.shown)).replace(/\[total\]/g, String(summary.total));
}

export function summaryKey(summary: StatusSummary): string {
    return JSON.stringify(summary);
}

/** Integer between `from` and `to` at animation progress p (0..1) with an ease-out curve. */
export function countUpValue(from: number, to: number, p: number): number {
    const t = Math.max(0, Math.min(1, p));
    const eased = 1 - Math.pow(1 - t, 3);
    return Math.round(from + (to - from) * eased);
}
