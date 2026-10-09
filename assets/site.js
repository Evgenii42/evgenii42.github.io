document.documentElement.classList.add("js");
// Keep long-form content close to the first screen on phones. Native details
// remains usable without JS, and subsequent user choices survive resizing.
if (window.matchMedia("(max-width: 700px)").matches) {
  document.querySelector("[data-story-contents]")?.removeAttribute("open");
}
const lang = document.body.dataset.language;
document.querySelectorAll("[data-language-link]").forEach((link) => {
  link.addEventListener("click", () => {
    const locale = link.dataset.languageLink;
    try {
      localStorage.setItem("cv_language", locale);
    } catch {
      /* Explicit URL still works. */
    }
    try {
      document.cookie = `cv_language=${locale}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
    } catch { /* The explicit language URL works when cookies are blocked. */ }
    const destination = new URL(link.href);
    // The cases module carries validated catalog context in href, including
    // links opened in a new tab. Other pages preserve their ordinary query.
    if (!document.querySelector('[data-cases-library], [data-case-detail]')) destination.search = location.search;
    destination.hash = location.hash;
    link.href = destination.href;
  });
});

function revealHashTarget() {
  let id;
  try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
  const target = document.getElementById(id);
  if (!target) return;
  // Open only the target's ancestors and its own section, never sibling panels.
  let ancestor = target.parentElement;
  while (ancestor) {
    if (ancestor.tagName === 'DETAILS') ancestor.open = true;
    ancestor = ancestor.parentElement;
  }
  if (target.tagName === 'DETAILS') target.open = true;
  target.querySelector(':scope > details[data-home-section]')?.setAttribute('open', '');
  if (!id.startsWith('case-') && !target.classList.contains('home-section')) return;
  target.tabIndex = -1;
  target.focus({ preventScroll: true });
  target.scrollIntoView({ block: "start", behavior: "auto" });
}
revealHashTarget();
window.addEventListener("hashchange", revealHashTarget);

// No analytics request is sent. A host can later subscribe to these named events.
document.querySelectorAll("[data-download]").forEach((link) =>
  link.addEventListener("click", () => {
    window.dispatchEvent(
      new CustomEvent("portfolio:download", {
        detail: { language: lang, variant: link.dataset.download },
      }),
    );
  }),
);
