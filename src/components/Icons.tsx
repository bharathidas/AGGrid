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
