import { ReactElement, useEffect, useRef } from "react";

import { Shortcut } from "../utils/shortcuts";
import { KeyboardIcon } from "./Icons";
import { useDismiss } from "./usePopover";

export interface KeyboardHelpProps {
    label: string;
    shortcuts: Shortcut[];
    /** Controlled by the grid, so Shift+? can open it too. */
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

/** Toolbar button with a popover listing the keyboard shortcuts. */
export function KeyboardHelp(props: KeyboardHelpProps): ReactElement {
    const { open, onOpenChange } = props;
    const root = useRef<HTMLDivElement>(null);
    const button = useRef<HTMLButtonElement>(null);
    useDismiss(open, onOpenChange, root, button);

    useEffect(() => {
        if (!open) {
            return;
        }
        const frame = window.requestAnimationFrame(() =>
            root.current?.querySelector<HTMLElement>(".mxt-ag-help")?.focus()
        );
        return () => window.cancelAnimationFrame(frame);
    }, [open]);

    return (
        <div className="mxt-ag-menu-root" ref={root}>
            <button
                ref={button}
                type="button"
                className="btn btn-default mxt-ag-btn mxt-ag-btn--icon"
                aria-label={props.label}
                title={props.label}
                aria-haspopup="dialog"
                aria-expanded={open}
                onClick={() => onOpenChange(!open)}
            >
                <KeyboardIcon />
            </button>
            {open && (
                <div className="mxt-ag-menu mxt-ag-help" role="dialog" aria-label={props.label} tabIndex={-1}>
                    <div className="mxt-ag-help__title">{props.label}</div>
                    <dl className="mxt-ag-help__list">
                        {props.shortcuts.map(shortcut => (
                            <div key={shortcut.keys} className="mxt-ag-help__row">
                                <dt>
                                    {shortcut.keys.split(" / ").map((keys, index) => (
                                        <span key={keys}>
                                            {index > 0 && " / "}
                                            <kbd>{keys}</kbd>
                                        </span>
                                    ))}
                                </dt>
                                <dd>{shortcut.action}</dd>
                            </div>
                        ))}
                    </dl>
                </div>
            )}
        </div>
    );
}
