import { ReactElement } from "react";
import { ICellRendererParams } from "ag-grid-community";

import { GridRow } from "../utils/rows";
import { parseSeries, sparkline } from "../utils/sparkline";

function text(params: ICellRendererParams<GridRow>): string {
    return params.valueFormatted ?? (params.value === undefined || params.value === null ? "" : String(params.value));
}

/** Opens the cell value as a URL in a new tab. */
export function LinkCellRenderer(params: ICellRendererParams<GridRow>): ReactElement | null {
    const value = text(params);
    if (!value) {
        return null;
    }
    const href = /^(https?:|mailto:|tel:|\/)/i.test(value) ? value : `https://${value}`;
    return (
        <a className="mxt-ag-cell-link" href={href} target="_blank" rel="noopener noreferrer">
            {value}
        </a>
    );
}

/** Atlas badge; color it with a cell class such as badge-success or badge-warning. */
export function BadgeCellRenderer(params: ICellRendererParams<GridRow>): ReactElement | null {
    const value = text(params);
    return value ? <span className="badge mxt-ag-cell-badge">{value}</span> : null;
}

/** Bootstrap progress bar for a numeric value between 0 and 100. */
export function ProgressCellRenderer(params: ICellRendererParams<GridRow>): ReactElement | null {
    const numeric = typeof params.value === "number" ? params.value : Number(params.value);
    if (!Number.isFinite(numeric)) {
        return null;
    }
    const percent = Math.max(0, Math.min(100, numeric));
    return (
        <div className="progress mxt-ag-cell-progress" title={text(params)}>
            <div
                className="progress-bar"
                role="progressbar"
                aria-valuenow={percent}
                aria-valuemin={0}
                aria-valuemax={100}
                style={{ width: `${percent}%` }}
            >
                {text(params)}
            </div>
        </div>
    );
}

/** Shows the cell value as an image URL. */
export function ImageCellRenderer(params: ICellRendererParams<GridRow>): ReactElement | null {
    const value = text(params);
    return value ? <img className="mxt-ag-cell-image" src={value} alt="" /> : null;
}

const SPARK_WIDTH = 100;
const SPARK_HEIGHT = 24;

/** Small trend line from a text value with numbers ("3,5,4,8,7"); the last point is marked. */
export function SparklineCellRenderer(params: ICellRendererParams<GridRow>): ReactElement | null {
    const values = parseSeries(params.data?.cells[params.column?.getColId() ?? ""]?.display ?? params.value);
    const geometry = sparkline(values, SPARK_WIDTH, SPARK_HEIGHT);
    if (!geometry) {
        return null;
    }
    const label = `Trend ${geometry.trend}: from ${geometry.first} to ${geometry.lastValue}, low ${geometry.min}, high ${geometry.max}`;
    return (
        <svg
            className={`mxt-ag-spark mxt-ag-spark--${geometry.trend}`}
            viewBox={`0 0 ${SPARK_WIDTH} ${SPARK_HEIGHT}`}
            preserveAspectRatio="none"
            role="img"
            aria-label={label}
        >
            <title>{label}</title>
            <polygon className="mxt-ag-spark__area" points={geometry.area} />
            <polyline className="mxt-ag-spark__line" points={geometry.points} vectorEffect="non-scaling-stroke" />
            <circle className="mxt-ag-spark__dot" cx={geometry.last.x} cy={geometry.last.y} r="2.2" />
        </svg>
    );
}
