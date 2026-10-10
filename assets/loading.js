// Inlined in the head: no network request before the initial visibility decision.
(() => {
  const root = document.documentElement;
  const pending = new Set(document.currentScript.dataset.pageTasks.split(" "));
  let finished = false;
  function reveal(reason) {
    if (finished) return;
    finished = true;
    clearTimeout(deadline);
    clearTimeout(indicatorDelay);
    root.removeAttribute("data-page-loading");
    root.removeAttribute("data-page-loading-visible");
    root.removeAttribute("aria-busy");
    window.dispatchEvent(new CustomEvent("portfolio:ready", { detail: { reason } }));
  }
  const deadline = setTimeout(() => reveal("timeout"), 1500);
  const indicatorDelay = setTimeout(() => root.setAttribute("data-page-loading-visible", ""), 150);
  window.portfolioLoading = Object.freeze({
    done(task) {
      pending.delete(task);
      if (!pending.size) reveal("ready");
    },
  });
  window.addEventListener("error", event => {
    if (event.target === window || event.target.tagName === "SCRIPT") reveal("error");
  }, true);
  window.addEventListener("unhandledrejection", () => reveal("error"));
  window.addEventListener("pageshow", event => {
    if (event.persisted) reveal("restore");
  });
  root.setAttribute("data-page-loading", "");
  root.setAttribute("aria-busy", "true");
})();
