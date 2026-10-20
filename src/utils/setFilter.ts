import type { GridRow } from "./rows";
import { compareGroupValues } from "./grouping";

/**
 * Set filter (a checklist of the distinct values, AG Grid Enterprise only) on AG Grid Community: the pure parts.
 * The model keeps the *selected* displayed values; "" stands for (Blanks). No model means every value passes.
 */

export const SET_FILTER_TYPE = "set";
export const BLANK_VALUE = "";
/** Values listed at once; longer lists ask the user to search. */
export const MAX_LISTED_VALUES = 500;

export interface SetFilterModel {
    filterType: "set";
    values: string[];
}

export function isSetFilterModel(model: unknown): model is SetFilterModel {
    return (
        typeof model === "object" &&
        model !== null &&
        (model as SetFilterModel).filterType === SET_FILTER_TYPE &&
        Array.isArray((model as SetFilterModel).values)
    );
}

export interface DistinctValues {
    /** Non-blank displayed values in natural order (numbers and dates by value, text ignoring case). */
    values: string[];
    hasBlanks: boolean;
}

/** The distinct displayed values of a column over the data rows. */
export function distinctValues(rows: GridRow[], colId: string, fixed?: string[]): DistinctValues {
    const samples = new Map<string, unknown>();
    let hasBlanks = false;
    rows.forEach(row => {
        const cell = row.cells[colId];
        const display = cell?.display ?? "";
        if (display === "") {
            hasBlanks = true;
        } else if (!samples.has(display)) {
            samples.set(display, cell?.value);
        }
    });
    if (fixed) {
        // Enumerations and booleans list every caption, also when no row uses it (yet).
        fixed.forEach(value => {
            if (!samples.has(value)) {
                samples.set(value, value);
            }
        });
        const order = new Map(fixed.map((value, index) => [value, index]));
        return {
            values: Array.from(samples.keys()).sort(
                (a, b) =>
                    (order.get(a) ?? Number.MAX_SAFE_INTEGER) - (order.get(b) ?? Number.MAX_SAFE_INTEGER) ||
                    a.localeCompare(b)
            ),
            hasBlanks
        };
    }
    return {
        values: Array.from(samples.entries())
            .sort(([a, va], [b, vb]) => compareGroupValues(va, vb) || a.localeCompare(b))
            .map(([display]) => display),
        hasBlanks
    };
}

export function setFilterPasses(model: SetFilterModel | null | undefined, display: string | undefined): boolean {
    if (!model) {
        return true;
    }
    return model.values.includes(display ?? BLANK_VALUE);
}

/** Every value of the list (blanks included when present). */
export function allValues(list: DistinctValues): string[] {
    return list.hasBlanks ? [...list.values, BLANK_VALUE] : [...list.values];
}

/** Normalizes a selection: everything selected means no filter (null). */
export function selectionToModel(selected: Iterable<string>, list: DistinctValues): SetFilterModel | null {
    const all = allValues(list);
    const chosen = new Set(selected);
    if (all.every(value => chosen.has(value))) {
        return null;
    }
    return { filterType: "set", values: all.filter(value => chosen.has(value)) };
}

export function selectedValues(model: SetFilterModel | null | undefined, list: DistinctValues): Set<string> {
    return new Set(model ? model.values : allValues(list));
}

/** Toggles one value; returns the new model (null = everything selected). */
export function toggleSetValue(
    model: SetFilterModel | null | undefined,
    value: string,
    list: DistinctValues
): SetFilterModel | null {
    const selected = selectedValues(model, list);
    if (selected.has(value)) {
        selected.delete(value);
    } else {
        selected.add(value);
    }
    return selectionToModel(selected, list);
}

/**
 * (Select all) for the values that match the search: selects them all, or deselects them all when they are all
 * selected already. Without a search this selects or clears the whole list.
 */
export function toggleAllMatching(
    model: SetFilterModel | null | undefined,
    matching: string[],
    list: DistinctValues
): SetFilterModel | null {
    const selected = selectedValues(model, list);
    const allOn = matching.every(value => selected.has(value));
    matching.forEach(value => (allOn ? selected.delete(value) : selected.add(value)));
    return selectionToModel(selected, list);
}

export function matchingValues(list: DistinctValues, search: string, blanksLabel: string): string[] {
    const needle = search.trim().toLocaleLowerCase();
    const values = allValues(list);
    if (!needle) {
        return values;
    }
    return values.filter(value => (value === BLANK_VALUE ? blanksLabel : value).toLocaleLowerCase().includes(needle));
}

/** Short text of a model for the floating filter: "", a single value, or "3 of 10". */
export function setFilterSummary(model: SetFilterModel | null | undefined, total: number, blanksLabel: string): string {
    if (!model) {
        return "";
    }
    if (model.values.length === 1) {
        return model.values[0] === BLANK_VALUE ? blanksLabel : model.values[0];
    }
    return `${model.values.length} / ${total}`;
}
