import { MAX_HIGHLIGHTED_ROWS, diffRows, rowSignature, rowsToHighlight } from "../utils/rowChanges";
import { GridRow } from "../utils/rows";
import { isTypingTarget, rowAsText, shortcutsFor } from "../utils/shortcuts";

const row = (id: string, display: string, extra: Partial<GridRow> = {}): GridRow => ({
    id,
    cells: { col0: { value: display, display, readOnly: true }, col1: { value: 1, display: "1", readOnly: true } },
    ...extra
});

describe("row change highlighting", () => {
    it("reports nothing on the first load", () => {
        const diff = diffRows(undefined, [row("a", "x")]);
        expect(diff.changed).toEqual([]);
        expect(diff.added).toEqual([]);
        expect(diff.snapshot.size).toBe(1);
    });

    it("finds changed and added rows and ignores totals and detail rows", () => {
        const first = diffRows(undefined, [row("a", "x"), row("b", "y")]);
        const second = diffRows(first.snapshot, [
            row("a", "x"),
            row("b", "changed"),
            row("c", "new"),
            row("t", "sum", { totals: true }),
            row("d", "detail", { detail: true })
        ]);
        expect(second.changed).toEqual(["b"]);
        expect(second.added).toEqual(["c"]);
        expect(second.snapshot.has("t")).toBe(false);
        expect(second.snapshot.has("d")).toBe(false);
    });

    it("treats a changed validation message as a change", () => {
        const plain = row("a", "x");
        const invalid: GridRow = { ...plain, cells: { ...plain.cells, col0: { ...plain.cells.col0, error: "Bad" } } };
        expect(rowSignature(plain)).not.toBe(rowSignature(invalid));
    });

    it("skips the user's own edits and mass reloads", () => {
        const diff = { changed: ["a", "b"], added: ["c"], snapshot: new Map() };
        expect(rowsToHighlight(diff, new Set(["b"]))).toEqual(["a", "c"]);
        const many = Array.from({ length: MAX_HIGHLIGHTED_ROWS + 1 }, (_, i) => `r${i}`);
        expect(rowsToHighlight({ changed: many, added: [], snapshot: new Map() }, new Set())).toEqual([]);
    });
});

describe("keyboard helpers", () => {
    it("lists only the shortcuts that apply", () => {
        const minimal = shortcutsFor({
            editing: false,
            undoRedo: false,
            selection: false,
            detail: false,
            validation: false,
            quickSearch: false
        }).map(shortcut => shortcut.keys);
        expect(minimal).toContain("Ctrl+C");
        expect(minimal).not.toContain("F8 / Shift+F8");
        const full = shortcutsFor({
            editing: true,
            undoRedo: true,
            selection: true,
            detail: true,
            validation: true,
            quickSearch: true
        }).map(shortcut => shortcut.keys);
        expect(full).toEqual(expect.arrayContaining(["F8 / Shift+F8", "Alt+Down / Alt+Up", "/", "Ctrl+Z / Ctrl+Y"]));
    });

    it("copies a row as tab separated text", () => {
        const data: GridRow = {
            id: "a",
            cells: {
                col0: { value: "x", display: "Line\none", readOnly: true },
                col1: { value: 1, display: "1\t000", readOnly: true }
            }
        };
        expect(rowAsText(data, ["col0", "col1", "missing"])).toBe("Line one\t1 000\t");
    });

    it("recognizes typing targets", () => {
        expect(isTypingTarget(null)).toBe(false);
        expect(isTypingTarget({ tagName: "INPUT" } as any)).toBe(true);
        expect(isTypingTarget({ tagName: "DIV", isContentEditable: true } as any)).toBe(true);
        expect(isTypingTarget({ tagName: "DIV", isContentEditable: false } as any)).toBe(false);
    });
});
