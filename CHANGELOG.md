# Changelog

All notable changes to the AGGrid widget are documented here.

## [1.0.0] - 2026-09-08

First public release.

### Data

- Data source: database, XPath, association, microflow or nanoflow. Browser data loading (all rows once, optionally capped, refreshed on an interval) or Server data loading (the data source pages, sorts and filters like Data Grid 2, so any number of rows works).
- Columns show an attribute, a dynamic text expression per row or custom content (any widgets per row); attribute columns render as text, link, badge, progress bar or image. Header groups, tooltips, cell class and row class expressions.
- Enumeration, boolean, date and number cells are formatted and edited with the Mendix formatter, captions and editors.

### Interaction

- Sorting on several columns, floating filters (text, number, date, enumeration and boolean) with the Data Grid 2 operator menu in the Atlas theme, quick search (optionally driven by an attribute), pagination with page size choices and automatic page size.
- Inline editing with single or double click, undo and redo, Enter moves down, flashing of changed cells and Mendix validation on the cell. Commit modes: keep in client, commit directly, or run an On commit action that receives the changed object plus the New value, Old value and Attribute name variables.
- Selection (none, single, multi) through the Mendix selection API with checkboxes, select all and select on row click, plus a selection counter with Clear.
- Column pinning, visibility, resizing and reordering, a Columns chooser, auto size strategies, and a remembered layout in browser storage or in a String attribute.
- Row drag with an order attribute that receives the new position.

### Presentation

- Atlas theme that looks like Data Grid 2 (default), or the AG Grid Quartz, Alpine, Balham and Material themes in light, dark or automatic color scheme with accent color, font size and spacing.
- Totals row at the top or bottom with Sum, Average, Minimum, Maximum and Count, or values from a totals data source aggregated on the server.
- Excel (.xlsx with real numbers, dates and booleans, bold frozen header and auto filter) and CSV export of the filtered and sorted rows; in Server mode all matching rows are fetched first.
- Toolbar buttons with inline icons and translatable labels; AG Grid texts follow the Mendix session language for eleven languages.
- Studio Pro preview with Data Grid 2 markup, marketplace icons and tiles, unit tests for the server filters, Excel writer, totals and header groups.
