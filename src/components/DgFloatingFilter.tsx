import { ChangeEvent, ReactElement, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DateFilterModel, NumberFilterModel, TextFilterModel } from "ag-grid-community";
import { CustomFloatingFilterProps } from "ag-grid-react";

export type DgFilterKind = "text" | "number" | "date";

export interface DgFloatingFilterParams {
    kind: DgFilterKind;
    placeholder?: string;
}

type Model = TextFilterModel | NumberFilterModel | DateFilterModel;
type Props = CustomFloatingFilterProps<Model> & DgFloatingFilterParams;

interface Operator {
    /** Data Grid 2 icon class (datagrid-filters font) and menu label. */
    icon: string;
    label: string;
    /** AG Grid filter type. */
    type: string;
    valueless?: boolean;
}

const TEXT_OPERATORS: Operator[] = [
    { icon: "contains", label: "Contains", type: "contains" },
    { icon: "startsWith", label: "Starts with", type: "startsWith" },
    { icon: "endsWith", label: "Ends with", type: "endsWith" },
    { icon: "equal", label: "Equal", type: "equals" },
    { icon: "notEqual", label: "Not equal", type: "notEqual" },
    { icon: "empty", label: "Empty", type: "blank", valueless: true },
    { icon: "notEmpty", label: "Not empty", type: "notBlank", valueless: true }
];

const NUMBER_OPERATORS: Operator[] = [
    { icon: "equal", label: "Equal", type: "equals" },
    { icon: "notEqual", label: "Not equal", type: "notEqual" },
    { icon: "greater", label: "Greater than", type: "greaterThan" },
    { icon: "greaterEqual", label: "Greater than or equal", type: "greaterThanOrEqual" },
    { icon: "smaller", label: "Smaller than", type: "lessThan" },
    { icon: "smallerEqual", label: "Smaller than or equal", type: "lessThanOrEqual" },
    { icon: "empty", label: "Empty", type: "blank", valueless: true },
    { icon: "notEmpty", label: "Not empty", type: "notBlank", valueless: true }
];

function operatorsFor(kind: DgFilterKind): Operator[] {
    return kind === "text" ? TEXT_OPERATORS : NUMBER_OPERATORS;
}

function modelValue(kind: DgFilterKind, model: Model | null): string {
    if (!model) {
        return "";
    }
    if (kind === "date") {
        const from = (model as DateFilterModel).dateFrom;
        return from ? from.slice(0, 10) : "";
    }
    const value = (model as TextFilterModel | NumberFilterModel).filter;
    return value === undefined || value === null ? "" : String(value);
}

function buildModel(kind: DgFilterKind, operator: Operator, value: string): Model | null {
    if (operator.valueless) {
        return { filterType: kind, type: operator.type } as Model;
    }
    if (value.trim() === "") {
        return null;
    }
    if (kind === "date") {
        return {
            filterType: "date",
            type: operator.type,
            dateFrom: `${value} 00:00:00`,
            dateTo: null
        } as DateFilterModel;
    }
    if (kind === "number") {
        const numeric = Number(value);
        return Number.isFinite(numeric)
            ? ({ filterType: "number", type: operator.type, filter: numeric } as NumberFilterModel)
            : null;
    }
    return { filterType: "text", type: operator.type, filter: value } as TextFilterModel;
}

/**
 * Floating filter in the Data Grid 2 style: an operator button with the Data Grid 2 filter icons,
 * a drop-down list of operators, and an input. Uses the Data Grid 2 theme classes, so it looks the same.
 */
export function DgFloatingFilter(props: Props): ReactElement {
    const { kind, model, onModelChange } = props;
    const operators = operatorsFor(kind);
    const [operator, setOperator] = useState<Operator>(
        () => operators.find(candidate => candidate.type === model?.type) ?? operators[0]
    );
    const [value, setValue] = useState<string>(() => modelValue(kind, model));
    const [open, setOpen] = useState(false);
    const [menuPosition, setMenuPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
    const buttonRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLUListElement>(null);
    const debounce = useRef<number | undefined>(undefined);

    // Keep in sync when the model is changed elsewhere (reset button, restored state, filter popup).
    // State is adjusted during render, which avoids an extra effect pass.
    const externalType = model?.type;
    const externalValue = modelValue(kind, model);
    const [synced, setSynced] = useState({ type: externalType, value: externalValue });
    if (synced.type !== externalType || synced.value !== externalValue) {
        setSynced({ type: externalType, value: externalValue });
        setValue(externalValue);
        const match = externalType ? operators.find(candidate => candidate.type === externalType) : undefined;
        if (match) {
            setOperator(match);
        }
    }

    useEffect(() => {
        if (!open) {
            return;
        }
        const close = (event: MouseEvent): void => {
            const target = event.target as Node;
            if (!menuRef.current?.contains(target) && !buttonRef.current?.contains(target)) {
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

    const apply = (nextOperator: Operator, nextValue: string, immediate: boolean): void => {
        window.clearTimeout(debounce.current);
        const push = (): void => onModelChange(buildModel(kind, nextOperator, nextValue));
        if (immediate) {
            push();
        } else {
            debounce.current = window.setTimeout(push, 300);
        }
    };

    const toggleMenu = (): void => {
        const rect = buttonRef.current?.getBoundingClientRect();
        if (rect) {
            setMenuPosition({ top: rect.bottom + window.scrollY, left: rect.left + window.scrollX });
        }
        setOpen(current => !current);
    };

    const selectOperator = (next: Operator): void => {
        setOperator(next);
        setOpen(false);
        apply(next, value, true);
    };

    const handleInput = (event: ChangeEvent<HTMLInputElement>): void => {
        const next = event.target.value;
        setValue(next);
        apply(operator, next, kind === "date");
    };

    const columnName = props.column.getColDef().headerName ?? "";

    return (
        <div className="filter-container mxt-ag-dg-filter">
            <div className="filter-selector">
                <div className="filter-selector-content">
                    <button
                        ref={buttonRef}
                        type="button"
                        className={`btn btn-default filter-selector-button button-icon ${operator.icon}`}
                        aria-label={`${columnName} filter type: ${operator.label}`}
                        aria-haspopup="listbox"
                        aria-expanded={open}
                        onClick={toggleMenu}
                    />
                </div>
            </div>
            <input
                type={kind === "date" ? "date" : "text"}
                inputMode={kind === "number" ? "decimal" : undefined}
                className="form-control filter-input"
                aria-label={`${columnName} filter`}
                placeholder={props.placeholder ?? ""}
                disabled={Boolean(operator.valueless)}
                value={value}
                onChange={handleInput}
            />
            {open &&
                createPortal(
                    <ul
                        ref={menuRef}
                        className="filter-selectors mxt-ag-dg-filter__menu"
                        role="listbox"
                        style={{ position: "absolute", top: menuPosition.top, left: menuPosition.left }}
                    >
                        {operators.map(candidate => (
                            <li
                                key={candidate.type}
                                className={`filter-listitem${
                                    candidate.type === operator.type ? " filter-selected" : ""
                                }`}
                                role="option"
                                tabIndex={0}
                                aria-selected={candidate.type === operator.type}
                                onClick={() => selectOperator(candidate)}
                                onKeyDown={event => {
                                    if (event.key === "Enter" || event.key === " ") {
                                        event.preventDefault();
                                        selectOperator(candidate);
                                    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                                        event.preventDefault();
                                        const sibling =
                                            event.key === "ArrowDown"
                                                ? event.currentTarget.nextElementSibling
                                                : event.currentTarget.previousElementSibling;
                                        (sibling as HTMLElement | null)?.focus();
                                    }
                                }}
                            >
                                <div className={`filter-icon ${candidate.icon}`} aria-hidden="true" />
                                <div className="filter-label">{candidate.label}</div>
                            </li>
                        ))}
                    </ul>,
                    document.body
                )}
        </div>
    );
}
