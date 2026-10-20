import { RefObject, useEffect } from "react";

/**
 * Closes an open toolbar popover on Escape (focus returns to its button) and on a click outside of it.
 * Returns a `close` function that also moves the focus back to the button.
 */
export function useDismiss(
    open: boolean,
    setOpen: (open: boolean) => void,
    root: RefObject<HTMLDivElement | null>,
    button: RefObject<HTMLButtonElement | null>
): () => void {
    const close = (): void => {
        setOpen(false);
        button.current?.focus();
    };

    useEffect(() => {
        if (!open) {
            return;
        }
        const outside = (event: MouseEvent): void => {
            if (root.current && !root.current.contains(event.target as Node)) {
                setOpen(false);
            }
        };
        const escape = (event: KeyboardEvent): void => {
            if (event.key === "Escape" && root.current?.contains(document.activeElement)) {
                event.stopPropagation();
                setOpen(false);
                button.current?.focus();
            }
        };
        document.addEventListener("mousedown", outside);
        document.addEventListener("keydown", escape);
        return () => {
            document.removeEventListener("mousedown", outside);
            document.removeEventListener("keydown", escape);
        };
    }, [open, setOpen, root, button]);

    return close;
}

/** Arrow up/down, Home and End move the focus between the menu items of a popover. */
export function moveMenuFocus(container: HTMLElement | null, key: string): boolean {
    if (!container || !["ArrowDown", "ArrowUp", "Home", "End"].includes(key)) {
        return false;
    }
    const items = Array.from(container.querySelectorAll<HTMLElement>("[data-menuitem]")).filter(
        element => !element.hasAttribute("disabled")
    );
    if (items.length === 0) {
        return false;
    }
    const index = items.indexOf(document.activeElement as HTMLElement);
    let next = 0;
    if (key === "ArrowDown") {
        next = index < 0 ? 0 : (index + 1) % items.length;
    } else if (key === "ArrowUp") {
        next = index <= 0 ? items.length - 1 : index - 1;
    } else if (key === "End") {
        next = items.length - 1;
    }
    items[next].focus();
    return true;
}
