import { useEffect, useRef } from "react";
export function useInterval(fn, delay, enabled = true) {
  const saved = useRef(fn);
  useEffect(() => { saved.current = fn }, [fn]);
  useEffect(() => {
    if (!enabled || delay == null) return;
    const id = setInterval(() => saved.current(), delay);
    return () => clearInterval(id);
  }, [delay, enabled]);
}
