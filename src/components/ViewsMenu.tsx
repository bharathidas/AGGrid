import { FormEvent, KeyboardEvent, ReactElement, useEffect, useRef, useState } from "react";
import classNames from "classnames";

import { SavedView } from "../utils/views";
import { CheckIcon, PencilIcon, PlusIcon, StarIcon, TrashIcon, ViewsIcon } from "./Icons";
import { moveMenuFocus, useDismiss } from "./usePopover";

export interface ViewsMenuProps {
    label: string;
    saveLabel: string;
    views: SavedView[];
    activeId?: string;
    /** The grid layout differs from the active view. */
    dirty: boolean;
    /** The views cannot be changed (read-only attribute); views can still be applied. */
    readOnly: boolean;
    /** Ids of views saved for another column configuration. */
    outdatedIds: ReadonlySet<string>;
    nameProblem: (name: string, exceptId?: string) => string | undefined;
    onApply: (id: string) => void;
    onSaveAs: (name: string) => void;
    onUpdate: (id: string) => void;
    onRename: (id: string, name: string) => void;
    onDelete: (id: string) => void;
    onToggleDefault: (id: string) => void;
}

type Mode = { kind: "list" } | { kind: "save" } | { kind: "rename"; id: string } | { kind: "delete"; id: string };

interface NameFormProps {
    initial: string;
    submitLabel: string;
    nameProblem: (name: string) => string | undefined;
    onSubmit: (name: string) => void;
    onCancel: () => void;
}

function NameForm(props: NameFormProps): ReactElement {
    const [name, setName] = useState(props.initial);
    const [touched, setTouched] = useState(false);
    const problem = touched ? props.nameProblem(name) : undefined;
    const submit = (event: FormEvent): void => {
        event.preventDefault();
        setTouched(true);
        if (!props.nameProblem(name)) {
            props.onSubmit(name);
        }
    };
    return (
        <form className="mxt-ag-menu__form" onSubmit={submit}>
            <input
                className="form-control mxt-ag-menu__input"
                aria-label="View name"
                placeholder="View name"
                aria-invalid={Boolean(problem)}
                maxLength={60}
                value={name}
                autoFocus
                onChange={event => setName(event.target.value)}
                onKeyDown={event => event.stopPropagation()}
            />
            <div className="mxt-ag-menu__form-buttons">
                <button type="submit" className="btn btn-primary btn-sm">
                    {props.submitLabel}
                </button>
                <button type="button" className="btn btn-default btn-sm" onClick={props.onCancel}>
                    Cancel
                </button>
            </div>
            {problem && (
                <div className="mxt-ag-menu__problem" role="alert">
                    {problem}
                </div>
            )}
        </form>
    );
}

/** Toolbar "Views" menu: apply, save, update, rename, delete and mark the default saved view. */
export function ViewsMenu(props: ViewsMenuProps): ReactElement {
    const [open, setOpen] = useState(false);
    const root = useRef<HTMLDivElement>(null);
    const button = useRef<HTMLButtonElement>(null);
    const close = useDismiss(open, setOpen, root, button);
    const [mode, setMode] = useState<Mode>({ kind: "list" });
    const active = props.views.find(view => view.id === props.activeId);

    useEffect(() => {
        if (!open) {
            return;
        }
        // Move the focus into the menu once it is rendered, like a native menu button.
        const frame = window.requestAnimationFrame(() => {
            const menu = root.current?.querySelector<HTMLElement>(".mxt-ag-menu");
            const target =
                menu?.querySelector<HTMLElement>('[aria-checked="true"]') ??
                menu?.querySelector<HTMLElement>("[data-menuitem]");
            target?.focus();
        });
        return () => window.cancelAnimationFrame(frame);
    }, [open]);

    const toggleMenu = (): void => {
        if (!open) {
            setMode({ kind: "list" });
        }
        setOpen(!open);
    };
    const finish = (): void => {
        setMode({ kind: "list" });
        close();
    };
    const handleMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
        if (moveMenuFocus(event.currentTarget, event.key)) {
            event.preventDefault();
        }
    };
    const handleButtonKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
        if (event.key === "ArrowDown" && !open) {
            event.preventDefault();
            toggleMenu();
        }
    };

    return (
        <div className="mxt-ag-menu-root mxt-ag-views" ref={root}>
            <button
                ref={button}
                type="button"
                className={classNames("btn btn-default mxt-ag-btn", { "mxt-ag-btn--active": Boolean(active) })}
                aria-haspopup="menu"
                aria-expanded={open}
                onClick={toggleMenu}
                onKeyDown={handleButtonKeyDown}
            >
                <ViewsIcon />
                <span>{props.label}</span>
                {active && (
                    <span className="mxt-ag-views__current">
                        {active.name}
                        {props.dirty && (
                            <span className="mxt-ag-views__dirty" title="Changed since the view was applied">
                                <span className="mxt-ag-sr-only"> (changed)</span>
                            </span>
                        )}
                    </span>
                )}
            </button>
            {open && (
                <div
                    className="mxt-ag-menu mxt-ag-views__menu"
                    role="menu"
                    aria-label={props.label}
                    onKeyDown={handleMenuKeyDown}
                >
                    {props.views.length === 0 && <div className="mxt-ag-menu__empty">No saved views yet.</div>}
                    {props.views.map(view => {
                        const isActive = view.id === props.activeId;
                        if (mode.kind === "rename" && mode.id === view.id) {
                            return (
                                <NameForm
                                    key={view.id}
                                    initial={view.name}
                                    submitLabel="Rename"
                                    nameProblem={name => props.nameProblem(name, view.id)}
                                    onSubmit={name => {
                                        props.onRename(view.id, name);
                                        setMode({ kind: "list" });
                                    }}
                                    onCancel={() => setMode({ kind: "list" })}
                                />
                            );
                        }
                        if (mode.kind === "delete" && mode.id === view.id) {
                            return (
                                <div key={view.id} className="mxt-ag-menu__confirm" role="alert">
                                    <span>Delete &ldquo;{view.name}&rdquo;?</span>
                                    <button
                                        type="button"
                                        data-menuitem
                                        className="btn btn-danger btn-sm"
                                        autoFocus
                                        onClick={() => {
                                            props.onDelete(view.id);
                                            setMode({ kind: "list" });
                                        }}
                                    >
                                        Delete
                                    </button>
                                    <button
                                        type="button"
                                        data-menuitem
                                        className="btn btn-default btn-sm"
                                        onClick={() => setMode({ kind: "list" })}
                                    >
                                        Cancel
                                    </button>
                                </div>
                            );
                        }
                        const outdated = props.outdatedIds.has(view.id);
                        return (
                            <div key={view.id} className={classNames("mxt-ag-menu__row", { "is-active": isActive })}>
                                <button
                                    type="button"
                                    role="menuitemradio"
                                    aria-checked={isActive}
                                    data-menuitem
                                    className="mxt-ag-menu__item"
                                    title={
                                        outdated
                                            ? "Saved for other columns: only the search text is applied."
                                            : undefined
                                    }
                                    onClick={() => {
                                        props.onApply(view.id);
                                        finish();
                                    }}
                                >
                                    <span className="mxt-ag-menu__check">{isActive && <CheckIcon />}</span>
                                    <span className="mxt-ag-menu__name">{view.name}</span>
                                    {view.isDefault && <span className="mxt-ag-menu__tag">Default</span>}
                                    {outdated && (
                                        <span className="mxt-ag-menu__tag mxt-ag-menu__tag--muted">Outdated</span>
                                    )}
                                </button>
                                {!props.readOnly && (
                                    <span className="mxt-ag-menu__actions">
                                        <button
                                            type="button"
                                            data-menuitem
                                            className={classNames("mxt-ag-icon-btn", { "is-on": view.isDefault })}
                                            aria-pressed={Boolean(view.isDefault)}
                                            aria-label={`Default view: ${view.name}`}
                                            title={
                                                view.isDefault ? "Remove as default view" : "Open this view by default"
                                            }
                                            onClick={() => props.onToggleDefault(view.id)}
                                        >
                                            <StarIcon filled={view.isDefault} />
                                        </button>
                                        <button
                                            type="button"
                                            data-menuitem
                                            className="mxt-ag-icon-btn"
                                            aria-label={`Rename ${view.name}`}
                                            title="Rename"
                                            onClick={() => setMode({ kind: "rename", id: view.id })}
                                        >
                                            <PencilIcon />
                                        </button>
                                        <button
                                            type="button"
                                            data-menuitem
                                            className="mxt-ag-icon-btn mxt-ag-icon-btn--danger"
                                            aria-label={`Delete ${view.name}`}
                                            title="Delete"
                                            onClick={() => setMode({ kind: "delete", id: view.id })}
                                        >
                                            <TrashIcon />
                                        </button>
                                    </span>
                                )}
                            </div>
                        );
                    })}
                    {!props.readOnly && (
                        <div className="mxt-ag-menu__footer">
                            {active && props.dirty && mode.kind !== "save" && (
                                <button
                                    type="button"
                                    role="menuitem"
                                    data-menuitem
                                    className="mxt-ag-menu__item"
                                    onClick={() => {
                                        props.onUpdate(active.id);
                                        finish();
                                    }}
                                >
                                    <span className="mxt-ag-menu__check">
                                        <CheckIcon />
                                    </span>
                                    <span className="mxt-ag-menu__name">Update &ldquo;{active.name}&rdquo;</span>
                                </button>
                            )}
                            {mode.kind === "save" ? (
                                <NameForm
                                    initial=""
                                    submitLabel="Save"
                                    nameProblem={name => props.nameProblem(name)}
                                    onSubmit={name => {
                                        props.onSaveAs(name);
                                        finish();
                                    }}
                                    onCancel={() => setMode({ kind: "list" })}
                                />
                            ) : (
                                <button
                                    type="button"
                                    role="menuitem"
                                    data-menuitem
                                    className="mxt-ag-menu__item"
                                    onClick={() => setMode({ kind: "save" })}
                                >
                                    <span className="mxt-ag-menu__check">
                                        <PlusIcon />
                                    </span>
                                    <span className="mxt-ag-menu__name">{props.saveLabel}</span>
                                </button>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
