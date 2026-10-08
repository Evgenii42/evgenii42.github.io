export function validLocale(value) {
  return value === "ru" || value === "en" ? value : null;
}

export function preferredLocale(languages = []) {
  for (const language of languages) {
    const locale = validLocale(String(language).toLowerCase().split("-")[0]);
    if (locale) return locale;
  }
  return "en";
}

export function countryLocale(country) {
  if (!country || country === "XX" || country === "T1") return null;
  // Conservative first version; other countries keep their own browser preference.
  return country.toUpperCase() === "RU" ? "ru" : null;
}

export function readPreferenceCookie(cookie = "") {
  const entry = cookie
    .split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith("cv_language="));
  return validLocale(entry?.slice("cv_language=".length));
}

export function selectLocale({ saved, country, languages } = {}) {
  return (
    validLocale(saved) || countryLocale(country) || preferredLocale(languages)
  );
}

export function languageHeaders(header = "") {
  return header
    .split(",")
    .map((item, index) => {
      const [language, ...parameters] = item.trim().split(";");
      const weight = parameters.find((x) => x.trim().startsWith("q="));
      const q = weight ? Number(weight.trim().slice(2)) : 1;
      return { language, q, index };
    })
    .filter((x) => Number.isFinite(x.q) && x.q > 0 && x.q <= 1)
    .sort((a, b) => b.q - a.q || a.index - b.index)
    .map((x) => x.language);
}
