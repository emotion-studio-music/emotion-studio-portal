import { DEFAULT_STEPS } from './steps';
import type { Lang } from './i18n';

export const DEFAULT_SERVICES = ['Registrazione', 'Produzione', 'Arrangiamento', 'Beat', 'Mix', 'Master', 'Consulenza'];

export interface PhotoFocus { x: number; y: number; zoom: number }
export const defaultFocus: PhotoFocus = { x: 50, y: 30, zoom: 1 };

/** Stile per le foto: tiene inquadrato il punto scelto, in qualsiasi formato (verticale, quadrato, cerchio). */
export function focusStyle(f: PhotoFocus | undefined) {
  const v = f ?? defaultFocus;
  return { objectPosition: `${v.x}% ${v.y}%`, transform: v.zoom > 1 ? `scale(${v.zoom})` : undefined, transformOrigin: `${v.x}% ${v.y}%` };
}

export interface ArtistLinks {
  instagram?: string;
  spotify?: string;
  tiktok?: string;
  youtube?: string;
}

export interface NextSession {
  at: string;   // data e ora locali, formato "2026-11-03T18:00" ('' = nessuna)
  type: string; // Registrazione, Mix, Mastering, Produzione, Consulenza ('' = non indicato)
  note: string; // nota facoltativa per l'artista
}

export const emptySession: NextSession = { at: '', type: '', note: '' };

export interface Artist {
  id: string;
  stageName: string;
  realName: string;
  bio: string;
  photo: string | null; // immagine compressa (data URL)
  photoFocus: PhotoFocus; // punto da tenere inquadrato (il viso) e zoom
  genres: string[];
  phone: string;
  links: ArtistLinks;
  nextSession: NextSession;
  language: Lang;          // lingua della sua app (lo studio vede sempre l'italiano)
  memberUids: string[];
  memberEmails: string[];
  active: boolean;
  driveFolderId: string | null;
  createdMs: number;
}

export interface StudioSettings {
  iban: string;
  ibanHolder: string;
  paypal: string;
  satispay: string;
  paymentNote: string;
  welcomeText: string;
  welcomeTextEn: string;  // facoltativi: per gli artisti in inglese (vuoto = si usa l'italiano)
  paymentNoteEn: string;
  stepTemplate: string[]; // percorso predefinito dei nuovi brani
  services: string[];     // servizi selezionabili nei preventivi
  priceStep: number;      // scatto della tariffa in euro (es. 50)
}

export const emptySettings: StudioSettings = {
  iban: '',
  ibanHolder: '',
  paypal: '',
  satispay: '',
  paymentNote: '',
  welcomeText: '',
  welcomeTextEn: '',
  paymentNoteEn: '',
  stepTemplate: DEFAULT_STEPS,
  services: DEFAULT_SERVICES,
  priceStep: 50,
};
