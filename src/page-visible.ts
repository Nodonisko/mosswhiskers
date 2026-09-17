export function isPageVisible() {
  return typeof document === "undefined" || document.visibilityState !== "hidden";
}

export function watchPageVisible(onChange: (visible: boolean) => void) {
  const notify = () => onChange(isPageVisible());
  const freeze = () => onChange(false);
  document.addEventListener("visibilitychange", notify);
  window.addEventListener("pagehide", notify);
  window.addEventListener("pageshow", notify);
  document.addEventListener("freeze", freeze);
  document.addEventListener("resume", notify);
  return () => {
    document.removeEventListener("visibilitychange", notify);
    window.removeEventListener("pagehide", notify);
    window.removeEventListener("pageshow", notify);
    document.removeEventListener("freeze", freeze);
    document.removeEventListener("resume", notify);
  };
}
