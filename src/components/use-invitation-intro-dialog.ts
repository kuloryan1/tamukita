"use client";

import { useEffect, useEffectEvent, type RefObject } from "react";

const focusableSelector = 'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Keeps either opening film modal without coupling it to a particular renderer. */
export function useInvitationIntroDialog(dialogRef: RefObject<HTMLElement | null>, active: boolean, onSkip: () => void) {
  const skip = useEffectEvent(onSkip);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!active || !dialog) return;

    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.documentElement.style.overflow;
    const backgrounds = new Map<HTMLElement, boolean>();
    // Every sibling outside the dialog, including a surrounding site's header,
    // must be unavailable to keyboard and assistive-technology navigation.
    let branch: HTMLElement = dialog;
    while (branch.parentElement) {
      for (const sibling of branch.parentElement.children) {
        if (sibling !== branch && sibling instanceof HTMLElement) backgrounds.set(sibling, sibling.inert);
      }
      if (branch.parentElement === document.body) break;
      branch = branch.parentElement;
    }
    for (const element of backgrounds.keys()) element.inert = true;
    document.documentElement.style.overflow = "hidden";

    const focusable = () => Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector))
      .filter((element) => !element.closest("[hidden], [inert]") && element.getClientRects().length > 0);
    const focusFirst = () => (focusable()[0] ?? dialog).focus({ preventScroll: true });

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        skip();
      } else if (event.key === "Tab") {
        const elements = focusable();
        const first = elements[0];
        const last = elements[elements.length - 1];
        if (!first || !last) {
          event.preventDefault();
          dialog?.focus({ preventScroll: true });
        } else if (event.shiftKey && (document.activeElement === first || !dialog?.contains(document.activeElement))) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && (document.activeElement === last || !dialog?.contains(document.activeElement))) {
          event.preventDefault();
          first.focus();
        }
      }
    }
    function handleFocus(event: FocusEvent) {
      if (event.target instanceof Node && !dialog?.contains(event.target)) focusFirst();
    }

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("focusin", handleFocus);
    focusFirst();
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("focusin", handleFocus);
      for (const [element, previousInert] of backgrounds) element.inert = previousInert;
      document.documentElement.style.overflow = previousOverflow;
      if (previousFocus?.isConnected && !previousFocus.closest("[inert]")) previousFocus.focus({ preventScroll: true });
    };
  }, [active, dialogRef]);
}
