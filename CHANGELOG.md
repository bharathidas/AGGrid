# Changelog

All notable changes to the AGGrid widget are documented here.

## [1.1.2] - 2026-09-08

### Fixed

- Server data loading: the first page stayed on "1 to ? of More" when the data source already held the requested page (for example after Mendix restored the page state), until a microflow refreshed it. Requests the data source already satisfies now resolve immediately.

## [1.1.1] - 2026-09-08

### Added

- Icons on the toolbar buttons (Refresh, Reset, Export Excel, Export CSV, Columns) and the Clear selection link, rendered as inline SVG in the widget and in the Studio Pro preview. Style them through the `mxt-ag-btn` and `mxt-ag-icon` classes.

### Fixed

- Atlas theme: the arrow of the enumeration and boolean dropdown filters no longer overlaps the selected caption in narrow columns.
- Flex columns keep a minimum width of 120px when Min width is 0, so they no longer collapse once the fixed columns fill the grid.

## [1.1.0] - 2026-09-07

### Added

- Commit setting with three modes: Keep in client, Commit directly, or Run On commit action. The On commit action receives the changed object plus the New value, Old value and Attribute name variables, so a microflow or nanoflow can validate and commit.
- Render as per column: Link, Badge, Progress bar and Image cell renderers next to plain text.
- Totals from a data source: a microflow can aggregate on the server and the totals row shows its attributes per column.
- Remember layout in browser storage (no entity needed) or in an attribute; a remembered layout is discarded when the column configuration changes.
- Translatable labels for the toolbar buttons, selection counter and Atlas pager.
- Attribute name override for inline editing when the attribute cannot be inferred.
- Keyboard support in the Data Grid 2 style filter operator menu.
- Marketplace icons and tiles, unit tests (jest) for the server filters, Excel writer, totals and header groups.

### Changed

- AG Grid modules are registered explicitly instead of AllCommunityModule, which trims the bundle.
- Replaced the Commit on edit checkbox by the Commit setting.

## [1.0.0] - 2026-09-06

### Added

- First release, built on AG Grid Community 36.1 (ag-grid-react).
- Columns from attributes (String, Integer, Long, Decimal, AutoNumber, Boolean, DateTime, Enumeration, HashedString), dynamic text expressions, or custom Mendix content per row.
- Sorting (single and multi column), text, number and date column filters with floating filters, quick search across all columns (optionally driven by a String attribute), and reset button.
- Client-side pagination with page size selector and auto page size.
- Inline editing with type-aware editors (text, number, date, checkbox, enumeration select), cell or full-row edit mode, single-click edit, undo/redo, Enter-moves-down, change flashing, Mendix validation feedback, column and grid level On change actions.
- Row selection (single, multi, checkboxes, header checkbox, click selection) linked to the Mendix selection API and On selection change.
- Column pinning, resizing, reordering, hiding via expression, header groups, fixed/flex/auto widths, auto size strategies, and column state persistence in a String attribute.
- Row drag reordering with an optional order attribute and On row drag end action.
- Totals row (sum, average, min, max, count) pinned top or bottom, computed over the filtered rows.
- Row numbers column, row and cell class expressions, tooltips per column, wrap text, auto row height, header text wrapping, text selection, row and column hover highlight, animations.
- CSV export of the filtered and sorted rows, refresh button, custom no-rows message.
- Default Atlas theme that matches Data Grid 2 (app font, white header, thin row lines, brand color, Data Grid 2 style pager), plus the AG Grid themes Quartz, Alpine, Balham and Material with light, dark or automatic color scheme, accent color, font size and spacing parameters.
- Per-column decimal precision and digit grouping for numeric attributes.
- Excel export (.xlsx written by the widget itself: typed cells, number formats, bold frozen header row, auto filter) next to CSV; server mode exports all matching rows.
- Studio Pro preview that reuses the Data Grid 2 markup and classes, so the page editor shows the grid like a Data Grid 2.
- Server data loading (paged, sorted and filtered by the data source, including quick search), next to browser loading.
- Commit on edit, New value / Old value action variables, own undo/redo stack that survives data refreshes.
- Data Grid 2 style filter row (operator button with icons and menu, dropdown filters for enumeration and boolean columns), Columns button to show/hide columns, selection counter with Clear, refresh interval, empty placeholder widgets, filter and search persistence in the column state attribute, AG Grid texts in the session language.
- Fixed height, auto height and print layouts.
