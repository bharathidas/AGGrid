import { ReactElement, useEffect, useRef, useState } from "react";
import { ColumnsIcon } from "./Icons";

export interface ChooserColumn {
    id: string;
    name: string;
    visible: boolean;
}

export interface ColumnChooserProps {
    label: string;
    columns: ChooserColumn[];
    onToggle: (id: string, visible: boolean) => void;
}

/** "Columns" toolbar button with a checklist to show and hide columns, like the Data Grid 2 column menu. */
export function ColumnChooser(props: ColumnChooserProps): ReactElement {
    const [open, setOpen] = useState(false);
    const root = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) {
            return;
        }
        const close = (event: MouseEvent): void => {
            if (root.current && !root.current.contains(event.target as Node)) {
                setOpen(false);
            }
        };
        const escape = (event: KeyboardEvent): void => {
            if (event.key === "Escape") {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", close);
        document.addEventListener("keydown", escape);
        return () => {
            document.removeEventListener("mousedown", close);
            document.removeEventListener("keydown", escape);
        };
    }, [open]);

    return (
        <div className="mxt-ag-chooser" ref={root}>
            <button
                type="button"
                className="btn btn-default mxt-ag-btn"
                aria-haspopup="true"
                aria-expanded={open}
                onClick={() => setOpen(current => !current)}
            >
                <ColumnsIcon />
                <span>{props.label}</span>
            </button>
            {open && (
                <div className="mxt-ag-chooser__menu" role="menu">
                    {props.columns.map(column => (
                        <label key={column.id} className="mxt-ag-chooser__item">
                            <input
                                type="checkbox"
                                checked={column.visible}
                                onChange={event => props.onToggle(column.id, event.target.checked)}
                            />
                            <span>{column.name || column.id}</span>
                        </label>
                    ))}
                </div>
            )}
        </div>
    );
}
