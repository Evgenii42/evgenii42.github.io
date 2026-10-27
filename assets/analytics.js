export const CONSENT_KEY = 'portfolio_google_analytics_v1';
const LEGACY_CONSENT_KEY = 'portfolio_analytics_v1';
const SESSION_DENIAL_KEY = 'portfolio_google_analytics_denied_session';
export const CONSENT_TTL = 180 * 24 * 60 * 60 * 1000;
const GA_ID_PATTERN = /^G-[A-Z0-9]+$/;
const UMAMI_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CASE_ENGAGEMENT_MS = 30000;
const UMAMI_QUEUE_MAX = 20;

export function readConsent(raw, now = Date.now()) {
  try {
    const data = JSON.parse(raw);
    if (!['granted', 'basic', 'denied'].includes(data?.value) || !Number.isFinite(data.at) || data.at > now || now - data.at >= CONSENT_TTL) return null;
    return data.value;
  } catch { return null; }
}

export function permitted(config, location, navigator, consent) {
  return GA_ID_PATTERN.test(config.id || '') && location.hostname === config.hostname && location.protocol === 'https:' &&
    navigator.doNotTrack !== '1' && navigator.globalPrivacyControl !== true && consent === 'granted';
}

export function pageContext(config, location) {
  const path = config.paths.includes(location.pathname) ? location.pathname : '/';
  const locale = (config.languages || ['ru', 'en']).find(lang => path.startsWith(`/${lang}/`)) || 'unknown';
  const segments = path.split('/');
  const caseId = (config.languages || ['ru', 'en']).includes(segments[1]) && segments[2] === 'cases' && segments.length === 5 ? segments[3] : undefined;
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
    if (host === 'getmatch.ru' || host.endsWith('.getmatch.ru')) return 'https://getmatch.ru/';
    if (host === 'habr.com' || host.endsWith('.habr.com')) return 'https://habr.com/';
    if (host === 't.me') return 'https://t.me/';
    if (['www.google.com', 'google.com', 'yandex.ru', 'www.yandex.ru'].includes(host)) return `https://${host}/`;
  } catch { /* Direct visit or unknown referrer. */ }
  return '';
}

export function safeCampaign(search) {
  const sources = ['hh', 'getmatch', 'habr', 'linkedin', 'telegram', 'company_site'];
  const media = ['application', 'profile', 'post', 'referral', 'message'];
  try {
    const params = new URLSearchParams(search || '');
    if (params.getAll('utm_source').length !== 1 || params.getAll('utm_medium').length !== 1) return {};
    const source = params.get('utm_source');
    const medium = params.get('utm_medium');
    return sources.includes(source) && media.includes(medium)
      ? { campaign_source: source, campaign_medium: medium } : {};
  } catch { return {}; }
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

export function umamiPayload(config, location, referrer, name, input = {}) {
  if (!UMAMI_ID_PATTERN.test(config.umamiWebsiteId || '')) return null;
  if (location.hostname !== config.hostname || location.protocol !== 'https:') return null;
  if (!config.paths.includes(location.pathname)) return null;
  const context = pageContext(config, location);
  const campaign = safeCampaign(location.search);
  const query = campaign.campaign_source
    ? `?utm_source=${campaign.campaign_source}&utm_medium=${campaign.campaign_medium}` : '';
  const base = { website: config.umamiWebsiteId, hostname: config.hostname,
    url: `${context.page_path}${query}`, referrer: safeReferrer(referrer) };
  if (name === 'page_view') return base;
  const data = cleanEvent(config, name, input);
  return data ? { ...base, name, ...(Object.keys(data).length ? { data } : {}) } : null;
}


const meta = typeof document !== 'undefined' && document.querySelector('meta[name="portfolio-analytics"]');
if (meta) {
  let config;
  try { config = JSON.parse(meta.content); } catch { /* Malformed build metadata cannot interrupt the site. */ }
  if (config) initialize(config);
}

function initialize(config) {
  const hasGa = GA_ID_PATTERN.test(config.id || '');
  const hasUmami = UMAMI_ID_PATTERN.test(config.umamiWebsiteId || '');
  if ((!hasGa && !hasUmami) || location.hostname !== config.hostname || location.protocol !== 'https:' || !config.paths.includes(location.pathname)) return;
  const ru = document.documentElement.lang === 'ru';
  const text = ru ? {
    settings: 'Настройки Google Analytics', title: 'Google Analytics',
    notice: 'Google Analytics включается только с вашего разрешения.',
    detail: 'После разрешения Google Analytics использует cookies и технические данные посещения для подсчета страниц, просмотров кейсов и кликов по PDF и контактам.',
    on: 'Google Analytics включен.', off: 'Google Analytics выключен.',
    accept: 'Разрешить Google Analytics', reject: 'Отключить Google Analytics', rejectOff: 'Не включать Google Analytics', close: 'Закрыть',
    privacy: 'Как Google использует данные', blocked: 'Сигнал приватности браузера блокирует Google Analytics.',
  } : {
    settings: 'Google Analytics settings', title: 'Google Analytics',
    notice: 'Google Analytics runs only with your permission.',
    detail: 'If enabled, Google Analytics uses cookies and technical visit data to count pages, case views, and clicks on PDFs and contacts.',
    on: 'Google Analytics is on.', off: 'Google Analytics is off.',
    accept: 'Allow Google Analytics', reject: 'Turn off Google Analytics', rejectOff: 'Keep Google Analytics off', close: 'Close',
    privacy: 'How Google uses data', blocked: 'Your browser privacy signal blocks Google Analytics.',
  };
  let consent = null;
  let legacyUmamiDenied = false;
  try {
    const previousRaw = localStorage.getItem(LEGACY_CONSENT_KEY);
    const currentRaw = localStorage.getItem(CONSENT_KEY);
    const previous = readConsent(previousRaw);
    const current = readConsent(currentRaw);
    legacyUmamiDenied = previous === 'denied';
    consent = current || (previous === 'granted' ? 'granted' : null);
    // A stale grant must not survive a browser that can read storage but cannot save a refusal.
    if (consent === 'granted') {
      try {
        if (current === 'granted') localStorage.setItem(CONSENT_KEY, currentRaw);
        else localStorage.setItem(LEGACY_CONSENT_KEY, previousRaw);
      } catch { consent = null; }
    }
  } catch { /* Session choice works. */ }
  try { if (sessionStorage.getItem(SESSION_DENIAL_KEY) === '1') consent = 'denied'; } catch { /* Session storage is optional. */ }
  let started = false;
  let gaActiveMs = 0;
  let umamiActiveMs = 0;
  let lastTick = performance.now();
  let gaEngaged = false;
  let umamiEngaged = false;
  let umamiStarted = false;
  let umamiReady = false;
  const umamiQueue = [];
  const context = pageContext(config, location);
  const privacyBlocked = () => navigator.doNotTrack === '1' || navigator.globalPrivacyControl === true;
  const blockedBySignal = privacyBlocked();
  let privacySignalSeen = blockedBySignal;

  function sendUmami(name, input) {
    if (privacyBlocked() || legacyUmamiDenied || !hasUmami) return;
    const payload = umamiPayload(config, location, document.referrer, name, input);
    if (!payload) return;
    if (umamiReady) window.umami.track(payload);
    else if (umamiQueue.length < UMAMI_QUEUE_MAX) umamiQueue.push(payload);
  }
  function startUmami() {
    if (umamiStarted || privacyBlocked() || legacyUmamiDenied || !umamiPayload(config, location, document.referrer, 'page_view')) return;
    umamiStarted = true;
    window.portfolioUmamiBeforeSend = (type, payload) => {
      if (privacyBlocked() || legacyUmamiDenied) return null;
      if (type !== 'event' || payload?.website !== config.umamiWebsiteId || payload?.hostname !== config.hostname) return null;
      const name = typeof payload.name === 'string' ? payload.name : 'page_view';
      return umamiPayload(config, location, document.referrer, name, payload.data);
    };
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://cloud.umami.is/script.js';
    script.setAttribute('data-website-id', config.umamiWebsiteId);
    script.setAttribute('data-domains', config.hostname);
    script.setAttribute('data-auto-track', 'false');
    script.setAttribute('data-do-not-track', 'true');
    script.setAttribute('data-before-send', 'portfolioUmamiBeforeSend');
    script.onload = () => {
      if (!window.umami?.track) return;
      umamiReady = true;
      if (privacyBlocked() || legacyUmamiDenied) { umamiQueue.length = 0; return; }
      sendUmami('page_view');
      if (context.case_id) sendUmami('case_view', { case_id: context.case_id });
      for (const item of umamiQueue.splice(0)) window.umami.track(item);
    };
    document.head.append(script);
  }

  function send(name, input) {
    if (!started || !permitted(config, location, navigator, consent) || !config.paths.includes(location.pathname)) return;
    const params = cleanEvent(config, name, input);
    if (params) window.gtag('event', name, { ...context, ...params, send_to: config.id });
  }
  function record(name, input) {
    sendUmami(name, input);
    send(name, input);
  }
  function start() {
    if (!hasGa || started || !permitted(config, location, navigator, consent)) return;
    started = true;
    window[`ga-disable-${config.id}`] = false;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('consent', 'default', { analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
    window.gtag('js', new Date());
    window.gtag('config', config.id, { send_page_view: false, allow_google_signals: false,
      allow_ad_personalization_signals: false, page_location: context.page_location,
      page_referrer: safeReferrer(document.referrer), page_title: 'Evgenii Zaitsev portfolio',
      cookie_domain: config.hostname, cookie_flags: 'SameSite=Lax;Secure',
      ...safeCampaign(location.search) });
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${config.id}`;
    document.head.append(script);
    gaActiveMs = 0;
    lastTick = performance.now();
    send('page_view');
    if (context.case_id) send('case_view', { case_id: context.case_id });
  }
  function removeCookies() {
    try {
      for (const part of document.cookie.split(';')) {
        const key = part.trim().split('=')[0];
        if (key === '_ga' || key.startsWith('_ga_')) {
          document.cookie = `${key}=; Max-Age=0; Path=/; SameSite=Lax; Secure`;
          document.cookie = `${key}=; Max-Age=0; Path=/; Domain=${config.hostname}; SameSite=Lax; Secure`;
          document.cookie = `${key}=; Max-Age=0; Path=/; Domain=.${config.hostname}; SameSite=Lax; Secure`;
        }
      }
    } catch { /* Cookie access can be disabled; do not interrupt CV or analytics choices. */ }
  }
  let updateCopy = () => {};
  let closePanel = () => {};
  if (hasGa) {
    const footer = document.createElement('div'); footer.className = 'analytics-footer';
    const notice = document.createElement('p');
    const noticeLabel = document.createElement('span'); noticeLabel.setAttribute('aria-live', 'polite'); notice.append(noticeLabel);
    const settings = document.createElement('button');
    settings.type = 'button'; settings.className = 'analytics-settings'; settings.textContent = text.settings;
    settings.setAttribute('aria-haspopup', 'dialog');
    const scrim = document.createElement('div'); scrim.className = 'analytics-scrim'; scrim.hidden = true;
    const panel = document.createElement('section');
    panel.className = 'analytics-panel'; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true'); panel.setAttribute('aria-labelledby', 'analytics-title'); panel.setAttribute('aria-describedby', 'analytics-description');
    const heading = document.createElement('h2'); heading.id = 'analytics-title'; heading.textContent = text.title; heading.tabIndex = -1;
    const description = document.createElement('p'); description.id = 'analytics-description';
    const privacy = document.createElement('a'); privacy.href = 'https://policies.google.com/technologies/partner-sites';
    privacy.textContent = text.privacy; privacy.target = '_blank'; privacy.rel = 'noopener noreferrer';
    const actions = document.createElement('div'); actions.className = 'analytics-actions';
    const accept = document.createElement('button'); accept.type = 'button'; accept.textContent = text.accept; accept.disabled = blockedBySignal;
    const reject = document.createElement('button'); reject.type = 'button'; reject.textContent = text.reject;
    const close = document.createElement('button'); close.type = 'button'; close.textContent = text.close;
    actions.append(accept, reject, close); panel.append(heading, description, privacy, actions);
    footer.append(notice, settings);
    const main = document.querySelector('main');
    if (main) document.body.insertBefore(footer, main);
    else document.body.append(footer);
    document.body.append(scrim, panel);
    const background = [...document.body.children].filter(item => item !== scrim && item !== panel);
    const priorInert = new Map();
    updateCopy = () => {
      noticeLabel.textContent = privacyBlocked() ? text.blocked : consent === 'granted' ? text.on : consent === 'denied' ? text.off : text.notice;
      description.textContent = privacyBlocked() ? text.blocked : `${noticeLabel.textContent} ${text.detail}`;
      accept.disabled = privacyBlocked();
      reject.textContent = consent === 'granted' ? text.reject : text.rejectOff;
    };
    function show(value, focus = false) {
      updateCopy();
      panel.hidden = !value; scrim.hidden = !value; settings.setAttribute('aria-expanded', String(value));
      if (value) {
        for (const item of background) { if (!priorInert.has(item)) priorInert.set(item, item.inert); item.inert = true; }
      } else {
        for (const [item, wasInert] of priorInert) item.inert = wasInert;
        priorInert.clear();
      }
      if (focus) (value ? heading : settings).focus();
    }
    closePanel = () => { if (!panel.hidden) show(false, true); };
    function choose(value) {
      const hadGa = started;
      consent = value;
      let persisted = true;
      try { localStorage.setItem(CONSENT_KEY, JSON.stringify({ value, at: Date.now() })); } catch { persisted = false; }
      try {
        if (value === 'denied') sessionStorage.setItem(SESSION_DENIAL_KEY, '1');
        else sessionStorage.removeItem(SESSION_DENIAL_KEY);
      } catch { /* The current document still honors the choice. */ }
      if (!persisted && value === 'denied') {
        try { localStorage.removeItem(CONSENT_KEY); localStorage.removeItem(LEGACY_CONSENT_KEY); } catch { /* A stale grant is rejected by the write check on next load. */ }
      }
      show(false, true);
      if (value !== 'granted') {
        window[`ga-disable-${config.id}`] = true;
        removeCookies();
      }
      if (persisted && value === 'denied' && hadGa) location.reload();
      else if (value === 'granted') start();
    }
    settings.addEventListener('click', () => show(panel.hidden, true));
    accept.addEventListener('click', () => { window[`ga-disable-${config.id}`] = false; choose('granted'); });
    reject.addEventListener('click', () => choose('denied'));
    close.addEventListener('click', () => show(false, true));
    scrim.addEventListener('click', () => show(false, true));
    panel.addEventListener('keydown', event => {
      if (event.key === 'Escape') { show(false, true); return; }
      if (event.key !== 'Tab') return;
      const focusable = [privacy, accept, reject, close].filter(item => !item.disabled);
      if (event.shiftKey && (document.activeElement === heading || document.activeElement === focusable[0])) {
        event.preventDefault(); close.focus();
      } else if (!event.shiftKey && document.activeElement === close) {
        event.preventDefault(); focusable[0].focus();
      }
    });
    settings.setAttribute('aria-controls', 'analytics-panel'); panel.id = 'analytics-panel';
    show(false);
  }
  if (!permitted(config, location, navigator, consent)) {
    if (hasGa) window[`ga-disable-${config.id}`] = true;
    removeCookies();
  }
  startUmami();
  start();

  // One delegated listener; do not subscribe to the existing local download event.
  document.addEventListener('click', event => {
    const target = event.target.closest?.('a, button');
    if (!target) return;
    if (target.matches('[data-download]')) record('download_cv', { variant: target.dataset.download });
    else if (target.matches('a[href][data-contact]')) {
      const url = new URL(target.href, location.href);
      const channel = target.dataset.contact;
      const valid = channel === 'email' ? url.protocol === 'mailto:' : channel === 'phone' ? url.protocol === 'tel:' :
        channel === 'telegram' ? url.hostname === 't.me' && url.protocol === 'https:' :
        channel === 'linkedin' ? ['linkedin.com', 'www.linkedin.com'].includes(url.hostname) && url.protocol === 'https:' : false;
      if (valid) record('contact_click', { channel });
    } else if (target.matches('[data-case-experience]') && target.getAttribute('aria-pressed') !== 'true') record('case_filter', { dimension: 'experience', value: target.dataset.caseExperience });
    else if (target.matches('[data-case-topic]') && target.getAttribute('aria-pressed') !== 'true') record('case_filter', { dimension: 'topic', value: target.dataset.caseTopic });
    else if (target.matches('[data-case-reset]')) {
      const topicChanged = document.querySelector('[data-case-topic="all"]')?.getAttribute('aria-pressed') === 'false';
      const experienceChanged = document.querySelector('[data-case-experience="all"]')?.getAttribute('aria-pressed') === 'false';
      if ((target.dataset.caseReset === 'topic' && topicChanged) ||
          (target.dataset.caseReset === 'all' && (topicChanged || experienceChanged))) {
        record('case_filter', { dimension: 'reset', value: target.dataset.caseReset });
      }
    }
  }, true);
  document.querySelectorAll('[data-employer-need]').forEach(item => {
    item.addEventListener('toggle', () => { if (item.open) record('need_open', { need_id: item.dataset.employerNeed }); });
  });
  // Count visible time independently for each active counter.
  function tick() {
    const signalBlocked = privacyBlocked();
    if (signalBlocked !== privacySignalSeen) {
      privacySignalSeen = signalBlocked;
      if (signalBlocked) {
        if (hasGa) window[`ga-disable-${config.id}`] = true;
        removeCookies();
      } else if (hasGa && started && consent === 'granted') window[`ga-disable-${config.id}`] = false;
      updateCopy();
    }
    const now = performance.now();
    const elapsed = Math.max(0, Math.min(now - lastTick, 1000));
    if (document.visibilityState === 'visible') {
      if (started && permitted(config, location, navigator, consent)) gaActiveMs += elapsed;
      if (umamiStarted && !legacyUmamiDenied && !privacyBlocked()) umamiActiveMs += elapsed;
    }
    lastTick = now;
    if (context.case_id && !umamiEngaged && umamiActiveMs >= CASE_ENGAGEMENT_MS) {
      umamiEngaged = true; sendUmami('case_engaged', { case_id: context.case_id });
    }
    if (context.case_id && !gaEngaged && gaActiveMs >= CASE_ENGAGEMENT_MS) {
      gaEngaged = true; send('case_engaged', { case_id: context.case_id });
    }
  }
  setInterval(tick, 1000);
  document.addEventListener('visibilitychange', () => { lastTick = performance.now(); });
  window.addEventListener('storage', event => {
    if (event.key !== CONSENT_KEY) return;
    consent = readConsent(event.newValue);
    updateCopy();
    if (consent !== 'granted') { window[`ga-disable-${config.id}`] = true; removeCookies(); }
    if (consent !== 'granted' && started) location.reload();
    else if (consent === 'granted') {
      closePanel();
      window[`ga-disable-${config.id}`] = false;
      start();
    }
  });
}
