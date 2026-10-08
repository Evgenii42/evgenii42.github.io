import { selectLocale, readPreferenceCookie, validLocale } from "./locale.js";
let saved;
try {
  saved = validLocale(localStorage.getItem("cv_language"));
} catch {
  /* Storage can be disabled. */
}
try { saved ||= readPreferenceCookie(document.cookie); } catch { /* Private storage may be disabled. */ }
const locale = selectLocale({
  saved,
  languages: navigator.languages || [navigator.language],
});
const target = new URL(document.body.dataset[locale], location.href);
target.search = location.search;
target.hash = location.hash;
location.replace(target.href);
