import { ReactElement } from "react";

interface IconProps {
    /** Extra class names next to the shared icon class. */
    className?: string;
}

function Svg({ className, children }: IconProps & { children: ReactElement | ReactElement[] }): ReactElement {
    return (
        <svg
            className={className ? `mxt-ag-icon ${className}` : "mxt-ag-icon"}
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
        >
            {children}
        </svg>
    );
}

/** Circular arrow: reload the data source. */
export function RefreshIcon(props: IconProps): ReactElement {
    return (
        <Svg {...props}>
            <path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9" />
            <path d="M13.5 2.5v3h-3" />
        </Svg>
    );
}

/** Undo arrow: reset filters, sorting and layout. */
export function ResetIcon(props: IconProps): ReactElement {
    return (
        <Svg {...props}>
            <path d="M2.5 8a5.5 5.5 0 1 0 1.6-3.9" />
            <path d="M2.5 2.5v3h3" />
        </Svg>
    );
}

/** Spreadsheet grid: Excel export. */
export function ExcelIcon(props: IconProps): ReactElement {
    return (
        <Svg {...props}>
            <rect x="2" y="2.5" width="12" height="11" rx="1.5" />
            <path d="M2 6.5h12M2 10h12M7 2.5v11" />
        </Svg>
    );
}

/** Document with text lines: CSV export. */
export function CsvIcon(props: IconProps): ReactElement {
    return (
        <Svg {...props}>
            <path d="M4 1.5h5.5L13 5v8a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 3 13V2.5A1 1 0 0 1 4 1.5z" />
            <path d="M9.5 1.5V5H13" />
            <path d="M5.5 8.5h5M5.5 11h5" />
        </Svg>
    );
}

/** Three vertical bars: column chooser. */
export function ColumnsIcon(props: IconProps): ReactElement {
    return (
        <Svg {...props}>
            <rect x="2" y="2.5" width="12" height="11" rx="1.5" />
            <path d="M6 2.5v11M10 2.5v11" />
        </Svg>
    );
}

/** Cross: clear the selection. */
export function ClearIcon(props: IconProps): ReactElement {
    return (
        <Svg {...props}>
            <path d="M4 4l8 8M12 4l-8 8" />
        </Svg>
    );
}

/** Stacked layers: saved views. */
export function ViewsIcon(props: IconProps): ReactElement {
    return (
        <Svg {...props}>
            <path d="M8 2l6 3-6 3-6-3z" />
            <path d="M2 8l6 3 6-3" />
            <path d="M2 11l6 3 6-3" />
        </Svg>
    );
}

/** Star: default view. */
export function StarIcon(props: IconProps & { filled?: boolean }): ReactElement {
    const { filled, ...rest } = props;
    return (
        <Svg {...rest}>
            <path
                d="M8 1.8l1.9 3.9 4.3.6-3.1 3 .7 4.3L8 11.6l-3.8 2 .7-4.3-3.1-3 4.3-.6z"
                fill={filled ? "currentColor" : "none"}
            />
        </Svg>
    );
}

/** Pencil: rename. */
export function PencilIcon(props: IconProps): ReactElement {
    return (
        <Svg {...props}>
            <path d="M11 2.5l2.5 2.5L5.5 13H3v-2.5z" />
            <path d="M9.5 4l2.5 2.5" />
        </Svg>
    );
}

/** Trash can: delete. */
export function TrashIcon(props: IconProps): ReactElement {
    return (
        <Svg {...props}>
            <path d="M2.5 4h11M6 4V2.5h4V4M4 4l.7 9.5h6.6L12 4" />
        </Svg>
    );
}

/** Chevron pointing right; rotated by CSS when expanded. */
export function ChevronIcon(props: IconProps): ReactElement {
    return (
        <Svg {...props}>
            <path d="M6 3.5l4.5 4.5L6 12.5" />
        </Svg>
    );
}

/** Triangle with exclamation mark: validation issues. */
export function WarningIcon(props: IconProps): ReactElement {
    return (
        <Svg {...props}>
            <path d="M8 1.8l6.5 11.7h-13z" />
            <path d="M8 6.2v3.3M8 11.6v.1" />
        </Svg>
    );
}

/** Keyboard: keyboard shortcuts. */
export function KeyboardIcon(props: IconProps): ReactElement {
    return (
        <Svg {...props}>
            <rect x="1.5" y="4" width="13" height="8.5" rx="1.5" />
            <path d="M4 6.8h.1M6.6 6.8h.1M9.3 6.8h.1M12 6.8h.1M4.8 9.8h6.4" />
        </Svg>
    );
}

/** Check mark: active view. */
export function CheckIcon(props: IconProps): ReactElement {
    return (
        <Svg {...props}>
            <path d="M3 8.5l3 3 7-7" />
        </Svg>
    );
}

/** Plus: save a new view. */
export function PlusIcon(props: IconProps): ReactElement {
    return (
        <Svg {...props}>
            <path d="M8 3v10M3 8h10" />
        </Svg>
    );
}

/** Stacked bars with indent: group rows by a column. */
export function GroupIcon(props: IconProps): ReactElement {
    return (
        <Svg {...props}>
            <path d="M2 3h8M5 6.5h9M5 10h9M2 13.5h8" />
            <path d="M2.5 3v3.5h2" />
        </Svg>
    );
}

/** Three lines with arrows: row density. */
export function DensityIcon(props: IconProps): ReactElement {
    return (
        <Svg {...props}>
            <path d="M2 3.5h12M2 8h12M2 12.5h12" />
        </Svg>
    );
}

/** Small arrows for moving a group level up and down. */
export function ArrowUpIcon(props: IconProps): ReactElement {
    return (
        <Svg {...props}>
            <path d="M8 13V3.5M4 7.5l4-4 4 4" />
        </Svg>
    );
}

export function ArrowDownIcon(props: IconProps): ReactElement {
    return (
        <Svg {...props}>
            <path d="M8 3v9.5M4 8.5l4 4 4-4" />
        </Svg>
    );
}

/** Side panel: a window with a bar on the inline-end side. */
export function PanelIcon(props: IconProps): ReactElement {
    return (
        <Svg {...props}>
            <rect x="2" y="3" width="12" height="10" rx="1.5" />
            <path d="M10 3v10" />
        </Svg>
    );
}

/** Pivot: rows turned into columns. */
export function PivotIcon(props: IconProps): ReactElement {
    return (
        <Svg {...props}>
            <rect x="2" y="2" width="12" height="12" rx="1.5" />
            <path d="M2 6h12M6 2v12" />
            <path d="M9 9.5h2.5V12" />
        </Svg>
    );
}

/** Chart: three bars on a baseline. */
export function ChartIcon(props: IconProps): ReactElement {
    return (
        <Svg {...props}>
            <path d="M2.5 13.5h11" />
            <path d="M4.5 13V8M8 13V4M11.5 13V6.5" />
        </Svg>
    );
}

/** Expand all: chevrons apart. */
export function ExpandIcon(props: IconProps): ReactElement {
    return (
        <Svg {...props}>
            <path d="M5 6l3-3 3 3M5 10l3 3 3-3" />
        </Svg>
    );
}

/** Collapse all: chevrons together. */
export function CollapseIcon(props: IconProps): ReactElement {
    return (
        <Svg {...props}>
            <path d="M5 3l3 3 3-3M5 13l3-3 3 3" />
        </Svg>
    );
}
