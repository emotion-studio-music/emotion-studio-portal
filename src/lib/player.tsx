import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { mediaUrl } from './worker';
import type { Version } from './music';

/**
 * Lettore globale: vive sopra tutte le pagine, così la musica continua mentre si naviga
 * (mini player in basso). Gestisce due lettori, A e B, per il confronto tra versioni.
 */

export type Side = 'A' | 'B';

export interface PlayerTrack {
  artistId: string;
  trackId: string;
  title: string;
  artistName: string;
  cover: string | null;
  color: string;
  href: string; // pagina del brano
}

export interface Loop { start: number; end: number }

interface PlayerState {
  track: PlayerTrack | null;
  versions: Record<Side, Version | null>;
  active: Side;
  playing: boolean;
  time: number;
  duration: number;
  loop: Loop | null;
  loopOn: boolean;
  error: string | null;
  loadingB: boolean;
}

interface PlayerApi extends PlayerState {
  audio: (side: Side) => HTMLAudioElement;
  activeVersion: Version | null;
  open: (track: PlayerTrack, version: Version, autoplay?: boolean) => Promise<void>;
  setCompare: (version: Version | null) => Promise<void>;
  switchTo: (side: Side) => void;
  toggle: () => void;
  play: () => void;
  seek: (t: number, andPlay?: boolean) => void;
  setLoop: (loop: Loop | null) => void;
  setLoopOn: (on: boolean) => void;
  updateTrack: (patch: Partial<PlayerTrack>) => void;
  close: () => void;
}

const Ctx = createContext<PlayerApi | null>(null);

const initial: PlayerState = {
  track: null, versions: { A: null, B: null }, active: 'A', playing: false, time: 0, duration: 0,
  loop: null, loopOn: false, error: null, loadingB: false,
};

export function PlayerProvider({ children }: { children: ReactNode }) {
  const audios = useRef<Record<Side, HTMLAudioElement> | null>(null);
  if (!audios.current) {
    const mk = () => { const a = new Audio(); a.preload = 'metadata'; return a; };
    audios.current = { A: mk(), B: mk() };
  }
  const [s, setS] = useState<PlayerState>(initial);
  const ref = useRef(s);
  ref.current = s;
  const retried = useRef<Record<Side, boolean>>({ A: false, B: false });

  const el = (side: Side) => audios.current![side];
  const activeEl = () => el(ref.current.active);

  // Eventi dei due lettori: aggiornano lo stato solo se arrivano dal lettore attivo.
  useEffect(() => {
    const cleanups: (() => void)[] = [];
    (['A', 'B'] as Side[]).forEach((side) => {
      const a = el(side);
      const on = (name: string, fn: () => void) => { a.addEventListener(name, fn); cleanups.push(() => a.removeEventListener(name, fn)); };
      const isActive = () => ref.current.active === side;
      on('play', () => isActive() && setS((p) => ({ ...p, playing: true, error: null })));
      on('pause', () => isActive() && setS((p) => ({ ...p, playing: false })));
      on('ended', () => isActive() && setS((p) => ({ ...p, playing: false })));
      on('timeupdate', () => isActive() && setS((p) => ({ ...p, time: a.currentTime })));
      on('loadedmetadata', () => isActive() && isFinite(a.duration) && setS((p) => ({ ...p, duration: a.duration })));
      on('error', () => {
        // Il link firmato scade dopo 3 ore: ne chiedo uno nuovo e riprendo dallo stesso punto.
        const st = ref.current;
        const v = st.versions[side];
        if (!st.track || !v || !a.getAttribute('src')) return;
        if (retried.current[side]) {
          if (isActive()) setS((p) => ({ ...p, playing: false, error: 'Non riesco a riprodurre questa versione. Riprova tra poco.' }));
          return;
        }
        retried.current[side] = true;
        const t = a.currentTime;
        const wasActivePlaying = isActive() && st.playing;
        mediaUrl(st.track.artistId, v.id, false, v.kind ?? 'version').then((url) => {
          a.src = url;
          a.currentTime = t;
          if (wasActivePlaying) void a.play();
        }).catch(() => isActive() && setS((p) => ({ ...p, error: 'Connessione persa. Riprova.' })));
      });
    });
    return () => {
      cleanups.forEach((c) => c());
      // all'uscita (logout) la musica si ferma
      (['A', 'B'] as Side[]).forEach((side) => { const a = el(side); a.pause(); a.removeAttribute('src'); });
    };
  }, []);

  // Loop preciso: controllo a ogni frame mentre suona.
  useEffect(() => {
    if (!s.playing || !s.loopOn || !s.loop) return;
    let raf = 0;
    const tick = () => {
      const a = activeEl();
      const L = ref.current.loop;
      if (L && ref.current.loopOn && (a.currentTime >= L.end || a.currentTime < L.start - 0.25)) a.currentTime = L.start;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [s.playing, s.loopOn, s.loop]);

  const setMediaSession = useCallback((track: PlayerTrack, v: Version | null) => {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: v ? `${track.title} · ${v.label}` : track.title,
      artist: track.artistName,
      album: 'Emotion Studio',
      artwork: track.cover ? [{ src: track.cover, sizes: '512x512' }] : [{ src: '/icon-512.png', sizes: '512x512', type: 'image/png' }],
    });
    navigator.mediaSession.setActionHandler('play', () => void activeEl().play());
    navigator.mediaSession.setActionHandler('pause', () => activeEl().pause());
    navigator.mediaSession.setActionHandler('seekbackward', () => { const a = activeEl(); a.currentTime = Math.max(0, a.currentTime - 10); });
    navigator.mediaSession.setActionHandler('seekforward', () => { const a = activeEl(); a.currentTime = a.currentTime + 10; });
  }, []);

  const open = useCallback(async (track: PlayerTrack, version: Version, autoplay = false) => {
    const st = ref.current;
    if (st.track?.trackId === track.trackId && st.versions[st.active]?.id === version.id) {
      setS((p) => ({ ...p, track: { ...p.track!, ...track } }));
      if (autoplay) void activeEl().play();
      return;
    }
    el('A').pause(); el('B').pause();
    el('B').removeAttribute('src'); el('B').load();
    retried.current = { A: false, B: false };
    setS({ ...initial, track, versions: { A: version, B: null }, duration: version.duration });
    ref.current = { ...initial, track, versions: { A: version, B: null }, duration: version.duration };
    try {
      const url = await mediaUrl(track.artistId, version.id, false, version.kind ?? 'version');
      if (ref.current.versions.A?.id !== version.id) return; // nel frattempo è cambiato brano
      const a = el('A');
      a.src = url;
      setMediaSession(track, version);
      // Su iPhone il browser può bloccare l'avvio automatico dopo il caricamento: resta in pausa, basta un tocco su play
      if (autoplay) await a.play().catch(() => undefined);
    } catch (e) {
      setS((p) => ({ ...p, error: e instanceof Error ? e.message : 'Errore di riproduzione.' }));
    }
  }, [setMediaSession]);

  const switchTo = useCallback((side: Side) => {
    const st = ref.current;
    if (side === st.active || !st.versions[side]) return;
    const from = el(st.active);
    const to = el(side);
    const t = from.currentTime;
    const wasPlaying = !from.paused;
    from.pause();
    const apply = () => {
      to.currentTime = Math.min(t, isFinite(to.duration) ? to.duration - 0.05 : t);
      if (wasPlaying) void to.play();
    };
    if (to.readyState >= 1) apply(); else to.addEventListener('loadedmetadata', apply, { once: true });
    const v = st.versions[side];
    setS((p) => ({ ...p, active: side, time: t, duration: v?.duration || p.duration, playing: wasPlaying }));
    ref.current = { ...ref.current, active: side };
    if (st.track) setMediaSession(st.track, v);
  }, [setMediaSession]);

  const setCompare = useCallback(async (version: Version | null) => {
    const st = ref.current;
    if (!st.track) return;
    if (!version) {
      if (st.active === 'B') switchTo('A');
      el('B').pause(); el('B').removeAttribute('src'); el('B').load();
      setS((p) => ({ ...p, versions: { ...p.versions, B: null } }));
      return;
    }
    setS((p) => ({ ...p, versions: { ...p.versions, B: version }, loadingB: true }));
    try {
      const url = await mediaUrl(st.track.artistId, version.id, false, version.kind ?? 'version');
      const b = el('B');
      b.preload = 'auto';
      b.src = url;
      retried.current.B = false;
    } catch (e) {
      setS((p) => ({ ...p, error: e instanceof Error ? e.message : 'Errore di riproduzione.' }));
    } finally {
      setS((p) => ({ ...p, loadingB: false }));
    }
  }, [switchTo]);

  const api: PlayerApi = {
    ...s,
    audio: el,
    activeVersion: s.versions[s.active],
    open,
    setCompare,
    switchTo,
    toggle: () => { const a = activeEl(); if (a.paused) void a.play().catch(() => undefined); else a.pause(); },
    play: () => void activeEl().play().catch(() => undefined),
    seek: (t, andPlay) => {
      const a = activeEl();
      a.currentTime = Math.max(0, t);
      setS((p) => ({ ...p, time: Math.max(0, t) }));
      if (andPlay) void a.play().catch(() => undefined);
    },
    setLoop: (loop) => setS((p) => ({ ...p, loop, loopOn: loop ? true : false })),
    setLoopOn: (on) => setS((p) => ({ ...p, loopOn: on && !!p.loop })),
    updateTrack: (patch) => setS((p) => (p.track ? { ...p, track: { ...p.track, ...patch } } : p)),
    close: () => {
      el('A').pause(); el('B').pause();
      el('A').removeAttribute('src'); el('B').removeAttribute('src');
      el('A').load(); el('B').load();
      setS(initial);
    },
  };
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function usePlayer(): PlayerApi {
  const v = useContext(Ctx);
  if (!v) throw new Error('usePlayer fuori da PlayerProvider');
  return v;
}
