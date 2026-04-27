"use client";

import { useEffect } from "react";

export function ReloadDebug() {
  useEffect(() => {
    const sid = Math.random().toString(36).slice(2, 8);
    const mountedAt = new Date().toISOString();
    const log = (ev: string, data?: Record<string, unknown>) =>
      console.info(`[reload-debug] ${ev}`, { sid, t: new Date().toISOString(), url: location.href, ...data });

    log("mount", { mountedAt, nav: performance.getEntriesByType("navigation")[0] });

    const onBeforeUnload = () => log("beforeunload");
    const onPageHide = (e: PageTransitionEvent) => log("pagehide", { persisted: e.persisted });
    const onVisibility = () => log("visibilitychange", { state: document.visibilityState });
    const onStorage = (e: StorageEvent) => log("storage", { key: e.key, newValue: e.newValue, oldValue: e.oldValue, storageArea: e.storageArea === localStorage ? "local" : "session" });
    const onFocus = () => log("focus");
    const onBlur = () => log("blur");

    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", onFocus);
    window.addEventListener("blur", onBlur);

    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  return null;
}
