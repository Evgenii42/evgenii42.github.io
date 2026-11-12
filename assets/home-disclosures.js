// Keep direct and history links to supplementary home content in view.
function revealNeed() {
  let id;
  try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
  const target = document.getElementById(id);
  const isNeed = target?.matches('.employer-need');
  const isOverview = target?.matches('#needs.employer-needs');
  if ((!isNeed && !isOverview) || !target.closest('.work-approach')) return;
  for (let ancestor = target; ancestor; ancestor = ancestor.parentElement) {
    if (ancestor.tagName === 'DETAILS') ancestor.open = true;
  }
  requestAnimationFrame(() => {
    target.scrollIntoView({ block: 'start' });
    const focusTarget = target.querySelector(isNeed ? 'summary' : 'h2');
    if (isOverview && focusTarget) focusTarget.tabIndex = -1;
    focusTarget?.focus({ preventScroll: true });
  });
}

revealNeed();
window.addEventListener('hashchange', revealNeed);
