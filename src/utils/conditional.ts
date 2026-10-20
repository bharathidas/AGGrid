import type { ColumnsType, ConditionalFormatEnum } from "../../typings/AGGridProps";
import { GridRow, cellKind, columnId } from "./rows";

/**
 * Spreadsheet-style conditional formatting of number columns: data bars, a three-color scale and an
 * up/flat/down icon set, scaled between the lowest and highest loaded value of the column.
 */

export interface ColumnRange {
    min: number;
    max: number;
}

export type TrendIcon = "up" | "flat" | "down";

/** Excel's default three-color scale: red (low), yellow, green (high). */
const LOW: [number, number, number] = [248, 105, 107];
const MID: [number, number, number] = [255, 235, 132];
const HIGH: [number, number, number] = [99, 190, 123];

export function hasConditionalFormat(column: ColumnsType): boolean {
    const format = column.conditionalFormat ?? "none";
    return format !== "none" && cellKind(column) === "number";
}

/** Lowest and highest value per formatted column over the given rows (data rows only). */
export function columnRanges(rows: GridRow[], columns: ColumnsType[]): Map<string, ColumnRange> {
    const ranges = new Map<string, ColumnRange>();
    columns.forEach((column, index) => {
        if (!hasConditionalFormat(column)) {
            return;
        }
        const id = columnId(index);
        let min = Infinity;
        let max = -Infinity;
        rows.forEach(row => {
            if (row.totals || row.detail || row.group) {
                return;
            }
            const value = row.cells[id]?.value;
            if (typeof value === "number" && Number.isFinite(value)) {
                min = Math.min(min, value);
                max = Math.max(max, value);
            }
        });
        if (min <= max) {
            ranges.set(id, { min, max });
        }
    });
    return ranges;
}

export function rangesKey(ranges: Map<string, ColumnRange>): string {
    return JSON.stringify(Array.from(ranges.entries()));
}

/** Position of a value between min (0) and max (1); 0.5 when all values are equal. */
export function ratio(value: unknown, range: ColumnRange | undefined): number | undefined {
    if (typeof value !== "number" || !Number.isFinite(value) || !range) {
        return undefined;
    }
    if (range.max === range.min) {
        return 0.5;
    }
    return Math.max(0, Math.min(1, (value - range.min) / (range.max - range.min)));
}

function mix(a: [number, number, number], b: [number, number, number], t: number): string {
    const channel = (index: number): number => Math.round(a[index] + (b[index] - a[index]) * t);
    return `rgb(${channel(0)}, ${channel(1)}, ${channel(2)})`;
}

/** Color of the three-color scale at position t (0..1); reversed when lower values are better. */
export function scaleColor(t: number, reverse = false): string {
    const position = reverse ? 1 - t : t;
    return position < 0.5 ? mix(LOW, MID, position * 2) : mix(MID, HIGH, (position - 0.5) * 2);
}

/** Icon of the three-icon set: top third up, middle flat, bottom third down (mirrored when reversed). */
export function trendIcon(t: number, reverse = false): TrendIcon {
    const position = reverse ? 1 - t : t;
    return position >= 2 / 3 ? "up" : position <= 1 / 3 ? "down" : "flat";
}

export interface FormatStyle {
    style?: Record<string, string>;
    className?: string;
}

/**
 * Inline style or class for one cell. Data bars start at zero when the range spans zero, so negative
 * values grow to the left of the axis like in a spreadsheet.
 */
export function formatCell(
    format: ConditionalFormatEnum,
    value: unknown,
    range: ColumnRange | undefined,
    color: string,
    reverse: boolean
): FormatStyle {
    const t = ratio(value, range);
    if (t === undefined || !range) {
        return {};
    }
    switch (format) {
        case "dataBar": {
            const bar = color.trim() || "var(--mxt-ag-accent, #264ae5)";
            const span = Math.max(range.max, 0) - Math.min(range.min, 0) || 1;
            const zero = (-Math.min(range.min, 0) / span) * 100;
            const point = (((value as number) - Math.min(range.min, 0)) / span) * 100;
            const from = Math.min(zero, point);
            const to = Math.max(zero, point);
            const fill = `color-mix(in srgb, ${bar} 30%, transparent)`;
            return {
                className: "mxt-ag-cf-bar",
                style: {
                    backgroundImage: `linear-gradient(to right, transparent ${from.toFixed(2)}%, ${fill} ${from.toFixed(
                        2
                    )}%, ${fill} ${to.toFixed(2)}%, transparent ${to.toFixed(2)}%)`
                }
            };
        }
        case "colorScale":
            return {
                className: "mxt-ag-cf-scale",
                style: { backgroundColor: `color-mix(in srgb, ${scaleColor(t, reverse)} 55%, transparent)` }
            };
        case "iconSet":
            return { className: `mxt-ag-cf-icon mxt-ag-cf-icon--${trendIcon(t, reverse)}` };
        default:
            return {};
    }
}
