import { ChangeEvent, ReactElement } from "react";
import { TextFilterModel } from "ag-grid-community";
import { CustomFloatingFilterProps } from "ag-grid-react";

export interface SelectFloatingFilterParams {
    /** Captions offered in the dropdown; the text filter matches on the formatted caption. */
    values: string[];
    emptyCaption?: string;
    /** Data Grid 2 look (dropdown-container classes) instead of the AG Grid input styling. */
    dg2?: boolean;
}

type Props = CustomFloatingFilterProps<TextFilterModel> & SelectFloatingFilterParams;

/** Dropdown floating filter for enumeration and boolean columns, like the Data Grid 2 drop-down filter. */
export function SelectFloatingFilter(props: Props): ReactElement {
    const current = props.model?.type === "equals" && typeof props.model.filter === "string" ? props.model.filter : "";

    const handleChange = (event: ChangeEvent<HTMLSelectElement>): void => {
        const caption = event.target.value;
        props.onModelChange(caption ? { filterType: "text", type: "equals", filter: caption } : null);
    };

    const select = (
        <select
            className={
                props.dg2
                    ? "form-control dropdown-triggerer mxt-ag-select-filter__select"
                    : "ag-input-field-input ag-text-field-input mxt-ag-select-filter__select"
            }
            value={current}
            onChange={handleChange}
            aria-label={`${props.column.getColDef().headerName ?? ""} filter`}
        >
            <option value="">{props.emptyCaption ?? (props.dg2 ? "Select" : "")}</option>
            {props.values.map(value => (
                <option key={value} value={value}>
                    {value}
                </option>
            ))}
        </select>
    );

    return props.dg2 ? (
        <div className="filter-container dropdown-container mxt-ag-select-filter mxt-ag-dg-filter">{select}</div>
    ) : (
        <div className="ag-floating-filter-input mxt-ag-select-filter">{select}</div>
    );
}
