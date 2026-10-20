import { KeyboardEvent, ReactElement, useEffect, useRef, useState } from "react";
import classNames from "classnames";

import { MAX_GROUP_LEVELS } from "../utils/grouping";
import { ArrowDownIcon, ArrowUpIcon, CheckIcon, GroupIcon } from "./Icons";
import { moveMenuFocus, useDismiss } from "./usePopover";

export interface GroupableColumn {
    id: string;
    name: string;
}

export interface GroupByMenuProps {
    label: string;
    columns: GroupableColumn[];
    /** Grouped column ids, outermost first. */
    groupBy: string[];
    onToggle: (id: string) => void;
    onMove: (id: string, delta: -1 | 1) => void;
    onExpandAll: () => void;
    onCollapseAll: () => void;
    onClear: () => void;
}

/** Toolbar "Group by" menu: pick up to three columns, change their order, expand or collapse every group. */
export function GroupByMenu(props: GroupByMenuProps): ReactElement {
    const [open, setOpen] = useState(false);
    const root = useRef<HTMLDivElement>(null);
    const button = useRef<HTMLButtonElement>(null);
    useDismiss(open, setOpen, root, button);
    const grouped = props.groupBy.length > 0;
    const full = props.groupBy.length >= MAX_GROUP_LEVELS;

    useEffect(() => {
        if (!open) {
            return;
        }
        const frame = window.requestAnimationFrame(() =>
            root.current?.querySelector<HTMLElement>(".mxt-ag-menu [data-menuitem]")?.focus()
        );
        return () => window.cancelAnimationFrame(frame);
    }, [open]);

    const nameOf = (id: string): string => props.columns.find(column => column.id === id)?.name ?? id;
    const handleMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
        if (moveMenuFocus(event.currentTarget, event.key)) {
            event.preventDefault();
        }
    };

    return (
        <div className="mxt-ag-menu-root mxt-ag-groupby" ref={root}>
            <button
                ref={button}
                type="button"
                className={classNames("btn btn-default mxt-ag-btn", { "mxt-ag-btn--active": grouped })}
                aria-haspopup="menu"
                aria-expanded={open}
                onClick={() => setOpen(!open)}
                onKeyDown={event => {
                    if (event.key === "ArrowDown" && !open) {
                        event.preventDefault();
                        setOpen(true);
                    }
                }}
            >
                <GroupIcon />
                <span>{props.label}</span>
                {grouped && (
                    <span className="mxt-ag-groupby__chips" aria-label={props.groupBy.map(nameOf).join(", ")}>
                        {props.groupBy.map((id, level) => (
                            <span key={id} className="mxt-ag-groupby__chip" aria-hidden="true">
                                {level > 0 && <span className="mxt-ag-groupby__sep">›</span>}
                                {nameOf(id)}
                            </span>
                        ))}
                    </span>
                )}
            </button>
            {open && (
                <div
                    className="mxt-ag-menu mxt-ag-groupby__menu"
                    role="menu"
                    aria-label={props.label}
                    onKeyDown={handleMenuKeyDown}
                >
                    {props.columns.length === 0 && <div className="mxt-ag-menu__empty">No columns can be grouped.</div>}
                    {props.columns.map(column => {
                        const level = props.groupBy.indexOf(column.id);
                        const checked = level >= 0;
                        return (
                            <div key={column.id} className={classNames("mxt-ag-menu__row", { "is-active": checked })}>
                                <button
                                    type="button"
                                    role="menuitemcheckbox"
                                    aria-checked={checked}
                                    data-menuitem
                                    className="mxt-ag-menu__item"
                                    disabled={!checked && full}
                                    onClick={() => props.onToggle(column.id)}
                                >
                                    <span className="mxt-ag-menu__check">{checked && <CheckIcon />}</span>
                                    <span className="mxt-ag-menu__name">{column.name || column.id}</span>
                                    {checked && <span className="mxt-ag-menu__tag">{level + 1}</span>}
                                </button>
                                {checked && props.groupBy.length > 1 && (
                                    <span className="mxt-ag-menu__actions">
                                        <button
                                            type="button"
                                            className="mxt-ag-icon-btn"
                                            aria-label={`Move ${column.name} up`}
                                            title="Move up"
                                            disabled={level === 0}
                                            onClick={() => props.onMove(column.id, -1)}
                                        >
                                            <ArrowUpIcon />
                                        </button>
                                        <button
                                            type="button"
                                            className="mxt-ag-icon-btn"
                                            aria-label={`Move ${column.name} down`}
                                            title="Move down"
                                            disabled={level === props.groupBy.length - 1}
                                            onClick={() => props.onMove(column.id, 1)}
                                        >
                                            <ArrowDownIcon />
                                        </button>
                                    </span>
                                )}
                            </div>
                        );
                    })}
                    {grouped && (
                        <div className="mxt-ag-menu__footer mxt-ag-groupby__footer">
                            <button
                                type="button"
                                data-menuitem
                                className="btn btn-link btn-sm"
                                onClick={props.onExpandAll}
                            >
                                Expand all
                            </button>
                            <button
                                type="button"
                                data-menuitem
                                className="btn btn-link btn-sm"
                                onClick={props.onCollapseAll}
                            >
                                Collapse all
                            </button>
                            <button type="button" data-menuitem className="btn btn-link btn-sm" onClick={props.onClear}>
                                Ungroup
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
