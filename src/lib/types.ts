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
  photo: string | null; // immagine compressa (data URL) – in Fase B passa su Drive
  genres: string[];
  phone: string;
  links: ArtistLinks;
  nextSession: NextSession;
  memberUids: string[];
  memberEmails: string[];
  active: boolean;
  driveFolderId: string | null;
}

export interface StudioSettings {
  iban: string;
  ibanHolder: string;
  paypal: string;
  satispay: string;
  paymentNote: string;
  welcomeText: string;
}

export const emptySettings: StudioSettings = {
  iban: '',
  ibanHolder: '',
  paypal: '',
  satispay: '',
  paymentNote: '',
  welcomeText: '',
};
