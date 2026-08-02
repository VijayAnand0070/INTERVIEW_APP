import { useEffect, useState } from "react";

/**
 * Reveals text character-by-character when `active` is true.
 */
export function useTypewriter(text, { active = true, speed = 22 } = {}) {
  const [display, setDisplay] = useState("");

  useEffect(() => {
    if (!active || !text) {
      setDisplay(text || "");
      return undefined;
    }

    setDisplay("");
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setDisplay(text.slice(0, i));
      if (i >= text.length) window.clearInterval(id);
    }, speed);

    return () => window.clearInterval(id);
  }, [text, active, speed]);

  return display;
}
