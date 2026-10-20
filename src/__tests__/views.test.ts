import {
    defaultView,
    deleteView,
    emptyViews,
    findViewByName,
    newViewId,
    normalizeViewName,
    parseViews,
    renameView,
    saveView,
    serializeViews,
    toggleDefaultView,
    updateViewState,
    viewMatchesColumns,
    viewNameProblem,
    viewStateKey,
    viewsStorageKey,
    ViewState
} from "../utils/views";

const state = (quickFilter = ""): ViewState => ({
    signature: "sig",
    columns: [{ colId: "col0", width: 120, hide: false, pinned: null, sort: "asc", sortIndex: 0 }],
    filters: { col0: { filterType: "text", type: "contains", filter: "a" } } as any,
    quickFilter
});

let counter = 0;
const makeId = (): string => newViewId(1000, ++counter);

describe("saved views", () => {
    it("parses empty, corrupt and legacy input to a safe document", () => {
        expect(parseViews(undefined)).toEqual(emptyViews());
        expect(parseViews("")).toEqual(emptyViews());
        expect(parseViews("{not json")).toEqual(emptyViews());
        expect(parseViews('{"views": 3}')).toEqual(emptyViews());
        // A bare array of views is accepted too.
        expect(parseViews('[{"id":"a","name":"A","state":{}}]').views).toHaveLength(1);
    });

    it("drops invalid entries, duplicate ids and extra default flags", () => {
        const doc = parseViews(
            JSON.stringify({
                version: 1,
                views: [
                    { id: "a", name: " First  view ", isDefault: true, state: { quickFilter: "x", columns: "bad" } },
                    { id: "a", name: "Duplicate id", state: {} },
                    { id: "b", name: "Second", isDefault: true, state: {} },
                    { id: "", name: "No id", state: {} },
                    { name: "Missing id" },
                    "garbage"
                ]
            })
        );
        expect(doc.views.map(view => view.id)).toEqual(["a", "b"]);
        expect(doc.views[0].name).toBe("First view");
        expect(doc.views[0].state.columns).toBeUndefined();
        expect(doc.views[0].state.quickFilter).toBe("x");
        expect(doc.views[1].isDefault).toBeUndefined();
    });

    it("round-trips through serialization and clears the attribute when empty", () => {
        const { doc } = saveView(emptyViews(), "Mine", state("abc"), makeId, 5);
        expect(parseViews(serializeViews(doc))).toEqual(doc);
        expect(serializeViews(emptyViews())).toBe("");
    });

    it("saves new views and overwrites a view with the same name (ignoring case)", () => {
        const first = saveView(emptyViews(), "Sales", state("one"), makeId, 1);
        const second = saveView(first.doc, "sales", state("two"), makeId, 2);
        expect(second.doc.views).toHaveLength(1);
        expect(second.view.id).toBe(first.view.id);
        expect(second.view.state.quickFilter).toBe("two");
        expect(second.view.updated).toBe(2);
        const third = saveView(second.doc, "Support", state(), makeId, 3);
        expect(third.doc.views.map(view => view.name)).toEqual(["sales", "Support"]);
    });

    it("validates names", () => {
        const { doc } = saveView(emptyViews(), "Sales", state(), makeId, 1);
        expect(viewNameProblem(doc, "   ")).toBe("Enter a name.");
        expect(viewNameProblem(doc, "SALES")).toBe("A view with this name already exists.");
        expect(viewNameProblem(doc, "SALES", doc.views[0].id)).toBeUndefined();
        expect(viewNameProblem(doc, "Other")).toBeUndefined();
        expect(normalizeViewName("x".repeat(100))).toHaveLength(60);
        expect(findViewByName(doc, " sales ")?.id).toBe(doc.views[0].id);
    });

    it("renames, updates and deletes", () => {
        let { doc } = saveView(emptyViews(), "A", state(), makeId, 1);
        doc = saveView(doc, "B", state(), makeId, 1).doc;
        const [a, b] = doc.views;
        expect(renameView(doc, a.id, "B")).toBe(doc); // duplicate name: unchanged
        doc = renameView(doc, a.id, "Renamed");
        expect(doc.views[0].name).toBe("Renamed");
        doc = updateViewState(doc, b.id, state("new"), 9);
        expect(doc.views[1].state.quickFilter).toBe("new");
        expect(doc.views[1].updated).toBe(9);
        doc = deleteView(doc, a.id);
        expect(doc.views.map(view => view.id)).toEqual([b.id]);
    });

    it("keeps at most one default view", () => {
        let { doc } = saveView(emptyViews(), "A", state(), makeId, 1);
        doc = saveView(doc, "B", state(), makeId, 1).doc;
        const [a, b] = doc.views;
        doc = toggleDefaultView(doc, a.id);
        expect(defaultView(doc)?.id).toBe(a.id);
        doc = toggleDefaultView(doc, b.id);
        expect(defaultView(doc)?.id).toBe(b.id);
        expect(doc.views.filter(view => view.isDefault)).toHaveLength(1);
        doc = toggleDefaultView(doc, b.id);
        expect(defaultView(doc)).toBeUndefined();
    });

    it("tells whether a view fits the current columns", () => {
        const { view } = saveView(emptyViews(), "A", state(), makeId, 1);
        expect(viewMatchesColumns(view, "sig")).toBe(true);
        expect(viewMatchesColumns(view, "other")).toBe(false);
        expect(viewMatchesColumns({ ...view, state: {} }, "other")).toBe(true);
    });

    it("compares layouts while ignoring the width of flex columns", () => {
        const base = state();
        const resized: ViewState = { ...base, columns: [{ ...base.columns![0], width: 300 }] };
        expect(viewStateKey(base)).not.toBe(viewStateKey(resized));
        const flexA: ViewState = { ...base, columns: [{ colId: "col0", flex: 1, width: 100 }] };
        const flexB: ViewState = { ...base, columns: [{ colId: "col0", flex: 1, width: 400 }] };
        expect(viewStateKey(flexA)).toBe(viewStateKey(flexB));
        expect(viewStateKey({ ...base, quickFilter: "x" })).not.toBe(viewStateKey(base));
    });

    it("builds storage keys and ids", () => {
        expect(viewsStorageKey("", "grid1")).toBe("mxt-aggrid-views:grid1");
        expect(viewsStorageKey("  shared ", "grid1")).toBe("mxt-aggrid-views:shared");
        expect(newViewId(1000, 1)).not.toBe(newViewId(1000, 2));
    });
});
