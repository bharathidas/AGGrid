import {
    AG_GRID_LOCALE_BR,
    AG_GRID_LOCALE_CN,
    AG_GRID_LOCALE_DE,
    AG_GRID_LOCALE_EN,
    AG_GRID_LOCALE_ES,
    AG_GRID_LOCALE_FR,
    AG_GRID_LOCALE_IT,
    AG_GRID_LOCALE_JP,
    AG_GRID_LOCALE_NL,
    AG_GRID_LOCALE_PL,
    AG_GRID_LOCALE_PT,
    AG_GRID_LOCALE_TR
} from "@ag-grid-community/locale";

const LOCALES: Record<string, Record<string, string>> = {
    en: AG_GRID_LOCALE_EN,
    nl: AG_GRID_LOCALE_NL,
    de: AG_GRID_LOCALE_DE,
    fr: AG_GRID_LOCALE_FR,
    es: AG_GRID_LOCALE_ES,
    it: AG_GRID_LOCALE_IT,
    pt: AG_GRID_LOCALE_PT,
    "pt-br": AG_GRID_LOCALE_BR,
    pl: AG_GRID_LOCALE_PL,
    tr: AG_GRID_LOCALE_TR,
    ja: AG_GRID_LOCALE_JP,
    zh: AG_GRID_LOCALE_CN
};

/** The language code of the current Mendix session, e.g. "nl_NL". */
export function sessionLocale(): string {
    const mx = (window as unknown as { mx?: { session?: { getConfig?: (key: string) => unknown } } }).mx;
    const fromSession = mx?.session?.getConfig?.("locale");
    if (typeof fromSession === "string" && fromSession) {
        return fromSession;
    }
    return document.documentElement.lang || navigator.language || "en_US";
}

/** AG Grid texts (filter menus, pager, overlays) for the Mendix session language; English is the AG Grid default. */
export function localeTextFor(locale: string): Record<string, string> | undefined {
    const [language, region] = locale.toLowerCase().split(/[_-]/);
    return LOCALES[`${language}-${region}`] ?? LOCALES[language];
}

/** The session language as a BCP 47 tag for Intl ("nl_NL" becomes "nl-NL"); undefined when Intl rejects it. */
export function intlLocale(): string | undefined {
    const tag = sessionLocale().replace(/_/g, "-");
    try {
        return Intl.getCanonicalLocales(tag)[0];
    } catch {
        return undefined;
    }
}
