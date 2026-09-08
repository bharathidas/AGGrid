import { GridApi } from "ag-grid-community";
import { ObjectItem } from "mendix";

import { ColumnsType } from "../../typings/AGGridProps";
import { CellData, CellKind, GridRow, TOTALS_ROW_ID, cellKind, columnId, formatValue, toGridValue } from "./rows";

function toNumber(value: unknown): number | undefined {
    if (typeof value === "number") {
        return Number.isFinite(value) ? value : undefined;
    }
    if (value instanceof Date) {
        return value.getTime();
    }
    return undefined;
}

/** Aggregates the given rows into a pinned totals row. */
export function computeTotalsFromRows(rows: GridRow[], columns: ColumnsType[], label: string): GridRow {
    const cells: Record<string, CellData> = {};
    columns.forEach((column, index) => {
        const id = columnId(index);
        const kind = cellKind(column);
        const empty: CellData = { value: undefined, display: "", readOnly: true };
        if (column.aggregate === "none") {
            cells[id] = empty;
            return;
        }

        const values = rows.map(row => row.cells[id]?.value).filter(value => value !== undefined && value !== "");
        if (column.aggregate === "count") {
            cells[id] = { value: values.length, display: String(values.length), readOnly: true };
            return;
        }

        const numbers = values.map(toNumber).filter((value): value is number => value !== undefined);
        if (numbers.length === 0) {
            cells[id] = empty;
            return;
        }
        let result: number;
        switch (column.aggregate) {
            case "sum":
                result = numbers.reduce((total, value) => total + value, 0);
                break;
            case "avg":
                result = numbers.reduce((total, value) => total + value, 0) / numbers.length;
                break;
            case "min":
                result = Math.min(...numbers);
                break;
            default:
                result = Math.max(...numbers);
                break;
        }
        // Sum floats through toFixed to drop binary noise such as 103503.20000000001.
        const value: unknown = kind === "date" ? new Date(result) : Number(result.toFixed(10));
        const numberFormat = { precision: column.decimalPrecision, groupDigits: column.groupDigits };
        cells[id] = { value, display: formatValue(column.attribute, kind, value, numberFormat), readOnly: true };
    });

    // The label goes in the first column unless that column shows a total of its own.
    const firstId = columnId(0);
    if (columns.length > 0 && !cells[firstId]?.display) {
        cells[firstId] = { value: label, display: label, readOnly: true };
    }

    return { id: TOTALS_ROW_ID, totals: true, cells };
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
