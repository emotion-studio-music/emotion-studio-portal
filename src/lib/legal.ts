import { getLang } from './i18n';

export const PRIVACY_URL = 'https://www.iubenda.com/privacy-policy/35994868';
export const COOKIE_URL = 'https://www.iubenda.com/privacy-policy/35994868/cookie-policy';
// Versione inglese della policy (iubenda → attiva la lingua inglese → incolla qui i link). Vuoto = si usa quella italiana.
export const PRIVACY_URL_EN = '';
export const COOKIE_URL_EN = '';
export const STUDIO_SITE = 'https://www.efamusic.it/emotion-studio/';

/** Link alle policy nella lingua dell'app, se esistono. */
export const privacyUrl = () => (getLang() === 'en' && PRIVACY_URL_EN) || PRIVACY_URL;
export const cookieUrl = () => (getLang() === 'en' && COOKIE_URL_EN) || COOKIE_URL;
/** true se all'artista inglese mostriamo la policy in italiano */
export const policyOnlyItalian = () => getLang() === 'en' && !PRIVACY_URL_EN;
