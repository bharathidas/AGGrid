import type { GridRow } from "./rows";

export interface Shortcut {
    keys: string;
    action: string;
}

export interface ShortcutOptions {
    editing: boolean;
    undoRedo: boolean;
    selection: boolean;
    detail: boolean;
    validation: boolean;
    quickSearch: boolean;
    /** Paste from Excel is on. */
    paste?: boolean;
    /** Row grouping is on. */
    grouping?: boolean;
    /** Tree data is on. */
    tree?: boolean;
    /** Cell range selection is on. */
    range?: boolean;
    fill?: boolean;
    chart?: boolean;
    /** Users can change the totals functions. */
    totals?: boolean;
}

/** The keyboard shortcuts that apply to the current configuration, for the keyboard help popover. */
export function shortcutsFor(options: ShortcutOptions): Shortcut[] {
    const list: Shortcut[] = [
        { keys: "Arrow keys", action: "Move between cells" },
        { keys: "Home / End", action: "First or last cell of the row" },
        { keys: "Page Up / Page Down", action: "Scroll a page" }
    ];
    if (options.editing) {
        list.push({ keys: "Enter or F2", action: "Edit the cell" }, { keys: "Esc", action: "Cancel the edit" });
    }
    if (options.undoRedo) {
        list.push({ keys: "Ctrl+Z / Ctrl+Y", action: "Undo / redo an edit" });
    }
    if (options.selection) {
        list.push({ keys: "Space", action: "Select the row" });
    }
    list.push({ keys: "Ctrl+C", action: "Copy the cell" }, { keys: "Ctrl+Shift+C", action: "Copy the row" });
    if (options.paste) {
        list.push({ keys: "Ctrl+V", action: "Paste cells from Excel" });
    }
    if (options.grouping) {
        list.push({ keys: "Enter / Arrow Right / Arrow Left", action: "Toggle, open or close a group (group column)" });
    }
    if (options.tree) {
        list.push({ keys: "Enter / Arrow Right / Arrow Left", action: "Toggle, open or close a row (tree column)" });
    }
    if (options.range) {
        list.push(
            { keys: "Shift+Arrow keys / Shift+click", action: "Select a cell range" },
            { keys: "Ctrl+C", action: "Copy the range (tab separated)" }
        );
    }
    if (options.fill) {
        list.push({ keys: "Ctrl+D", action: "Fill down from the first row of the range" });
    }
    if (options.chart) {
        list.push({ keys: "Alt+F1", action: "Chart the range" });
    }
    if (options.totals) {
        list.push({ keys: "Enter (totals row)", action: "Change the totals function" });
    }
    if (options.detail) {
        list.push({ keys: "Alt+Down / Alt+Up", action: "Show / hide row details" });
    }
    if (options.validation) {
        list.push({ keys: "F8 / Shift+F8", action: "Next / previous issue" });
    }
    if (options.quickSearch) {
        list.push({ keys: "/", action: "Search" });
    }
    list.push({ keys: "Shift+?", action: "Show these shortcuts" });
    return list;
}

/** Tab separated text of a row's displayed cells, the format spreadsheets paste as one row. */
export function rowAsText(row: GridRow, colIds: string[]): string {
    return colIds.map(id => clean(row.cells[id]?.display ?? "")).join("\t");
}

function clean(text: string): string {
    return text.replace(/[\t\r\n]+/g, " ");
}

/** Whether a key event comes from a field the user types in, where grid shortcuts must not fire. */
export function isTypingTarget(target: EventTarget | null): boolean {
    const element = target as HTMLElement | null;
    if (!element || typeof element.tagName !== "string") {
        return false;
    }
    const tag = element.tagName.toLowerCase();
    return tag === "input" || tag === "textarea" || tag === "select" || element.isContentEditable === true;
}
