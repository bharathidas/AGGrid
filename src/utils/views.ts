import type { ColumnState } from "ag-grid-community";

import type { FilterModel } from "./serverFilters";

/** Everything a saved view restores: the column layout, the filters and the quick search text. */
export interface ViewState {
    /** Column configuration the view was saved for (see stateSignatureFor in AGGrid.tsx). */
    signature?: string;
    columns?: ColumnState[];
    filters?: FilterModel;
    quickFilter?: string;
    /** Grouped column ids, outermost first (row grouping). */
    groupBy?: string[];
    /** Row density chosen with the density button. */
    density?: string;
    /** Pivot mode and layout (1.3). */
    pivot?: ViewPivot;
    /** Side panel open state and section (1.3). */
    sidePanel?: { open: boolean; tab: string };
    /** Totals functions chosen by the user, per totals row ("top" / "bottom") and column (1.3). */
    totals?: Record<string, Record<string, string>>;
}

export interface ViewPivot {
    active: boolean;
    rows: string[];
    columns: string[];
    values: Array<{ colId: string; fn: string }>;
}

export interface SavedView {
    id: string;
    name: string;
    isDefault?: boolean;
    /** Time of the last save, in milliseconds since 1970. */
    updated?: number;
    state: ViewState;
}

export interface ViewsDocument {
    version: 1;
    views: SavedView[];
}

export const MAX_VIEW_NAME_LENGTH = 60;
const STORAGE_PREFIX = "mxt-aggrid-views:";

export function emptyViews(): ViewsDocument {
    return { version: 1, views: [] };
}

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseView(value: unknown): SavedView | undefined {
    if (!isObject(value) || typeof value.id !== "string" || typeof value.name !== "string") {
        return undefined;
    }
    const name = normalizeViewName(value.name);
    if (!value.id || !name) {
        return undefined;
    }
    const state = isObject(value.state) ? value.state : {};
    return {
        id: value.id,
        name,
        isDefault: value.isDefault === true ? true : undefined,
        updated: typeof value.updated === "number" ? value.updated : undefined,
        state: {
            signature: typeof state.signature === "string" ? state.signature : undefined,
            columns: Array.isArray(state.columns) ? (state.columns as ColumnState[]) : undefined,
            filters: isObject(state.filters) ? (state.filters as FilterModel) : undefined,
            quickFilter: typeof state.quickFilter === "string" ? state.quickFilter : undefined,
            groupBy: Array.isArray(state.groupBy)
                ? (state.groupBy as unknown[]).filter((id): id is string => typeof id === "string")
                : undefined,
            density: typeof state.density === "string" ? state.density : undefined,
            pivot: isObject(state.pivot) ? (state.pivot as unknown as ViewPivot) : undefined,
            sidePanel:
                isObject(state.sidePanel) && typeof state.sidePanel.open === "boolean"
                    ? { open: state.sidePanel.open, tab: String(state.sidePanel.tab ?? "columns") }
                    : undefined,
            totals: isObject(state.totals) ? (state.totals as Record<string, Record<string, string>>) : undefined
        }
    };
}

/** Reads a views document; anything unreadable yields an empty document instead of an error. */
export function parseViews(text: string | undefined | null): ViewsDocument {
    if (!text || !text.trim()) {
        return emptyViews();
    }
    try {
        const parsed: unknown = JSON.parse(text);
        const list = Array.isArray(parsed) ? parsed : isObject(parsed) ? parsed.views : undefined;
        if (!Array.isArray(list)) {
            return emptyViews();
        }
        const views: SavedView[] = [];
        const ids = new Set<string>();
        let hasDefault = false;
        list.forEach(entry => {
            const view = parseView(entry);
            if (!view || ids.has(view.id)) {
                return;
            }
            if (view.isDefault) {
                // Only one view can be the default; the first one wins.
                if (hasDefault) {
                    view.isDefault = undefined;
                }
                hasDefault = true;
            }
            ids.add(view.id);
            views.push(view);
        });
        return { version: 1, views };
    } catch {
        return emptyViews();
    }
}

/** Serializes a document; an empty document becomes an empty string so the attribute is cleared. */
export function serializeViews(doc: ViewsDocument): string {
    return doc.views.length === 0 ? "" : JSON.stringify(doc);
}

export function normalizeViewName(name: string): string {
    return name.replace(/\s+/g, " ").trim().slice(0, MAX_VIEW_NAME_LENGTH);
}

export function findViewByName(doc: ViewsDocument, name: string, exceptId?: string): SavedView | undefined {
    const wanted = normalizeViewName(name).toLocaleLowerCase();
    return doc.views.find(view => view.id !== exceptId && view.name.toLocaleLowerCase() === wanted);
}

export function findView(doc: ViewsDocument, id: string | undefined): SavedView | undefined {
    return id ? doc.views.find(view => view.id === id) : undefined;
}

export function defaultView(doc: ViewsDocument): SavedView | undefined {
    return doc.views.find(view => view.isDefault);
}

/** Problem with a proposed view name, or undefined when the name can be used. */
export function viewNameProblem(doc: ViewsDocument, name: string, exceptId?: string): string | undefined {
    if (!normalizeViewName(name)) {
        return "Enter a name.";
    }
    if (findViewByName(doc, name, exceptId)) {
        return "A view with this name already exists.";
    }
    return undefined;
}

/**
 * Saves the state under a name. Saving under the name of an existing view (ignoring case) replaces that
 * view's state and keeps its id and default flag.
 */
export function saveView(
    doc: ViewsDocument,
    name: string,
    state: ViewState,
    makeId: () => string,
    now: number
): { doc: ViewsDocument; view: SavedView } {
    const normalized = normalizeViewName(name);
    const existing = findViewByName(doc, normalized);
    if (existing) {
        const view: SavedView = { ...existing, name: normalized, state, updated: now };
        return { doc: { version: 1, views: doc.views.map(v => (v.id === existing.id ? view : v)) }, view };
    }
    const view: SavedView = { id: makeId(), name: normalized, state, updated: now };
    return { doc: { version: 1, views: [...doc.views, view] }, view };
}

export function updateViewState(doc: ViewsDocument, id: string, state: ViewState, now: number): ViewsDocument {
    return { version: 1, views: doc.views.map(view => (view.id === id ? { ...view, state, updated: now } : view)) };
}

/** Renames a view; returns the document unchanged when the name is empty or already used by another view. */
export function renameView(doc: ViewsDocument, id: string, name: string): ViewsDocument {
    if (viewNameProblem(doc, name, id)) {
        return doc;
    }
    const normalized = normalizeViewName(name);
    return { version: 1, views: doc.views.map(view => (view.id === id ? { ...view, name: normalized } : view)) };
}

export function deleteView(doc: ViewsDocument, id: string): ViewsDocument {
    return { version: 1, views: doc.views.filter(view => view.id !== id) };
}

/** Makes the view the default one, or removes the default flag when it already is the default. */
export function toggleDefaultView(doc: ViewsDocument, id: string): ViewsDocument {
    const makeDefault = !findView(doc, id)?.isDefault;
    return {
        version: 1,
        views: doc.views.map(view => {
            const isDefault = makeDefault && view.id === id ? true : undefined;
            return view.isDefault === isDefault ? view : { ...view, isDefault };
        })
    };
}

/** A view saved for another column configuration cannot restore the column layout and filters. */
export function viewMatchesColumns(view: SavedView, signature: string): boolean {
    return !view.state.signature || view.state.signature === signature;
}

export function viewsStorageKey(viewsKey: string | undefined, widgetName: string): string {
    return STORAGE_PREFIX + (viewsKey?.trim() || widgetName);
}

/** Id for a new view from a time stamp and a counter (no randomness, so ids are reproducible in tests). */
export function newViewId(now: number, counter: number): string {
    return `v${now.toString(36)}${counter.toString(36)}`;
}

/** Compact, order-insensitive comparison key for a view state, used to tell whether the grid differs from a view. */
export function viewStateKey(state: ViewState | undefined): string {
    if (!state) {
        return "";
    }
    const columns = (state.columns ?? []).map(column => [
        column.colId,
        column.hide ? 1 : 0,
        column.pinned ?? "",
        column.sort ?? "",
        column.sortIndex ?? "",
        // Flex columns change width with the window; only their flex share is part of the layout.
        column.flex ? `f${column.flex}` : Math.round(column.width ?? 0)
    ]);
    return JSON.stringify([
        columns,
        state.filters ?? {},
        state.quickFilter ?? "",
        state.groupBy ?? [],
        state.density ?? "",
        state.pivot ?? null,
        state.sidePanel ?? null,
        state.totals ?? null
    ]);
}
