document.documentElement.classList.add("js");
// Keep long-form content close to the first screen on phones. Native details
// remains usable without JS, and subsequent user choices survive resizing.
if (window.matchMedia("(max-width: 700px)").matches) {
  document.querySelector("[data-story-contents]")?.removeAttribute("open");
}
document.querySelectorAll("[data-step-content]").forEach((item) => {
  item.hidden = item.dataset.stepContent !== "0";
});
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
    destination.search = location.search;
    destination.hash = location.hash;
    link.href = destination.href;
  });
});

const steps = [...document.querySelectorAll('[data-step]')];
document.querySelector('.process-controls')?.setAttribute('role', 'tablist');
function selectStep(button) {
  steps.forEach(item => {
    item.setAttribute('aria-selected', String(item === button));
    item.tabIndex = item === button ? 0 : -1;
  });
  document.querySelectorAll('[data-step-content]').forEach(item => {
    item.hidden = item.dataset.stepContent !== button.dataset.step;
  });
}
steps.forEach((button, index) => {
  button.id = `process-tab-${index}`;
  button.setAttribute('role', 'tab');
  button.removeAttribute('aria-pressed');
  button.setAttribute('aria-controls', `process-panel-${index}`);
  const panel = document.querySelector(`[data-step-content="${index}"]`);
  panel.id = `process-panel-${index}`;
  panel.setAttribute('role', 'tabpanel');
  panel.setAttribute('aria-labelledby', button.id);
  panel.tabIndex = 0;
  button.addEventListener('click', () => selectStep(button));
  button.addEventListener('keydown', event => {
    let next;
    if (event.key === 'ArrowRight') next = (index + 1) % steps.length;
    if (event.key === 'ArrowLeft') next = (index + steps.length - 1) % steps.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = steps.length - 1;
    if (next === undefined) return;
    event.preventDefault();
    selectStep(steps[next]);
    steps[next].focus();
  });
});
if (steps.length) selectStep(steps[0]);

const cards = [...document.querySelectorAll("[data-tags]")];
document.querySelectorAll("[data-filter]").forEach((button) => {
  button.addEventListener("click", () => {
    document
      .querySelectorAll("[data-filter]")
      .forEach((item) =>
        item.setAttribute("aria-pressed", String(item === button)),
      );
    const selected = button.dataset.filter;
    cards.forEach((card) => {
      card.hidden =
        selected !== "all" && !card.dataset.tags.split(" ").includes(selected);
    });
    const status = document.querySelector(".filter-status");
    status.textContent = `${status.dataset.countLabel}: ${cards.filter((card) => !card.hidden).length}`;
  });
});

function revealCaseHash() {
  const id = location.hash.slice(1);
  if (!id.startsWith("case-")) return;
  const card = document.getElementById(id);
  if (!card) return;
  document.querySelector('[data-filter="all"]')?.click();
  const details = card.querySelector("details");
  if (details) details.open = true;
  card.tabIndex = -1;
  card.focus({ preventScroll: true });
  card.scrollIntoView({ block: "start", behavior: "auto" });
}
revealCaseHash();
window.addEventListener("hashchange", revealCaseHash);

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
