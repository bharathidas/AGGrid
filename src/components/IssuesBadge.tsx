import { ReactElement } from "react";

import { WarningIcon } from "./Icons";

export interface IssuesBadgeProps {
    text: string;
    count: number;
    /** Number of changed objects whose commit is held until their issues are fixed. */
    held: number;
    onNext: () => void;
}

/** Toolbar badge with the number of invalid cells; a click (or F8) moves the focus to the next one. */
export function IssuesBadge(props: IssuesBadgeProps): ReactElement | null {
    if (props.count === 0 && props.held === 0) {
        return null;
    }
    const heldText = props.held > 0 ? `${props.held} unsaved` : "";
    return (
        <button
            type="button"
            className="mxt-ag-issues"
            title="Go to the next issue (F8)"
            aria-label={`${props.text}${heldText ? `, ${heldText}` : ""}. Go to the next issue.`}
            onClick={props.onNext}
            disabled={props.count === 0}
        >
            <WarningIcon />
            <span key={props.count} className="mxt-ag-issues__text">
                {props.text}
            </span>
            {heldText && <span className="mxt-ag-issues__held">{heldText}</span>}
        </button>
    );
}
