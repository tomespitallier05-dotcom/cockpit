"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ALL_NAV } from "./nav-config";
import { useShell } from "./shell-provider";

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

/**
 * Global keyboard shortcuts, Linear-style:
 * ⌘K / Ctrl+K or "/" opens the palette, "C" captures, "G" then a letter navigates.
 */
export function Hotkeys() {
  const router = useRouter();
  const { paletteOpen, togglePalette, capture } = useShell();

  useEffect(() => {
    let awaitingSecondKey = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    function onKeyDown(event: KeyboardEvent) {
      const key = event.key.toLowerCase();

      if ((event.metaKey || event.ctrlKey) && key === "k") {
        event.preventDefault();
        togglePalette();
        return;
      }

      if (
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        paletteOpen ||
        isTypingTarget(event.target) ||
        document.querySelector("[role='menu'][data-state='open'], [role='dialog'][data-state='open']")
      ) {
        return;
      }

      if (awaitingSecondKey) {
        awaitingSecondKey = false;
        clearTimeout(timer);
        const item = ALL_NAV.find((navItem) => navItem.shortcut === key);
        if (item) {
          event.preventDefault();
          router.push(item.href);
        }
        return;
      }

      if (key === "g") {
        awaitingSecondKey = true;
        timer = setTimeout(() => (awaitingSecondKey = false), 900);
      } else if (key === "c") {
        event.preventDefault();
        capture();
      } else if (key === "/") {
        event.preventDefault();
        togglePalette();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      clearTimeout(timer);
    };
  }, [router, paletteOpen, togglePalette, capture]);

  return null;
}
