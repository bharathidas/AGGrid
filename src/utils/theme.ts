import {
    colorSchemeDark,
    colorSchemeLight,
    colorSchemeVariable,
    Theme,
    themeAlpine,
    themeBalham,
    themeMaterial,
    themeQuartz
} from "ag-grid-community";

import { ColorSchemeEnum, ThemeEnum } from "../../typings/AGGridProps";

const BASE_THEMES: Record<ThemeEnum, Theme> = {
    atlas: themeQuartz,
    quartz: themeQuartz,
    alpine: themeAlpine,
    balham: themeBalham,
    material: themeMaterial
};

const COLOR_SCHEMES = {
    light: colorSchemeLight,
    dark: colorSchemeDark,
    auto: colorSchemeVariable
};

/** Atlas UI / Data Grid 2 look: white header, thin gray row lines, the app font and the Atlas brand color. */
const ATLAS_PARAMS: Record<string, unknown> = {
    accentColor: "#264AE5",
    fontFamily: "inherit",
    fontSize: 14,
    headerFontWeight: 600,
    spacing: 8,
    rowHeight: 48,
    headerHeight: 48,
    cellHorizontalPadding: 16,
    columnBorder: false,
    headerColumnBorder: false,
    wrapperBorder: false,
    wrapperBorderRadius: 0,
    borderRadius: 4,
    iconSize: 14,
    focusShadow: "0 0 0 2px rgba(38, 74, 229, 0.25)"
};

const ATLAS_LIGHT_PARAMS: Record<string, unknown> = {
    backgroundColor: "#ffffff",
    foregroundColor: "#0A1325",
    borderColor: "#CED0D3",
    headerBackgroundColor: "#ffffff",
    headerTextColor: "#0A1325",
    oddRowBackgroundColor: "#ffffff",
    rowHoverColor: "#F5F6F6",
    columnHoverColor: "#F5F6F6",
    selectedRowBackgroundColor: "#E6EAFF",
    rangeSelectionBackgroundColor: "#E6EAFF",
    chromeBackgroundColor: "#ffffff",
    inputBorder: { color: "#CED0D3" },
    inputFocusBorder: { color: "#264AE5" },
    checkboxUncheckedBorderColor: "#CED0D3"
};

export interface ThemeOptions {
    theme: ThemeEnum;
    colorScheme: ColorSchemeEnum;
    accentColor: string;
    fontSize: number;
    spacing: number;
    /** Row density chosen with the toolbar density button; undefined keeps the configured spacing. */
    density?: Density;
}

export type Density = "compact" | "normal" | "comfortable";
export const DENSITIES: Density[] = ["compact", "normal", "comfortable"];

/** Row height factor and spacing of every density. */
const DENSITY_SCALE: Record<Density, number> = { compact: 0.75, normal: 1, comfortable: 1.25 };

export function nextDensity(current: Density | undefined): Density {
    const index = DENSITIES.indexOf(current ?? "normal");
    return DENSITIES[(index + 1) % DENSITIES.length];
}

export function isDensity(value: unknown): value is Density {
    return value === "compact" || value === "normal" || value === "comfortable";
}

/** Row height for a density when the page sets a fixed Row height (0 keeps the theme height). */
export function densityRowHeight(rowHeight: number, density: Density | undefined): number {
    return rowHeight > 0 && density ? Math.round(rowHeight * DENSITY_SCALE[density]) : rowHeight;
}

/** Builds an AG Grid Theming API theme from the widget settings. */
export function buildTheme(options: ThemeOptions): Theme {
    const base = BASE_THEMES[options.theme] ?? themeQuartz;
    let theme = base.withPart(COLOR_SCHEMES[options.colorScheme] ?? colorSchemeLight);

    const params: Record<string, unknown> = {};
    if (options.theme === "atlas") {
        Object.assign(params, ATLAS_PARAMS);
        if (options.colorScheme === "light") {
            Object.assign(params, ATLAS_LIGHT_PARAMS);
        }
    }
    if (options.accentColor.trim()) {
        params.accentColor = options.accentColor.trim();
    }
    if (options.fontSize > 0) {
        params.fontSize = options.fontSize;
    }
    if (options.spacing > 0) {
        params.spacing = options.spacing;
    }
    if (options.density && options.density !== "normal") {
        const scale = DENSITY_SCALE[options.density];
        const baseSpacing = typeof params.spacing === "number" ? params.spacing : 8;
        params.spacing = Math.max(2, Math.round(baseSpacing * scale));
        if (typeof params.rowHeight === "number") {
            params.rowHeight = Math.round(params.rowHeight * scale);
        }
    }
    if (Object.keys(params).length > 0) {
        theme = theme.withParams(params);
    }
    return theme;
}
