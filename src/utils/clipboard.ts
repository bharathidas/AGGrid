import type { CellKind } from "./rows";

/**
 * Paste from Excel: parsing of tab-separated clipboard text and conversion of the pasted text to the value
 * type of the target column. AG Grid Community has no clipboard support; this is the widget's own.
 */

/**
 * Splits clipboard text into rows and cells. Understands Excel's quoting (cells with tabs, new lines or
 * quotes are wrapped in double quotes, inner quotes doubled) and ignores the trailing line break.
 */
export function parseClipboard(text: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let cell = "";
    let quoted = false;
    let atCellStart = true;
    for (let index = 0; index < text.length; index++) {
        const char = text[index];
        if (quoted) {
            if (char === '"') {
                if (text[index + 1] === '"') {
                    cell += '"';
                    index++;
                } else {
                    quoted = false;
                }
            } else {
                cell += char;
            }
            continue;
        }
        if (char === '"' && atCellStart) {
            quoted = true;
            atCellStart = false;
            continue;
        }
        if (char === "\t") {
            row.push(cell);
            cell = "";
            atCellStart = true;
            continue;
        }
        if (char === "\r" || char === "\n") {
            if (char === "\r" && text[index + 1] === "\n") {
                index++;
            }
            row.push(cell);
            rows.push(row);
            row = [];
            cell = "";
            atCellStart = true;
            continue;
        }
        cell += char;
        atCellStart = false;
    }
    if (cell !== "" || row.length > 0) {
        row.push(cell);
        rows.push(row);
    }
    return rows;
}

export interface PasteCell {
    /** Index into the list of target rows. */
    rowOffset: number;
    /** Index into the list of target columns. */
    colOffset: number;
    text: string;
}

/**
 * The cells a paste writes: the block starts at the focused cell and is cut off at the last row and
 * column. A single copied value fills every selected target row when `fillRows` is given.
 */
export function planPaste(block: string[][], rowCount: number, colCount: number, fillRows = 0): PasteCell[] {
    const cells: PasteCell[] = [];
    if (block.length === 1 && block[0].length === 1 && fillRows > 1) {
        for (let rowOffset = 0; rowOffset < Math.min(fillRows, rowCount); rowOffset++) {
            cells.push({ rowOffset, colOffset: 0, text: block[0][0] });
        }
        return cells;
    }
    block.forEach((values, rowOffset) => {
        if (rowOffset >= rowCount) {
            return;
        }
        values.forEach((text, colOffset) => {
            if (colOffset < colCount) {
                cells.push({ rowOffset, colOffset, text });
            }
        });
    });
    return cells;
}

/** Reads a number the way people paste it: "1,234.50", "1.234,50", "1 234", "12%", "-7". */
export function parseNumber(text: string): number | undefined {
    let clean = text.replace(/[\s\u00a0\u202f]/g, "").replace(/^[^\d+\-.,(]+|[^\d.,%)]+$/g, "");
    if (!clean) {
        return undefined;
    }
    let negative = false;
    if (/^\(.*\)$/.test(clean)) {
        negative = true;
        clean = clean.slice(1, -1);
    }
    let percent = false;
    if (clean.endsWith("%")) {
        percent = true;
        clean = clean.slice(0, -1);
    }
    const lastComma = clean.lastIndexOf(",");
    const lastDot = clean.lastIndexOf(".");
    if (lastComma >= 0 && lastDot >= 0) {
        // Both separators: the last one is the decimal separator.
        clean = lastComma > lastDot ? clean.replace(/\./g, "").replace(",", ".") : clean.replace(/,/g, "");
    } else if (lastComma >= 0) {
        clean = /^-?\d{1,3}(,\d{3})+$/.test(clean) ? clean.replace(/,/g, "") : clean.replace(",", ".");
    } else if (/^-?\d{1,3}(\.\d{3}){2,}$/.test(clean)) {
        clean = clean.replace(/\./g, "");
    }
    if (!/^[+-]?(\d+\.?\d*|\.\d+)$/.test(clean)) {
        return undefined;
    }
    const value = Number(clean) * (negative ? -1 : 1);
    return Number.isFinite(value) ? (percent ? value / 100 : value) : undefined;
}

const TRUE_WORDS = new Set(["true", "yes", "y", "1", "x", "on", "ja", "oui", "si", "sí", "✓", "✔"]);
const FALSE_WORDS = new Set(["false", "no", "n", "0", "", "off", "nee", "nein", "non"]);

export function parseBoolean(text: string, captions: { yes?: string; no?: string } = {}): boolean | undefined {
    const value = text.trim().toLowerCase();
    if (captions.yes && value === captions.yes.toLowerCase()) {
        return true;
    }
    if (captions.no && value === captions.no.toLowerCase()) {
        return false;
    }
    if (TRUE_WORDS.has(value)) {
        return true;
    }
    return FALSE_WORDS.has(value) ? false : undefined;
}

/**
 * Reads a date: ISO (2026-10-09, 2026-10-09T14:30), day-first (09-10-2026, 9.10.2026, 09/10/2026) or
 * month-first with slashes when the locale writes dates that way (en-US).
 */
export function parseDate(text: string, monthFirst = false): Date | undefined {
    const value = text.trim();
    if (!value) {
        return undefined;
    }
    const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(value);
    if (iso) {
        return makeDate(+iso[1], +iso[2], +iso[3], +(iso[4] ?? 0), +(iso[5] ?? 0), +(iso[6] ?? 0));
    }
    const local = /^(\d{1,2})([./-])(\d{1,2})\2(\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(value);
    if (local) {
        const first = +local[1];
        const second = +local[3];
        const year = local[4].length === 2 ? 2000 + +local[4] : +local[4];
        const useMonthFirst = monthFirst && local[2] === "/";
        const [day, month] = useMonthFirst ? [second, first] : [first, second];
        return makeDate(year, month, day, +(local[5] ?? 0), +(local[6] ?? 0), +(local[7] ?? 0));
    }
    return undefined;
}

function makeDate(
    year: number,
    month: number,
    day: number,
    hours: number,
    minutes: number,
    seconds: number
): Date | undefined {
    const date = new Date(year, month - 1, day, hours, minutes, seconds);
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : undefined;
}

export interface ParseContext {
    /** Enumeration key to caption. */
    enumCaptions?: Record<string, string>;
    booleanCaptions?: { yes?: string; no?: string };
    monthFirst?: boolean;
}

export type PastedValue = { ok: true; value: unknown } | { ok: false };

/** Converts pasted text to the value an AG Grid cell of the given kind holds; `ok: false` skips the cell. */
export function parsePastedValue(kind: CellKind, text: string, context: ParseContext = {}): PastedValue {
    const trimmed = text.trim();
    switch (kind) {
        case "number": {
            if (!trimmed) {
                return { ok: true, value: undefined };
            }
            const value = parseNumber(trimmed);
            return value === undefined ? { ok: false } : { ok: true, value };
        }
        case "boolean": {
            const value = parseBoolean(trimmed, context.booleanCaptions);
            return value === undefined ? { ok: false } : { ok: true, value };
        }
        case "date": {
            if (!trimmed) {
                return { ok: true, value: undefined };
            }
            const value = parseDate(trimmed, context.monthFirst);
            return value ? { ok: true, value } : { ok: false };
        }
        case "enum": {
            if (!trimmed) {
                return { ok: true, value: undefined };
            }
            const captions = context.enumCaptions ?? {};
            const wanted = trimmed.toLowerCase();
            const key = Object.keys(captions).find(
                candidate => candidate.toLowerCase() === wanted || captions[candidate].toLowerCase() === wanted
            );
            return key === undefined ? { ok: false } : { ok: true, value: key };
        }
        case "text":
            return { ok: true, value: text };
        default:
            return { ok: false };
    }
}

/** True when the locale writes short dates month first (en-US style). */
export function localeIsMonthFirst(locale: string | undefined): boolean {
    try {
        const parts = new Intl.DateTimeFormat(locale, {
            year: "numeric",
            month: "2-digit",
            day: "2-digit"
        }).formatToParts(new Date(2026, 9, 9));
        const order = parts.filter(part => part.type === "month" || part.type === "day").map(part => part.type);
        return order[0] === "month";
    } catch {
        return false;
    }
}
