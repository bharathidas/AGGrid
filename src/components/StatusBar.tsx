import { ReactElement, useEffect, useRef, useState } from "react";

import { StatusSummary, countUpValue, statusRowsText } from "../utils/statusBar";

const COUNT_UP_MS = 450;

/** A whole number that counts up (or down) to its new value when motion is on. */
export function CountUp(props: { value: number; animate: boolean; format: (value: number) => string }): ReactElement {
    const { value, animate, format } = props;
    const [shown, setShown] = useState(value);
    const fromRef = useRef(value);
    useEffect(() => {
        const from = fromRef.current;
        fromRef.current = value;
        if (!animate || from === value || typeof window.requestAnimationFrame !== "function") {
            return;
        }
        const start = performance.now();
        let frame = 0;
        const step = (now: number): void => {
            const p = (now - start) / COUNT_UP_MS;
            setShown(countUpValue(from, value, p));
            if (p < 1) {
                frame = window.requestAnimationFrame(step);
            }
        };
        frame = window.requestAnimationFrame(step);
        return () => window.cancelAnimationFrame(frame);
    }, [value, animate]);
    return <span className="mxt-ag-countup">{format(animate ? shown : value)}</span>;
}

export interface StatusBarProps {
    summary: StatusSummary;
    rowsTemplate: string;
    selectedTemplate: string;
    animate: boolean;
    formatNumber: (value: number) => string;
    /** Count, sum and average of the selected cell range. */
    range?: Array<{ label: string; value: string }>;
}

/** Status bar under the grid: shown/total/selected rows and the aggregates of the selection. */
export function StatusBar(props: StatusBarProps): ReactElement {
    const { summary, animate, formatNumber } = props;
    const [before, after] = statusRowsText(props.rowsTemplate, { shown: -1, total: -2 }).split("-1");
    const [middle, end] = (after ?? "").split("-2");
    const [selBefore, selAfter] = props.selectedTemplate.split("[count]");
    return (
        <div className="mxt-ag-status" role="status" aria-live="polite" aria-atomic="false">
            <span className="mxt-ag-status__rows">
                {before}
                <CountUp value={summary.shown} animate={animate} format={formatNumber} />
                {middle}
                <CountUp value={summary.total} animate={animate} format={formatNumber} />
                {end}
            </span>
            {summary.selected > 0 && (
                <span className="mxt-ag-status__selected">
                    {selBefore}
                    <CountUp value={summary.selected} animate={animate} format={formatNumber} />
                    {selAfter}
                </span>
            )}
            {summary.aggregates.length > 0 && (
                <span className="mxt-ag-status__aggs">
                    {summary.aggregates.map(aggregate => (
                        <span
                            key={`${aggregate.colId}:${aggregate.display}`}
                            className="mxt-ag-status__agg"
                            data-col={aggregate.colId}
                        >
                            <span className="mxt-ag-status__kind">
                                {aggregate.kind} {aggregate.caption}
                            </span>
                            <strong className="mxt-ag-status__value">{aggregate.display}</strong>
                        </span>
                    ))}
                </span>
            )}
            {props.range && props.range.length > 0 && (
                <span className="mxt-ag-status__range">
                    {props.range.map(entry => (
                        <span key={entry.label} className="mxt-ag-status__agg">
                            <span className="mxt-ag-status__kind">{entry.label}</span>
                            <strong className="mxt-ag-status__value">{entry.value}</strong>
                        </span>
                    ))}
                </span>
            )}
        </div>
    );
}
