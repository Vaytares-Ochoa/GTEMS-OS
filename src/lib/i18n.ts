import ar from '../locales/ar.json';
import ca from '../locales/ca.json';
import cs from '../locales/cs.json';
import da from '../locales/da.json';
import de from '../locales/de.json';
import el from '../locales/el.json';
import en from '../locales/en.json';
import es from '../locales/es.json';
import eu from '../locales/eu.json';
import fi from '../locales/fi.json';
import fr from '../locales/fr.json';
import gl from '../locales/gl.json';
import he from '../locales/he.json';
import hi from '../locales/hi.json';
import hu from '../locales/hu.json';
import id from '../locales/id.json';
import it from '../locales/it.json';
import ja from '../locales/ja.json';
import ko from '../locales/ko.json';
import nl from '../locales/nl.json';
import no from '../locales/no.json';
import pl from '../locales/pl.json';
import ptBR from '../locales/pt-BR.json';
import pt from '../locales/pt.json';
import ro from '../locales/ro.json';
import ru from '../locales/ru.json';
import sv from '../locales/sv.json';
import th from '../locales/th.json';
import tr from '../locales/tr.json';
import uk from '../locales/uk.json';
import vi from '../locales/vi.json';
import zhCN from '../locales/zh-CN.json';
import zhTW from '../locales/zh-TW.json';

export interface LanguageOption {
  code: string;
  baseLocale: string;
  nativeName: string;
  englishName: string;
  rtl: boolean;
  defaultCurrency: string;
  coverage: 'complete' | 'partial-fallback';
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'es-HN', baseLocale: 'es', nativeName: 'Español (Honduras / Latam)', englishName: 'Spanish (Honduras)', rtl: false, defaultCurrency: 'HNL', coverage: 'complete' },
  { code: 'es-ES', baseLocale: 'es', nativeName: 'Español (España)', englishName: 'Spanish (Spain)', rtl: false, defaultCurrency: 'EUR', coverage: 'complete' },
  { code: 'en-US', baseLocale: 'en', nativeName: 'English (United States)', englishName: 'English (US)', rtl: false, defaultCurrency: 'USD', coverage: 'complete' },
  { code: 'fr-FR', baseLocale: 'fr', nativeName: 'Français', englishName: 'French', rtl: false, defaultCurrency: 'EUR', coverage: 'complete' },
  { code: 'de-DE', baseLocale: 'de', nativeName: 'Deutsch', englishName: 'German', rtl: false, defaultCurrency: 'EUR', coverage: 'complete' },
  { code: 'it-IT', baseLocale: 'it', nativeName: 'Italiano', englishName: 'Italian', rtl: false, defaultCurrency: 'EUR', coverage: 'partial-fallback' },
  { code: 'pt-PT', baseLocale: 'pt', nativeName: 'Português (Portugal)', englishName: 'Portuguese', rtl: false, defaultCurrency: 'EUR', coverage: 'partial-fallback' },
  { code: 'pt-BR', baseLocale: 'pt-BR', nativeName: 'Português (Brasil)', englishName: 'Brazilian Portuguese', rtl: false, defaultCurrency: 'BRL', coverage: 'partial-fallback' },
  { code: 'nl-NL', baseLocale: 'nl', nativeName: 'Nederlands', englishName: 'Dutch', rtl: false, defaultCurrency: 'EUR', coverage: 'partial-fallback' },
  { code: 'ru-RU', baseLocale: 'ru', nativeName: 'Русский', englishName: 'Russian', rtl: false, defaultCurrency: 'RUB', coverage: 'partial-fallback' },
  { code: 'uk-UA', baseLocale: 'uk', nativeName: 'Українська', englishName: 'Ukrainian', rtl: false, defaultCurrency: 'UAH', coverage: 'partial-fallback' },
  { code: 'zh-CN', baseLocale: 'zh-CN', nativeName: '简体中文', englishName: 'Chinese (Simplified)', rtl: false, defaultCurrency: 'CNY', coverage: 'complete' },
  { code: 'zh-TW', baseLocale: 'zh-TW', nativeName: '繁體中文', englishName: 'Chinese (Traditional)', rtl: false, defaultCurrency: 'TWD', coverage: 'partial-fallback' },
  { code: 'ja-JP', baseLocale: 'ja', nativeName: '日本語', englishName: 'Japanese', rtl: false, defaultCurrency: 'JPY', coverage: 'complete' },
  { code: 'ko-KR', baseLocale: 'ko', nativeName: '한국어', englishName: 'Korean', rtl: false, defaultCurrency: 'KRW', coverage: 'partial-fallback' },
  { code: 'ar-SA', baseLocale: 'ar', nativeName: 'العربية', englishName: 'Arabic', rtl: true, defaultCurrency: 'SAR', coverage: 'complete' },
  { code: 'hi-IN', baseLocale: 'hi', nativeName: 'हिन्दी', englishName: 'Hindi', rtl: false, defaultCurrency: 'INR', coverage: 'partial-fallback' },
  { code: 'tr-TR', baseLocale: 'tr', nativeName: 'Türkçe', englishName: 'Turkish', rtl: false, defaultCurrency: 'TRY', coverage: 'partial-fallback' },
  { code: 'pl-PL', baseLocale: 'pl', nativeName: 'Polski', englishName: 'Polish', rtl: false, defaultCurrency: 'PLN', coverage: 'partial-fallback' },
  { code: 'sv-SE', baseLocale: 'sv', nativeName: 'Svenska', englishName: 'Swedish', rtl: false, defaultCurrency: 'SEK', coverage: 'partial-fallback' },
  { code: 'nb-NO', baseLocale: 'no', nativeName: 'Norsk', englishName: 'Norwegian', rtl: false, defaultCurrency: 'NOK', coverage: 'partial-fallback' },
  { code: 'da-DK', baseLocale: 'da', nativeName: 'Dansk', englishName: 'Danish', rtl: false, defaultCurrency: 'DKK', coverage: 'partial-fallback' },
  { code: 'fi-FI', baseLocale: 'fi', nativeName: 'Suomi', englishName: 'Finnish', rtl: false, defaultCurrency: 'EUR', coverage: 'partial-fallback' },
  { code: 'el-GR', baseLocale: 'el', nativeName: 'Ελληνικά', englishName: 'Greek', rtl: false, defaultCurrency: 'EUR', coverage: 'partial-fallback' },
  { code: 'cs-CZ', baseLocale: 'cs', nativeName: 'Čeština', englishName: 'Czech', rtl: false, defaultCurrency: 'CZK', coverage: 'partial-fallback' },
  { code: 'ro-RO', baseLocale: 'ro', nativeName: 'Română', englishName: 'Romanian', rtl: false, defaultCurrency: 'RON', coverage: 'partial-fallback' },
  { code: 'hu-HU', baseLocale: 'hu', nativeName: 'Magyar', englishName: 'Hungarian', rtl: false, defaultCurrency: 'HUF', coverage: 'partial-fallback' },
  { code: 'id-ID', baseLocale: 'id', nativeName: 'Bahasa Indonesia', englishName: 'Indonesian', rtl: false, defaultCurrency: 'IDR', coverage: 'partial-fallback' },
  { code: 'th-TH', baseLocale: 'th', nativeName: 'ไทย', englishName: 'Thai', rtl: false, defaultCurrency: 'THB', coverage: 'partial-fallback' },
  { code: 'vi-VN', baseLocale: 'vi', nativeName: 'Tiếng Việt', englishName: 'Vietnamese', rtl: false, defaultCurrency: 'VND', coverage: 'partial-fallback' },
  { code: 'he-IL', baseLocale: 'he', nativeName: 'עברית', englishName: 'Hebrew', rtl: true, defaultCurrency: 'ILS', coverage: 'partial-fallback' },
  { code: 'ca-ES', baseLocale: 'ca', nativeName: 'Català', englishName: 'Catalan', rtl: false, defaultCurrency: 'EUR', coverage: 'partial-fallback' },
  { code: 'eu-ES', baseLocale: 'eu', nativeName: 'Euskara', englishName: 'Basque', rtl: false, defaultCurrency: 'EUR', coverage: 'partial-fallback' },
  { code: 'gl-ES', baseLocale: 'gl', nativeName: 'Galego', englishName: 'Galician', rtl: false, defaultCurrency: 'EUR', coverage: 'partial-fallback' },
];

export const LOCALE_CATALOGS: Record<string, Record<string, string>> = {
  ar,
  ca,
  cs,
  da,
  de,
  el,
  en,
  es,
  eu,
  fi,
  fr,
  gl,
  he,
  hi,
  hu,
  id,
  it,
  ja,
  ko,
  nl,
  no,
  pl,
  'pt-BR': ptBR,
  pt,
  ro,
  ru,
  sv,
  th,
  tr,
  uk,
  vi,
  'zh-CN': zhCN,
  'zh-TW': zhTW,
};

export function resolveLanguageOption(langCode: string): LanguageOption {
  const exact = SUPPORTED_LANGUAGES.find(
    (l) => l.code.toLowerCase() === langCode.toLowerCase() || l.baseLocale.toLowerCase() === langCode.toLowerCase()
  );
  if (exact) return exact;
  const prefix = langCode.split('-')[0].toLowerCase();
  return SUPPORTED_LANGUAGES.find((l) => l.baseLocale.toLowerCase() === prefix) || SUPPORTED_LANGUAGES[0];
}

export function isRtlLanguage(langCode: string): boolean {
  return resolveLanguageOption(langCode).rtl;
}

export function t(langCode: string, key: string, fallbackText?: string): string {
  const opt = resolveLanguageOption(langCode);
  const catalog = LOCALE_CATALOGS[opt.baseLocale] || LOCALE_CATALOGS.es;
  if (catalog && typeof catalog[key] === 'string' && catalog[key].trim().length > 0) {
    return catalog[key];
  }
  if (LOCALE_CATALOGS.en[key]) return LOCALE_CATALOGS.en[key];
  if (LOCALE_CATALOGS.es[key]) return LOCALE_CATALOGS.es[key];
  return fallbackText || key.split('.').pop() || key;
}

export function applyLanguageToDom(langCode: string): void {
  if (typeof document === 'undefined') return;
  const opt = resolveLanguageOption(langCode);
  document.documentElement.lang = opt.code;
  document.documentElement.dir = opt.rtl ? 'rtl' : 'ltr';
}

export function formatTimeInZone(date: Date, langCode: string, timezone: string): string {
  try {
    return new Intl.DateTimeFormat(langCode || 'es-HN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: timezone || 'UTC',
    }).format(date);
  } catch {
    return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false });
  }
}

export function formatDateInZone(date: Date, langCode: string, timezone: string): string {
  try {
    return new Intl.DateTimeFormat(langCode || 'es-HN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: timezone || 'UTC',
    }).format(date);
  } catch {
    return date.toLocaleDateString('es-ES');
  }
}

export function formatLongDateInZone(date: Date, langCode: string, timezone: string): string {
  try {
    return new Intl.DateTimeFormat(langCode || 'es-HN', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: timezone || 'UTC',
    }).format(date);
  } catch {
    return date.toDateString();
  }
}

export function formatRegionalSample(langCode: string, timezone: string): {
  numberSample: string;
  currencySample: string;
  dateTimeSample: string;
} {
  const opt = resolveLanguageOption(langCode);
  const now = new Date();
  let numberSample = '1,234.56';
  let currencySample = '$125.50';
  let dateTimeSample = now.toISOString();
  try {
    numberSample = new Intl.NumberFormat(opt.code).format(12345.67);
    currencySample = new Intl.NumberFormat(opt.code, {
      style: 'currency',
      currency: opt.defaultCurrency,
    }).format(125.5);
    dateTimeSample = new Intl.DateTimeFormat(opt.code, {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: timezone || 'UTC',
    }).format(now);
  } catch {
    // keep safe defaults
  }
  return { numberSample, currencySample, dateTimeSample };
}

export interface IanaTimezoneEntry {
  id: string;
  continent: string;
  city: string;
  offsetLabel: string;
}

export function getIanaTimezoneCatalog(): IanaTimezoneEntry[] {
  const zones: string[] =
    typeof Intl !== 'undefined' && typeof (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf === 'function'
      ? (Intl as unknown as { supportedValuesOf: (k: string) => string[] }).supportedValuesOf('timeZone')
      : [
          'America/Tegucigalpa',
          'America/New_York',
          'America/Mexico_City',
          'America/Los_Angeles',
          'America/Bogota',
          'America/Lima',
          'America/Santiago',
          'America/Argentina/Buenos_Aires',
          'Europe/Madrid',
          'Europe/London',
          'Europe/Paris',
          'Europe/Berlin',
          'Asia/Tokyo',
          'Asia/Seoul',
          'Asia/Shanghai',
          'Asia/Dubai',
          'Australia/Sydney',
          'Pacific/Auckland',
          'UTC',
        ];

  const now = new Date();
  return zones.map((id) => {
    const slash = id.indexOf('/');
    const continent = slash === -1 ? 'UTC / Global' : id.slice(0, slash);
    const city = slash === -1 ? id : id.slice(slash + 1).replace(/_/g, ' ');
    let offsetLabel = 'UTC';
    try {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: id,
        timeZoneName: 'shortOffset',
      }).formatToParts(now);
      offsetLabel = parts.find((p) => p.type === 'timeZoneName')?.value || 'UTC';
    } catch {
      offsetLabel = 'UTC';
    }
    return { id, continent, city, offsetLabel };
  });
}
