export const CONSENT_KEY = 'portfolio_analytics_v1';
export const CONSENT_TTL = 180 * 24 * 60 * 60 * 1000;

export function readConsent(raw, now = Date.now()) {
  try {
    const data = JSON.parse(raw);
    if (!['granted', 'denied'].includes(data?.value) || !Number.isFinite(data.at) || data.at > now || now - data.at >= CONSENT_TTL) return null;
    return data.value;
  } catch { return null; }
}

export function permitted(config, location, navigator, consent) {
  return /^G-[A-Z0-9]+$/.test(config.id || '') && location.hostname === config.hostname && location.protocol === 'https:' &&
    navigator.doNotTrack !== '1' && navigator.globalPrivacyControl !== true && consent === 'granted';
}

export function pageContext(config, location) {
  const path = config.paths.includes(location.pathname) ? location.pathname : '/';
  const locale = /^\/(ru|en)\//.exec(path)?.[1] || 'unknown';
  const caseId = /^\/(?:ru|en)\/cases\/([^/]+)\/$/.exec(path)?.[1];
  return { page_location: `https://${config.hostname}${path}`, page_path: path, content_language: locale,
    ...(config.cases.includes(caseId) ? { case_id: caseId } : {}) };
}

export function safeReferrer(value) {
  try {
    const u = new URL(value);
    const host = u.hostname;
    if (u.protocol !== 'https:') return '';
    if (host === 'linkedin.com' || host.endsWith('.linkedin.com')) return 'https://www.linkedin.com/';
    if (host === 'hh.ru' || host.endsWith('.hh.ru')) return 'https://hh.ru/';
    if (['www.google.com', 'google.com', 'yandex.ru', 'www.yandex.ru'].includes(host)) return `https://${host}/`;
  } catch { /* Direct visit or unknown referrer. */ }
  return '';
}

export function cleanEvent(config, name, input = {}) {
  const allow = (key, values) => values.includes(input[key]) ? { [key]: input[key] } : null;
  if (name === 'page_view') return {};
  if (['case_view', 'case_engaged'].includes(name)) return allow('case_id', config.cases);
  if (name === 'download_cv') return allow('variant', ['short', 'full']);
  if (name === 'contact_click') return allow('channel', ['email', 'telegram', 'linkedin', 'phone']);
  if (name === 'need_open') return allow('need_id', config.needs);
  if (name === 'case_filter') {
    if (input.dimension === 'experience') return allow('value', config.experiences) && { dimension: 'experience', value: input.value };
    if (input.dimension === 'topic') return allow('value', config.topics) && { dimension: 'topic', value: input.value };
    if (input.dimension === 'reset') return allow('value', ['all', 'topic']) && { dimension: 'reset', value: input.value };
  }
  return null;
}


const meta = typeof document !== 'undefined' && document.querySelector('meta[name="portfolio-analytics"]');
if (meta) {
  let config;
  try { config = JSON.parse(meta.content); } catch { /* Malformed build metadata cannot interrupt the site. */ }
  if (config) initialize(config);
}

function initialize(config) {
  if (!/^G-[A-Z0-9]+$/.test(config.id) || location.hostname !== config.hostname || location.protocol !== 'https:') return;
  const ru = document.documentElement.lang === 'ru';
  const text = ru ? {
    settings: 'Настройки аналитики', title: 'Аналитика посещений',
    description: 'С вашего согласия Google Analytics использует cookies для статистики страниц и кейсов, кликов по PDF и ссылкам на контакты. Google получает технические данные о посещении. Можно отказаться или изменить выбор здесь в любое время.',
    accept: 'Разрешить аналитику', reject: 'Без аналитики', close: 'Закрыть',
    privacy: 'Как Google использует данные', blocked: 'Сигнал приватности браузера отключает аналитику.',
  } : {
    settings: 'Analytics settings', title: 'Visitor analytics',
    description: 'With your permission, Google Analytics uses cookies to measure pages, cases, PDF clicks and contact clicks. Google receives technical visit data. You can decline or change your choice here at any time.',
    accept: 'Allow analytics', reject: 'Without analytics', close: 'Close',
    privacy: 'How Google uses data', blocked: 'Your browser privacy signal disables analytics.',
  };
  let consent = null;
  try { consent = readConsent(localStorage.getItem(CONSENT_KEY)); } catch { /* Session choice works. */ }
  let started = false;
  let activeMs = 0;
  let lastTick = performance.now();
  let engaged = false;
  const context = pageContext(config, location);
  const disabled = navigator.doNotTrack === '1' || navigator.globalPrivacyControl === true;

  function send(name, input) {
    if (!started || !permitted(config, location, navigator, consent)) return;
    const params = cleanEvent(config, name, input);
    if (params) window.gtag('event', name, { ...context, ...params, send_to: config.id });
  }
  function start() {
    if (started || !permitted(config, location, navigator, consent)) return;
    started = true;
    window[`ga-disable-${config.id}`] = false;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('consent', 'default', { analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
    window.gtag('js', new Date());
    window.gtag('config', config.id, { send_page_view: false, allow_google_signals: false,
      allow_ad_personalization_signals: false, page_location: context.page_location,
      page_referrer: safeReferrer(document.referrer), page_title: 'Evgenii Zaitsev portfolio',
      cookie_domain: config.hostname, cookie_flags: 'SameSite=Lax;Secure' });
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${config.id}`;
    document.head.append(script);
    lastTick = performance.now();
    send('page_view');
    if (context.case_id) send('case_view', { case_id: context.case_id });
  }
  function removeCookies() {
    for (const part of document.cookie.split(';')) {
      const key = part.trim().split('=')[0];
      if (key === '_ga' || key.startsWith('_ga_')) {
        document.cookie = `${key}=; Max-Age=0; Path=/; SameSite=Lax; Secure`;
        document.cookie = `${key}=; Max-Age=0; Path=/; Domain=${config.hostname}; SameSite=Lax; Secure`;
        document.cookie = `${key}=; Max-Age=0; Path=/; Domain=.${config.hostname}; SameSite=Lax; Secure`;
      }
    }
  }
  const settings = document.createElement('button');
  settings.type = 'button'; settings.className = 'analytics-settings'; settings.textContent = text.settings;
  const panel = document.createElement('section');
  panel.className = 'analytics-panel'; panel.setAttribute('aria-labelledby', 'analytics-title');
  const heading = document.createElement('h2'); heading.id = 'analytics-title'; heading.textContent = text.title;
  const description = document.createElement('p'); description.textContent = disabled ? text.blocked : text.description;
  const privacy = document.createElement('a'); privacy.href = 'https://policies.google.com/technologies/partner-sites';
  privacy.textContent = text.privacy; privacy.target = '_blank'; privacy.rel = 'noopener noreferrer';
  const actions = document.createElement('div'); actions.className = 'analytics-actions';
  const accept = document.createElement('button'); accept.type = 'button'; accept.textContent = text.accept; accept.disabled = disabled;
  const reject = document.createElement('button'); reject.type = 'button'; reject.textContent = text.reject;
  const close = document.createElement('button'); close.type = 'button'; close.textContent = text.close;
  actions.append(accept, reject, close); panel.append(heading, description, privacy, actions);
  document.body.append(settings, panel);
  function show(value, focus = false) {
    panel.hidden = !value; settings.setAttribute('aria-expanded', String(value));
    if (focus) (value ? reject : settings).focus();
  }
  function choose(value) {
    const wasStarted = started;
    consent = value;
    try { localStorage.setItem(CONSENT_KEY, JSON.stringify({ value, at: Date.now() })); } catch { /* No persistence. */ }
    show(false, true);
    if (value === 'granted') start();
    else {
      window[`ga-disable-${config.id}`] = true;
      removeCookies();
      if (wasStarted) location.reload();
    }
  }
  settings.addEventListener('click', () => show(panel.hidden, true));
  accept.addEventListener('click', () => { window[`ga-disable-${config.id}`] = false; choose('granted'); });
  reject.addEventListener('click', () => choose('denied'));
  close.addEventListener('click', () => show(false, true));
  panel.addEventListener('keydown', event => { if (event.key === 'Escape') show(false, true); });
  settings.setAttribute('aria-controls', 'analytics-panel'); panel.id = 'analytics-panel';
  show(consent === null && !disabled);
  start();

  // One delegated listener; do not subscribe to the existing local download event.
  document.addEventListener('click', event => {
    const target = event.target.closest?.('a, button');
    if (!target) return;
    if (target.matches('[data-download]')) send('download_cv', { variant: target.dataset.download });
    else if (target.matches('a[href]')) {
      const url = new URL(target.href, location.href);
      const channel = url.protocol === 'mailto:' ? 'email' : url.protocol === 'tel:' ? 'phone' :
        url.hostname === 't.me' ? 'telegram' : ['linkedin.com', 'www.linkedin.com'].includes(url.hostname) ? 'linkedin' : null;
      if (channel) send('contact_click', { channel });
    } else if (target.matches('[data-case-experience]') && target.getAttribute('aria-pressed') !== 'true') send('case_filter', { dimension: 'experience', value: target.dataset.caseExperience });
    else if (target.matches('[data-case-topic]') && target.getAttribute('aria-pressed') !== 'true') send('case_filter', { dimension: 'topic', value: target.dataset.caseTopic });
    else if (target.matches('[data-case-reset]')) {
      const topicChanged = document.querySelector('[data-case-topic="all"]')?.getAttribute('aria-pressed') === 'false';
      const experienceChanged = document.querySelector('[data-case-experience="all"]')?.getAttribute('aria-pressed') === 'false';
      if ((target.dataset.caseReset === 'topic' && topicChanged) ||
          (target.dataset.caseReset === 'all' && (topicChanged || experienceChanged))) {
        send('case_filter', { dimension: 'reset', value: target.dataset.caseReset });
      }
    }
  }, true);
  document.querySelectorAll('[data-employer-need]').forEach(item => {
    item.addEventListener('toggle', () => { if (item.open) send('need_open', { need_id: item.dataset.employerNeed }); });
  });
  // Count only visible time after consent, once per document. Hidden time is discarded.
  function tick() {
    const now = performance.now();
    if (started && document.visibilityState === 'visible') activeMs += Math.min(now - lastTick, 1000);
    lastTick = now;
    if (!engaged && context.case_id && activeMs >= 30000) {
      engaged = true; send('case_engaged', { case_id: context.case_id });
    }
  }
  setInterval(tick, 1000);
  document.addEventListener('visibilitychange', () => { lastTick = performance.now(); });
  window.addEventListener('storage', event => {
    if (event.key !== CONSENT_KEY) return;
    consent = readConsent(event.newValue);
    if (consent !== 'granted' && started) { window[`ga-disable-${config.id}`] = true; removeCookies(); location.reload(); }
    else if (consent === 'granted') { if (!panel.hidden) show(false, true); start(); }
  });
}
