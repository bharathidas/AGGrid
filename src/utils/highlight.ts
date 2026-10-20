/**
 * Marks quick search matches in the rendered cells with the CSS Custom Highlight API, so no cell markup
 * changes and AG Grid's own rendering stays untouched. Browsers without the API show no marks.
 */

export const HIGHLIGHT_NAME = "mxt-ag-search";

/** Search terms of a quick filter text, as AG Grid splits it (whitespace separated, case-insensitive). */
export function searchTerms(query: string): string[] {
    return Array.from(
        new Set(
            query
                .toLowerCase()
                .split(/\s+/)
                .map(term => term.trim())
                .filter(term => term.length > 0)
        )
    );
}

/** Start/end offsets of every term occurrence in the text, merged where they overlap. */
export function findMatches(text: string, terms: string[]): Array<[number, number]> {
    if (!text || terms.length === 0) {
        return [];
    }
    const lower = text.toLowerCase();
    const ranges: Array<[number, number]> = [];
    terms.forEach(term => {
        let from = 0;
        for (;;) {
            const index = lower.indexOf(term, from);
            if (index < 0) {
                break;
            }
            ranges.push([index, index + term.length]);
            from = index + term.length;
        }
    });
    ranges.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const merged: Array<[number, number]> = [];
    ranges.forEach(range => {
        const last = merged[merged.length - 1];
        if (last && range[0] <= last[1]) {
            last[1] = Math.max(last[1], range[1]);
        } else {
            merged.push([range[0], range[1]]);
        }
    });
    return merged;
}

interface HighlightRegistry {
    set: (name: string, highlight: unknown) => void;
    delete: (name: string) => void;
}

type HighlightConstructor = new (...ranges: Range[]) => unknown;

function registry(): { highlights: HighlightRegistry; Highlight: HighlightConstructor } | undefined {
    const css = (window as unknown as { CSS?: { highlights?: HighlightRegistry } }).CSS;
    const Highlight = (window as unknown as { Highlight?: HighlightConstructor }).Highlight;
    return css?.highlights && Highlight ? { highlights: css.highlights, Highlight } : undefined;
}

/** Ranges of every grid instance on the page; the shared highlight is rebuilt from all of them. */
const rangesByInstance = new Map<string, Range[]>();

function publish(): void {
    const api = registry();
    if (!api) {
        return;
    }
    const all: Range[] = [];
    rangesByInstance.forEach(ranges => all.push(...ranges));
    if (all.length === 0) {
        api.highlights.delete(HIGHLIGHT_NAME);
    } else {
        api.highlights.set(HIGHLIGHT_NAME, new api.Highlight(...all));
    }
}

export function supportsHighlights(): boolean {
    return Boolean(registry());
}

/** Highlights the query in the cell values under `root`; returns the number of marked ranges. */
export function highlightSearch(instance: string, root: HTMLElement | null, query: string): number {
    if (!registry()) {
        return 0;
    }
    const terms = searchTerms(query);
    const ranges: Range[] = [];
    if (root && terms.length > 0) {
        root.querySelectorAll(".ag-row .ag-cell").forEach(cell => {
            if (cell.closest(".mxt-ag-cell-custom, .mxt-ag-detail")) {
                return;
            }
            const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT);
            for (let node = walker.nextNode(); node; node = walker.nextNode()) {
                const text = node.nodeValue ?? "";
                findMatches(text, terms).forEach(([start, end]) => {
                    const range = document.createRange();
                    range.setStart(node as Node, start);
                    range.setEnd(node as Node, end);
                    ranges.push(range);
                });
            }
        });
    }
    if (ranges.length === 0 && !rangesByInstance.has(instance)) {
        return 0;
    }
    if (ranges.length === 0) {
        rangesByInstance.delete(instance);
    } else {
        rangesByInstance.set(instance, ranges);
    }
    publish();
    return ranges.length;
}

export function clearSearchHighlight(instance: string): void {
    if (rangesByInstance.delete(instance)) {
        publish();
    }
}
