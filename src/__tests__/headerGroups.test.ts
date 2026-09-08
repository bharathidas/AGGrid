import { ColumnsPreviewType } from "../../typings/AGGridProps";
import { headerGroups, previewColumnGrow } from "../utils/headerGroups";

function column(headerGroup: string, widthMode: "auto" | "flex" | "fixed" = "auto", flex = 1): ColumnsPreviewType {
    return { headerGroup, widthMode, flex } as ColumnsPreviewType;
}

describe("headerGroups", () => {
    it("groups adjacent columns with the same caption", () => {
        const groups = headerGroups([
            column("Profile"),
            column(" Profile "),
            column(""),
            column("Employment", "flex", 2),
            column("Profile")
        ]);
        expect(groups).toEqual([
            { caption: "Profile", span: 2, grow: 2 },
            { caption: "", span: 1, grow: 1 },
            { caption: "Employment", span: 1, grow: 2 },
            { caption: "Profile", span: 1, grow: 1 }
        ]);
    });

    it("keeps ungrouped columns separate", () => {
        expect(headerGroups([column(""), column("")])).toHaveLength(2);
    });

    it("uses the flex factor as grow", () => {
        expect(previewColumnGrow(column("", "flex", 3))).toBe(3);
        expect(previewColumnGrow(column("", "fixed", 3))).toBe(1);
    });
});
