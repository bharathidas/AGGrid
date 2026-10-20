import {
    detailRowId,
    initialExpanded,
    numberRows,
    placeDetailRows,
    toggleExpanded,
    withDetailRows
} from "../utils/detailRows";
import { GridRow } from "../utils/rows";

const row = (id: string, extra: Partial<GridRow> = {}): GridRow => ({
    id,
    item: { id } as any,
    cells: { col0: { value: id, display: id, readOnly: true } },
    ...extra
});

describe("detail rows", () => {
    it("inserts a detail row after every expanded row, sharing the parent's cells", () => {
        const rows = [row("a"), row("b"), row("c")];
        expect(withDetailRows(rows, new Set())).toBe(rows);
        const result = withDetailRows(rows, new Set(["a", "c"]));
        expect(result.map(r => r.id)).toEqual(["a", detailRowId("a"), "b", "c", detailRowId("c")]);
        const detail = result[1];
        expect(detail.detail).toBe(true);
        expect(detail.parentId).toBe("a");
        expect(detail.cells).toBe(rows[0].cells);
        expect(detail.item).toBe(rows[0].item);
    });

    it("never adds details to totals rows", () => {
        const result = withDetailRows([row("t", { totals: true })], new Set(["t"]));
        expect(result).toHaveLength(1);
    });

    it("moves detail rows back under their parent after sorting", () => {
        const a = row("a");
        const b = row("b");
        const da = { ...row(detailRowId("a")), detail: true, parentId: "a" };
        const db = { ...row(detailRowId("b")), detail: true, parentId: "b" };
        const nodes = [da, b, db, a].map(data => ({ data }));
        placeDetailRows(nodes, node => node.data);
        expect(nodes.map(node => node.data.id)).toEqual(["b", detailRowId("b"), "a", detailRowId("a")]);
    });

    it("leaves an already ordered list untouched and keeps orphans at the end", () => {
        const orphan = { ...row("x__d"), detail: true, parentId: "gone" };
        const nodes = [{ data: row("a") }, { data: orphan }, { data: row("b") }];
        const copy = [...nodes];
        placeDetailRows(nodes, node => node.data);
        expect(nodes.map(node => node.data.id)).toEqual(["a", "b", "x__d"]);
        const ordered = [{ data: row("a") }, { data: row("b") }];
        const before = [...ordered];
        placeDetailRows(ordered, node => node.data);
        expect(ordered).toEqual(before);
        expect(copy).toHaveLength(3);
    });

    it("toggles in single and multiple mode", () => {
        expect([...toggleExpanded(new Set(), "a", "single")]).toEqual(["a"]);
        expect([...toggleExpanded(new Set(["a"]), "b", "single")]).toEqual(["b"]);
        expect([...toggleExpanded(new Set(["a"]), "a", "single")]).toEqual([]);
        expect([...toggleExpanded(new Set(["a"]), "b", "multiple")].sort()).toEqual(["a", "b"]);
        expect([...toggleExpanded(new Set(["a", "b"]), "a", "multiple")]).toEqual(["b"]);
    });

    it("starts collapsed or expanded", () => {
        expect(initialExpanded(["a", "b"], "single", true).size).toBe(0);
        expect([...initialExpanded(["a", "b"], "single", false)]).toEqual(["a"]);
        expect([...initialExpanded(["a", "b"], "multiple", false)]).toEqual(["a", "b"]);
        expect(initialExpanded([], "multiple", false).size).toBe(0);
    });

    it("numbers rows without counting detail rows", () => {
        const nodes = [row("a"), { ...row("a__d"), detail: true }, row("b")].map(data => ({ data }));
        const numbers = numberRows(nodes, node => node.data);
        expect(numbers.get("a")).toBe(1);
        expect(numbers.get("b")).toBe(2);
        expect(numbers.has("a__d")).toBe(false);
    });
});
