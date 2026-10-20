/** Sparkline cells: a small trend line drawn from a list of numbers stored as text ("3,5,4,8,7"). */

export function parseSeries(text: unknown): number[] {
    if (typeof text !== "string" && typeof text !== "number") {
        return [];
    }
    return String(text)
        .split(/[;,\s|]+/)
        .map(part => part.trim())
        .filter(part => part !== "")
        .map(Number)
        .filter(value => Number.isFinite(value));
}

export interface SparklineGeometry {
    /** SVG polyline points in a width x height box. */
    points: string;
    /** Area under the line (closed polygon). */
    area: string;
    last: { x: number; y: number };
    min: number;
    max: number;
    first: number;
    lastValue: number;
    trend: "up" | "down" | "flat";
}

export function sparkline(values: number[], width: number, height: number, padding = 2): SparklineGeometry | undefined {
    if (values.length === 0) {
        return undefined;
    }
    const series = values.length === 1 ? [values[0], values[0]] : values;
    const min = Math.min(...series);
    const max = Math.max(...series);
    const span = max - min || 1;
    const step = (width - padding * 2) / (series.length - 1);
    const coords = series.map((value, index) => ({
        x: padding + index * step,
        y: max === min ? height / 2 : padding + (1 - (value - min) / span) * (height - padding * 2)
    }));
    const points = coords.map(point => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
    const lastPoint = coords[coords.length - 1];
    const first = series[0];
    const lastValue = series[series.length - 1];
    return {
        points,
        area: `${padding},${height - padding} ${points} ${lastPoint.x.toFixed(1)},${height - padding}`,
        last: lastPoint,
        min,
        max,
        first,
        lastValue,
        trend: lastValue > first ? "up" : lastValue < first ? "down" : "flat"
    };
}
