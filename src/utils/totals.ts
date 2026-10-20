import { GridApi } from "ag-grid-community";
import { ObjectItem } from "mendix";

import { ColumnsType } from "../../typings/AGGridProps";
import { CellData, CellKind, GridRow, TOTALS_ROW_ID, cellKind, columnId, formatValue, toGridValue } from "./rows";

/** Aggregation functions of totals rows, group rows, tree parents, pivot values and the status bar. */
export type AggregateFn = "sum" | "avg" | "min" | "max" | "count" | "distinctCount";
/** An aggregation or "none" (no value). */
export type AggregateChoice = AggregateFn | "none";

export const AGGREGATE_FNS: AggregateFn[] = ["sum", "avg", "min", "max", "count", "distinctCount"];

export function isAggregateChoice(value: unknown): value is AggregateChoice {
    return value === "none" || AGGREGATE_FNS.includes(value as AggregateFn);
}

/** Per-column aggregation chosen by the user in a totals row; overrides the column's configured value. */
export type TotalsOverrides = Record<string, AggregateChoice>;

const EMPTY_TOTALS_ROW_ID_TOP = "__mxt_totals_top__";
export const TOTALS_TOP_ROW_ID = EMPTY_TOTALS_ROW_ID_TOP;

function toNumber(value: unknown): number | undefined {
    if (typeof value === "number") {
        return Number.isFinite(value) ? value : undefined;
    }
    if (value instanceof Date) {
        return value.getTime();
    }
    return undefined;
}

function distinctKey(value: unknown): string {
    if (value instanceof Date) {
        return `d${value.getTime()}`;
    }
    return `${typeof value}:${String(value)}`;
}

/** Whether a value counts as empty for aggregations (undefined, null, empty text). */
export function isBlankValue(value: unknown): boolean {
    return value === undefined || value === null || value === "";
}

/**
 * Aggregates raw cell values. Count and distinct count accept every value; the other functions only numbers
 * (and dates for min/max/avg, which yield a timestamp). Returns undefined when nothing can be aggregated.
 */
export function aggregateValues(values: unknown[], fn: AggregateFn): number | undefined {
    const present = values.filter(value => !isBlankValue(value));
    if (fn === "count") {
        return present.length;
    }
    if (fn === "distinctCount") {
        return new Set(present.map(distinctKey)).size;
    }
    let count = 0;
    let sum = 0;
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    for (const value of present) {
        const numeric = toNumber(value);
        if (numeric === undefined) {
            continue;
        }
        count++;
        sum += numeric;
        if (numeric < min) {
            min = numeric;
        }
        if (numeric > max) {
            max = numeric;
        }
    }
    if (count === 0) {
        return undefined;
    }
    switch (fn) {
        case "sum":
            return sum;
        case "avg":
            return sum / count;
        case "min":
            return min;
        default:
            return max;
    }
}

/** Rounds away binary noise (103503.20000000001); averages without a precision get two decimals. */
export function roundAggregate(result: number, fn: AggregateFn, precision: number): number {
    const digits = fn === "avg" && precision < 0 ? 2 : 10;
    return Number(result.toFixed(digits));
}

/** Formatted aggregate cell of a column, or an empty cell when nothing can be aggregated. */
export function aggregateCell(rows: GridRow[], column: ColumnsType, id: string, fn: AggregateChoice): CellData {
    const empty: CellData = { value: undefined, display: "", readOnly: true };
    if (fn === "none") {
        return empty;
    }
    const kind = cellKind(column);
    const values = rows.map(row => row.cells[id]?.value);
    const result = aggregateValues(values, fn);
    if (result === undefined) {
        return empty;
    }
    if (fn === "count" || fn === "distinctCount") {
        return { value: result, display: String(result), readOnly: true };
    }
    const numberFormat = { precision: column.decimalPrecision, groupDigits: column.groupDigits };
    const value: unknown = kind === "date" ? new Date(result) : roundAggregate(result, fn, column.decimalPrecision);
    return { value, display: formatValue(column.attribute, kind, value, numberFormat), readOnly: true };
}

/** The function a column shows in a totals row: the user's choice, else the configured value. */
export function totalsFunctionFor(
    column: ColumnsType,
    id: string,
    overrides: TotalsOverrides | undefined,
    position: "top" | "bottom" = "bottom"
): AggregateChoice {
    const chosen = overrides?.[id];
    if (chosen && isAggregateChoice(chosen)) {
        return chosen;
    }
    if (position === "top" && column.aggregateTop && column.aggregateTop !== "same") {
        return column.aggregateTop as AggregateChoice;
    }
    return (column.aggregate ?? "none") as AggregateChoice;
}

/** Aggregates the given rows into a pinned totals row. */
export function computeTotalsFromRows(
    rows: GridRow[],
    columns: ColumnsType[],
    label: string,
    overrides?: TotalsOverrides,
    position: "top" | "bottom" = "bottom"
): GridRow {
    const cells: Record<string, CellData> = {};
    columns.forEach((column, index) => {
        const id = columnId(index);
        const fn = totalsFunctionFor(column, id, overrides, position);
        const cell = aggregateCell(rows, column, id, fn);
        if (fn !== "none") {
            cell.aggregate = fn;
        }
        cells[id] = cell;
    });

    // The label goes in the first column unless that column shows a total of its own.
    const firstId = columnId(0);
    if (columns.length > 0 && !cells[firstId]?.display) {
        cells[firstId] = { value: label, display: label, readOnly: true };
    }

    return { id: position === "top" ? TOTALS_TOP_ROW_ID : TOTALS_ROW_ID, totals: true, cells };
}

/** Totals row taken from an object of the totals data source (server-side aggregation). */
export function totalsFromItem(item: ObjectItem | undefined, columns: ColumnsType[], label: string): GridRow {
    const cells: Record<string, CellData> = {};
    columns.forEach((column, index) => {
        const id = columnId(index);
        const attribute = column.totalAttribute;
        if (!item || !attribute) {
            cells[id] = { value: undefined, display: "", readOnly: true };
            return;
        }
        const value = attribute.get(item);
        const numberFormat = { precision: column.decimalPrecision, groupDigits: column.groupDigits };
        const raw = toGridValue(value.value);
        const kind: CellKind = typeof raw === "number" ? "number" : raw instanceof Date ? "date" : "text";
        const display =
            kind === "number" && (numberFormat.precision >= 0 || numberFormat.groupDigits)
                ? formatValue(undefined, kind, raw, numberFormat)
                : value.displayValue;
        cells[id] = { value: raw, display, readOnly: true };
    });
    const firstId = columnId(0);
    if (columns.length > 0 && !cells[firstId]?.display) {
        cells[firstId] = { value: label, display: label, readOnly: true };
    }
    return { id: TOTALS_ROW_ID, totals: true, cells };
}

/** Aggregates the rows that pass the current filter (client-side row model) into a pinned totals row. */
export function computeTotals(api: GridApi<GridRow>, columns: ColumnsType[], label: string): GridRow {
    const rows: GridRow[] = [];
    api.forEachNodeAfterFilter(node => {
        if (node.data && !node.data.totals) {
            rows.push(node.data);
        }
    });
    return computeTotalsFromRows(rows, columns, label);
}
