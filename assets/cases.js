// Static HTML remains a complete, readable library until initialization succeeds.
const catalog = document.querySelector('[data-cases-library]');
const detail = document.querySelector('[data-case-detail]');
const languageLinks = [...document.querySelectorAll('[data-language-link]')];
const tokens = value => (value || '').split(' ').filter(Boolean);

function updateLanguages(search) {
  languageLinks.forEach(link => {
    const url = new URL(link.href);
    url.search = search;
    link.setAttribute('href', `${url.pathname}${url.search}${url.hash}`);
  });
}
function enableTopics(scope = document) {
  scope.querySelectorAll('[data-topic-link]').forEach(link => { link.hidden = false; });
  scope.querySelectorAll('[data-topic-fallback]').forEach(label => { label.hidden = true; });
}
function selected(params, key, allowed) {
  const values = params.getAll(key);
  if (!values.length) return { value: '', invalid: false };
  if (values.length === 1 && allowed.includes(values[0])) return { value: values[0], invalid: false };
  return { value: '', invalid: true };
}
function contextParams(experience, topic) {
  const params = new URLSearchParams({ from: 'cases' });
  if (experience) params.set('fromExperience', experience);
  if (topic) params.set('fromTopic', topic);
  return params;
}
function linkContext(scope, params) {
  scope.querySelectorAll('[data-story-link]').forEach(link => {
    const url = new URL(link.href);
    url.search = params.toString();
    link.setAttribute('href', `${url.pathname}${url.search}${url.hash}`);
  });
}

if (catalog) {
  const controls = catalog.querySelector('[data-cases-controls]');
  const fallback = catalog.querySelector('[data-cases-fallback]');
  const cards = [...catalog.querySelectorAll('[data-story-card]')];
  const groups = [...catalog.querySelectorAll('[data-case-group]')];
  const experiences = [...catalog.querySelectorAll('[data-case-experience]')];
  const topics = [...catalog.querySelectorAll('[data-case-topic]')];
  const allowedExperiences = experiences.map(button => button.dataset.caseExperience).filter(id => id !== 'all');
  const allowedTopics = topics.map(button => button.dataset.caseTopic).filter(id => id !== 'all');
  const count = catalog.querySelector('[data-case-count]');
  const empty = catalog.querySelector('[data-case-empty]');
  const notice = catalog.querySelector('[data-case-corrected]');
  let state = { experience: '', topic: '' };
  let failed = false;

  function restoreStatic() {
    failed = true;
    cards.forEach(card => { card.hidden = false; });
    groups.forEach(group => { group.hidden = false; });
    controls.hidden = true;
    empty.hidden = true;
    fallback.hidden = false;
    catalog.querySelectorAll('[data-topic-link]').forEach(link => { link.hidden = true; });
    catalog.querySelectorAll('[data-topic-fallback]').forEach(label => { label.hidden = false; });
  }
  function guarded(action) {
    if (failed) return;
    try { action(); } catch { restoreStatic(); }
  }
  function render() {
    experiences.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.caseExperience === (state.experience || 'all'))));
    topics.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.caseTopic === (state.topic || 'all'))));
    cards.forEach(card => {
      card.hidden = !!((state.experience && card.dataset.experience !== state.experience) || (state.topic && !tokens(card.dataset.topics).includes(state.topic)));
    });
    groups.forEach(group => { group.hidden = !group.querySelector('[data-story-card]:not([hidden])'); });
    const visible = cards.filter(card => !card.hidden).length;
    const labels = [experiences.find(button => button.dataset.caseExperience === (state.experience || 'all')).textContent,
      topics.find(button => button.dataset.caseTopic === (state.topic || 'all')).textContent];
    count.textContent = `${count.dataset.label}: ${visible} · ${labels.join(' / ')}`;
    empty.hidden = visible !== 0;
    linkContext(catalog, contextParams(state.experience, state.topic));
    const languageState = new URLSearchParams();
    if (state.experience) languageState.set('experience', state.experience);
    if (state.topic) languageState.set('topic', state.topic);
    updateLanguages(languageState.toString());
  }
  function readLocation() {
    const url = new URL(location.href);
    const experience = selected(url.searchParams, 'experience', allowedExperiences);
    const topic = selected(url.searchParams, 'topic', allowedTopics);
    state = { experience: experience.value, topic: topic.value };
    notice.hidden = !(experience.invalid || topic.invalid);
    if (experience.invalid) url.searchParams.delete('experience');
    if (topic.invalid) url.searchParams.delete('topic');
    if (experience.invalid || topic.invalid) history.replaceState(null, '', url);
    render();
  }
  function change(next) {
    if (next.experience === state.experience && next.topic === state.topic) return;
    const url = new URL(location.href);
    url.searchParams.delete('experience');
    url.searchParams.delete('topic');
    if (next.experience) url.searchParams.set('experience', next.experience);
    if (next.topic) url.searchParams.set('topic', next.topic);
    url.hash = '';
    history.pushState(null, '', url);
    state = next;
    notice.hidden = true;
    render();
  }
  guarded(() => {
    experiences.forEach(button => button.addEventListener('click', () => guarded(() => change({ ...state, experience: button.dataset.caseExperience === 'all' ? '' : button.dataset.caseExperience }))));
    topics.forEach(button => button.addEventListener('click', () => guarded(() => change({ ...state, topic: button.dataset.caseTopic === 'all' ? '' : button.dataset.caseTopic }))));
    catalog.querySelectorAll('[data-case-reset]').forEach(button => button.addEventListener('click', () => guarded(() => {
      const topicOnly = button.dataset.caseReset === 'topic';
      change({ experience: topicOnly ? state.experience : '', topic: '' });
      // Empty-state actions disappear after reset; move to a persistent control.
      if (empty.contains(button)) (topicOnly ? topics[0] : experiences[0]).focus({ preventScroll: true });
    })));
    window.addEventListener('popstate', () => guarded(readLocation));
    readLocation();
    enableTopics(catalog);
    controls.hidden = false;
    fallback.hidden = true;
  });
} else if (detail) {
  const params = new URLSearchParams(location.search);
  const experience = selected(params, 'fromExperience', tokens(detail.dataset.experienceIds));
  const topic = selected(params, 'fromTopic', tokens(detail.dataset.topicIds));
  const explicitCatalog = params.getAll('from').length === 1 && params.get('from') === 'cases';
  if (explicitCatalog || experience.value || topic.value) {
    const back = detail.querySelector('[data-cases-return]');
    const url = new URL(back.href);
    url.search = '';
    url.hash = '';
    if (experience.value) url.searchParams.set('experience', experience.value);
    if (topic.value) url.searchParams.set('topic', topic.value);
    back.setAttribute('href', `${url.pathname}${url.search}${url.hash}`);
    back.textContent = `← ${back.dataset.label}`;
    const context = contextParams(experience.value, topic.value);
    linkContext(detail, context);
    updateLanguages(context.toString());
  }
  enableTopics();
} else {
  enableTopics();
}
