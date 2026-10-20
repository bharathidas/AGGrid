import { KeyboardEvent, ReactElement, useEffect, useId, useRef, useState } from "react";
import classNames from "classnames";

import {
    CHART_COLORS_DARK,
    CHART_COLORS_LIGHT,
    ChartData,
    ChartType,
    MAX_CHART_SERIES,
    niceScale,
    pieSlices,
    valueExtent
} from "../utils/chart";
import type { UiTexts } from "../utils/texts";
import { ClearIcon } from "./Icons";

export interface RangeChartProps {
    title: string;
    data: ChartData;
    texts: UiTexts;
    dark: boolean;
    animate: boolean;
    formatNumber: (value: number) => string;
    onClose: () => void;
}

const WIDTH = 640;
const HEIGHT = 320;
const PAD = { top: 16, right: 16, bottom: 56, left: 56 };

/** Dialog with a bar, line or pie chart of the selected range, drawn as plain SVG with a data table. */
export function RangeChart(props: RangeChartProps): ReactElement {
    const { data, texts, formatNumber } = props;
    const [type, setType] = useState<ChartType>("bar");
    const [showTable, setShowTable] = useState(false);
    const titleId = useId();
    const dialogRef = useRef<HTMLDivElement>(null);
    const previousFocus = useRef<Element | null>(null);
    const colors = props.dark ? CHART_COLORS_DARK : CHART_COLORS_LIGHT;
    const series = data.series.slice(0, MAX_CHART_SERIES);
    const { onClose } = props;

    useEffect(() => {
        previousFocus.current = document.activeElement;
        dialogRef.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
        return () => {
            (previousFocus.current as HTMLElement | null)?.focus?.();
        };
    }, []);

    const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
        if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            onClose();
            return;
        }
        if (event.key === "Tab") {
            // Keep the focus inside the dialog.
            const focusable = Array.from(
                dialogRef.current?.querySelectorAll<HTMLElement>("button, select, [tabindex='0']") ?? []
            ).filter(element => !element.hasAttribute("disabled"));
            if (focusable.length === 0) {
                return;
            }
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        }
    };

    const types: Array<{ type: ChartType; label: string }> = [
        { type: "bar", label: texts.bar },
        { type: "line", label: texts.line },
        { type: "pie", label: texts.pie }
    ];
    const summary = `${props.title}: ${series.map(entry => entry.name).join(", ")} (${data.categories.length})`;

    return (
        <div className="mxt-ag-chart-backdrop" onMouseDown={event => event.target === event.currentTarget && onClose()}>
            <div
                ref={dialogRef}
                className={classNames("mxt-ag-chart", { "mxt-ag-chart--animate": props.animate })}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                onKeyDown={handleKeyDown}
            >
                <div className="mxt-ag-chart__head">
                    <h3 className="mxt-ag-chart__title" id={titleId}>
                        {props.title}
                    </h3>
                    <div className="mxt-ag-chart__types" role="radiogroup" aria-label={props.title}>
                        {types.map(entry => (
                            <button
                                key={entry.type}
                                type="button"
                                role="radio"
                                aria-checked={type === entry.type}
                                className={classNames("btn btn-default btn-sm", { "is-active": type === entry.type })}
                                onClick={() => setType(entry.type)}
                            >
                                {entry.label}
                            </button>
                        ))}
                    </div>
                    <button
                        type="button"
                        className="mxt-ag-icon-btn"
                        aria-label={texts.close}
                        title={texts.close}
                        onClick={onClose}
                        data-autofocus
                    >
                        <ClearIcon />
                    </button>
                </div>
                <svg
                    className="mxt-ag-chart__svg"
                    viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
                    role="img"
                    aria-label={summary}
                    preserveAspectRatio="xMidYMid meet"
                >
                    {type === "pie" ? (
                        <PieMarks data={data} colors={colors} texts={texts} formatNumber={formatNumber} />
                    ) : (
                        <CartesianMarks
                            data={{ ...data, series }}
                            type={type}
                            colors={colors}
                            formatNumber={formatNumber}
                        />
                    )}
                </svg>
                {(type === "pie" || series.length > 1) && (
                    <ul className="mxt-ag-chart__legend" aria-hidden="true">
                        {(type === "pie"
                            ? pieSlices(data, 0, 0, 1, texts.other).map(slice => slice.label)
                            : series.map(entry => entry.name)
                        ).map((label, index) => (
                            <li key={`${label}-${index}`}>
                                <span
                                    className="mxt-ag-chart__swatch"
                                    style={{ background: colors[index % colors.length] }}
                                />
                                {label}
                            </li>
                        ))}
                    </ul>
                )}
                <button
                    type="button"
                    className="btn btn-link btn-sm mxt-ag-chart__table-toggle"
                    aria-expanded={showTable}
                    onClick={() => setShowTable(!showTable)}
                >
                    {texts.dataTable}
                </button>
                <table className={showTable ? "mxt-ag-chart__table" : "mxt-ag-sr-only"}>
                    <caption className="mxt-ag-sr-only">{props.title}</caption>
                    <thead>
                        <tr>
                            <th scope="col" />
                            {data.series.map(entry => (
                                <th key={entry.name} scope="col">
                                    {entry.name}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {data.categories.map((category, row) => (
                            <tr key={`${category}-${row}`}>
                                <th scope="row">{category}</th>
                                {data.series.map(entry => (
                                    <td key={entry.name}>
                                        {entry.values[row] === undefined
                                            ? ""
                                            : formatNumber(entry.values[row] as number)}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function CartesianMarks(props: {
    data: ChartData;
    type: "bar" | "line";
    colors: string[];
    formatNumber: (value: number) => string;
}): ReactElement {
    const { data, type, colors, formatNumber } = props;
    const [min, max] = valueExtent(data);
    const scale = niceScale(min, max);
    const plotWidth = WIDTH - PAD.left - PAD.right;
    const plotHeight = HEIGHT - PAD.top - PAD.bottom;
    const y = (value: number): number =>
        PAD.top + plotHeight - ((value - scale.min) / (scale.max - scale.min)) * plotHeight;
    const count = Math.max(1, data.categories.length);
    const band = plotWidth / count;
    const seriesCount = Math.max(1, data.series.length);
    const gap = 2;
    const barWidth = Math.max(2, Math.min(48, (band * 0.7) / seriesCount - gap));
    const groupWidth = seriesCount * (barWidth + gap) - gap;
    const labelEvery = Math.ceil(count / 12);
    const zero = y(0);
    return (
        <g>
            {scale.ticks.map(tick => (
                <g key={tick} className="mxt-ag-chart__grid">
                    <line x1={PAD.left} x2={WIDTH - PAD.right} y1={y(tick)} y2={y(tick)} />
                    <text x={PAD.left - 8} y={y(tick)} dy="0.32em" textAnchor="end" className="mxt-ag-chart__tick">
                        {formatNumber(tick)}
                    </text>
                </g>
            ))}
            <line className="mxt-ag-chart__axis" x1={PAD.left} x2={WIDTH - PAD.right} y1={zero} y2={zero} />
            {data.categories.map((category, index) =>
                index % labelEvery === 0 ? (
                    <text
                        key={`${category}-${index}`}
                        className="mxt-ag-chart__tick"
                        x={PAD.left + band * index + band / 2}
                        y={HEIGHT - PAD.bottom + 18}
                        textAnchor="middle"
                    >
                        {category.length > 14 ? `${category.slice(0, 13)}…` : category}
                    </text>
                ) : null
            )}
            {type === "bar"
                ? data.series.map((entry, s) =>
                      entry.values.map((value, index) => {
                          if (value === undefined) {
                              return null;
                          }
                          const x = PAD.left + band * index + (band - groupWidth) / 2 + s * (barWidth + gap);
                          const top = Math.min(y(value), zero);
                          const height = Math.max(1, Math.abs(y(value) - zero));
                          return (
                              <rect
                                  key={`${s}-${index}`}
                                  className="mxt-ag-chart__bar"
                                  x={x}
                                  y={top}
                                  width={barWidth}
                                  height={height}
                                  rx={Math.min(4, barWidth / 2)}
                                  fill={props.colors[s % colors.length]}
                              >
                                  <title>{`${data.categories[index]} · ${entry.name}: ${formatNumber(value)}`}</title>
                              </rect>
                          );
                      })
                  )
                : data.series.map((entry, s) => {
                      const points = entry.values
                          .map((value, index) =>
                              value === undefined ? undefined : `${PAD.left + band * index + band / 2},${y(value)}`
                          )
                          .filter((point): point is string => Boolean(point));
                      return (
                          <g key={s}>
                              <polyline
                                  className="mxt-ag-chart__line"
                                  points={points.join(" ")}
                                  fill="none"
                                  stroke={colors[s % colors.length]}
                                  strokeWidth={2}
                              />
                              {entry.values.map((value, index) =>
                                  value === undefined ? null : (
                                      <circle
                                          key={index}
                                          cx={PAD.left + band * index + band / 2}
                                          cy={y(value)}
                                          r={4}
                                          fill={colors[s % colors.length]}
                                          className="mxt-ag-chart__dot"
                                      >
                                          <title>{`${data.categories[index]} · ${entry.name}: ${formatNumber(
                                              value
                                          )}`}</title>
                                      </circle>
                                  )
                              )}
                          </g>
                      );
                  })}
        </g>
    );
}

function PieMarks(props: {
    data: ChartData;
    colors: string[];
    texts: UiTexts;
    formatNumber: (value: number) => string;
}): ReactElement {
    const slices = pieSlices(
        props.data,
        WIDTH / 2,
        HEIGHT / 2 - 8,
        Math.min(WIDTH, HEIGHT) / 2 - 28,
        props.texts.other
    );
    return (
        <g>
            {slices.map((slice, index) => (
                <path
                    key={`${slice.label}-${index}`}
                    className="mxt-ag-chart__slice"
                    d={slice.path}
                    fill={props.colors[index % props.colors.length]}
                >
                    <title>{`${slice.label}: ${props.formatNumber(slice.value)} (${Math.round(
                        slice.share * 100
                    )}%)`}</title>
                </path>
            ))}
        </g>
    );
}
