"use client";

import { useState, useEffect, useRef } from "react";

/**
 * Detects whether the iOS virtual keyboard is likely open by tracking
 * focus/blur on text input elements. Uses a debounced blur to prevent
 * flicker when focus moves between inputs.
 */
export function useKeyboardOpen(): boolean {
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function isTextInput(el: EventTarget | null): boolean {
      if (!el || !(el instanceof HTMLElement)) return false;
      if (el instanceof HTMLTextAreaElement) return true;
      if (el instanceof HTMLInputElement) {
        const type = el.type.toLowerCase();
        return ["text", "email", "search", "url", "tel", "password", "number"].includes(type);
      }
      if (el.isContentEditable) return true;
      return false;
    }

    function handleFocusIn(e: FocusEvent) {
      if (isTextInput(e.target)) {
        if (blurTimeoutRef.current) {
          clearTimeout(blurTimeoutRef.current);
          blurTimeoutRef.current = null;
        }
        setKeyboardOpen(true);
      }
    }

    function handleFocusOut(e: FocusEvent) {
      if (isTextInput(e.target)) {
        blurTimeoutRef.current = setTimeout(() => {
          setKeyboardOpen(false);
          blurTimeoutRef.current = null;
        }, 100);
      }
    }

    document.addEventListener("focusin", handleFocusIn);
    document.addEventListener("focusout", handleFocusOut);

    return () => {
      document.removeEventListener("focusin", handleFocusIn);
      document.removeEventListener("focusout", handleFocusOut);
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
      }
    };
  }, []);

  return keyboardOpen;
}
