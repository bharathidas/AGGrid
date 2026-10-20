import type { NormalizedRange } from "./range";

/** Data and geometry of the built-in range chart (plain SVG, no chart library). */

export type ChartType = "bar" | "line" | "pie";

export interface ChartSeries {
    name: string;
    values: Array<number | undefined>;
}

export interface ChartData {
    categories: string[];
    series: ChartSeries[];
}

export interface ChartCell {
    value: unknown;
    display: string;
}

/**
 * Turns a range into chart data: when the first column of the range holds no numbers it gives the category
 * labels, every column with numbers becomes a series. Rows that are not data rows are skipped.
 */
export function chartDataFromRange(
    range: NormalizedRange,
    cellAt: (rowIndex: number, colId: string) => ChartCell | undefined,
    captionOf: (colId: string) => string
): ChartData {
    const rowIndexes: number[] = [];
    for (let row = range.top; row <= range.bottom; row++) {
        if (range.colIds.some(colId => cellAt(row, colId) !== undefined)) {
            rowIndexes.push(row);
        }
    }
    const isNumeric = (colId: string): boolean => rowIndexes.some(row => typeof cellAt(row, colId)?.value === "number");
    const [first, ...rest] = range.colIds;
    const labelColumn = first !== undefined && !isNumeric(first) ? first : undefined;
    const valueColumns = (labelColumn ? rest : range.colIds).filter(isNumeric);
    const categories = rowIndexes.map((row, index) =>
        labelColumn ? cellAt(row, labelColumn)?.display || `${index + 1}` : `${index + 1}`
    );
    const series = valueColumns.map(colId => ({
        name: captionOf(colId),
        values: rowIndexes.map(row => {
            const value = cellAt(row, colId)?.value;
            return typeof value === "number" && Number.isFinite(value) ? value : undefined;
        })
    }));
    return { categories, series };
}

export function hasChartData(data: ChartData): boolean {
    return data.series.some(series => series.values.some(value => value !== undefined));
}

export interface Scale {
    min: number;
    max: number;
    ticks: number[];
}

/** A "nice" axis from min to max with round tick steps; zero is always included. */
export function niceScale(minValue: number, maxValue: number, tickCount = 5): Scale {
    let min = Math.min(0, minValue);
    let max = Math.max(0, maxValue);
    if (min === max) {
        max = min + 1;
    }
    const rough = (max - min) / Math.max(1, tickCount);
    const magnitude = Math.pow(10, Math.floor(Math.log10(rough)));
    const residual = rough / magnitude;
    const step = (residual > 5 ? 10 : residual > 2 ? 5 : residual > 1 ? 2 : 1) * magnitude;
    min = Math.floor(min / step) * step;
    max = Math.ceil(max / step) * step;
    const ticks: number[] = [];
    for (let tick = min; tick <= max + step / 2; tick += step) {
        ticks.push(Number(tick.toFixed(10)));
    }
    return { min, max, ticks };
}

export function valueExtent(data: ChartData): [number, number] {
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    data.series.forEach(series =>
        series.values.forEach(value => {
            if (value !== undefined) {
                min = Math.min(min, value);
                max = Math.max(max, value);
            }
        })
    );
    return Number.isFinite(min) ? [min, max] : [0, 1];
}

export interface PieSlice {
    label: string;
    value: number;
    share: number;
    path: string;
}

/** Pie slices of the first series (negative and empty values are left out). */
export function pieSlices(data: ChartData, cx: number, cy: number, radius: number, otherLabel = "Other"): PieSlice[] {
    const series = data.series[0];
    if (!series) {
        return [];
    }
    let entries = series.values
        .map((value, index) => ({ label: data.categories[index] ?? "", value: value ?? 0 }))
        .filter(entry => entry.value > 0);
    if (entries.length > MAX_CHART_SERIES) {
        // Never more slices than colors: the smallest ones fold into one "Other" slice.
        const sorted = [...entries].sort((a, b) => b.value - a.value);
        const keep = new Set(sorted.slice(0, MAX_CHART_SERIES - 1));
        const other = sorted.slice(MAX_CHART_SERIES - 1).reduce((sum, entry) => sum + entry.value, 0);
        entries = [...entries.filter(entry => keep.has(entry)), { label: otherLabel, value: other }];
    }
    const total = entries.reduce((sum, entry) => sum + entry.value, 0);
    if (total <= 0) {
        return [];
    }
    let angle = -Math.PI / 2;
    return entries.map(entry => {
        const share = entry.value / total;
        const start = angle;
        const end = angle + share * Math.PI * 2;
        angle = end;
        const point = (a: number): string =>
            `${(cx + radius * Math.cos(a)).toFixed(2)} ${(cy + radius * Math.sin(a)).toFixed(2)}`;
        const path =
            share >= 0.9999
                ? `M ${cx - radius} ${cy} a ${radius} ${radius} 0 1 0 ${radius * 2} 0 a ${radius} ${radius} 0 1 0 ${
                      -radius * 2
                  } 0 Z`
                : `M ${cx} ${cy} L ${point(start)} A ${radius} ${radius} 0 ${share > 0.5 ? 1 : 0} 1 ${point(end)} Z`;
        return { label: entry.label, value: entry.value, share, path };
    });
}

/** Categorical colors in fixed order (validated for colour-vision deficiency on the light and dark surface). */
export const CHART_COLORS_LIGHT = [
    "#2a78d6",
    "#eb6834",
    "#1baf7a",
    "#eda100",
    "#e87ba4",
    "#008300",
    "#6250d6",
    "#e34948"
];
export const CHART_COLORS_DARK = [
    "#3987e5",
    "#d95926",
    "#199e70",
    "#c98500",
    "#d55181",
    "#008300",
    "#9085e9",
    "#e66767"
];
/** At most this many series are drawn; the rest stay in the data table. */
export const MAX_CHART_SERIES = 8;
