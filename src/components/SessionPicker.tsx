import { useMemo } from 'react';
import { emptySession, type NextSession } from '../lib/types';
import { longDate, nextDays, parseAt } from '../lib/dates';

const TIMES = ['10:00', '11:00', '14:00', '15:00', '16:00', '17:00', '18:00', '20:00', '21:00'];
const TYPES = ['Registrazione', 'Mix', 'Mastering', 'Produzione', 'Consulenza'];
const DEFAULT_TIME = '15:00';

interface Props {
  value: NextSession;
  onChange: (v: NextSession) => void;
}

/** Scelta rapida della prossima sessione: giorno, ora e tipo con pochi tocchi. */
export function SessionPicker({ value, onChange }: Props) {
  const days = useMemo(() => nextDays(21), []);
  const [date, time] = value.at ? value.at.split('T') : ['', ''];
  const parsed = parseAt(value.at);
  const inStrip = days.some((d) => d.key === date);

  const setDate = (d: string) => onChange({ ...value, at: d ? `${d}T${time || DEFAULT_TIME}` : '' });
  const setTime = (t: string) => onChange({ ...value, at: `${date || days[0].key}T${t}` });
  const setType = (t: string) => onChange({ ...value, type: value.type === t ? '' : t });

  return (
    <div className="form" style={{ gap: 18 }}>
      <div className="field">
        <span>Giorno</span>
        <div className="pick-row" role="group" aria-label="Giorno">
          {days.map((d) => (
            <button key={d.key} type="button" className="pick pick-day" aria-pressed={date === d.key}
              aria-label={d.label} onClick={() => setDate(d.key)}>
              <small>{d.dayShort}</small>
              <strong>{d.day}</strong>
              <small>{d.monthShort}</small>
            </button>
          ))}
          <label className="pick pick-day pick-other" data-active={date && !inStrip ? 'true' : undefined}>
            <small>altra</small>
            <strong>…</strong>
            <small>data</small>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Scegli un’altra data" />
          </label>
        </div>
      </div>

      <div className="field">
        <span>Ora</span>
        <div className="pick-wrap" role="group" aria-label="Ora">
          {TIMES.map((t) => (
            <button key={t} type="button" className="pick" aria-pressed={time === t} onClick={() => setTime(t)}>{t}</button>
          ))}
          <input className="input pick-time" type="time" step={900} value={time}
            onChange={(e) => e.target.value && setTime(e.target.value)} aria-label="Altro orario" />
        </div>
      </div>

      <div className="field">
        <span>Tipo</span>
        <div className="pick-wrap" role="group" aria-label="Tipo di sessione">
          {TYPES.map((t) => (
            <button key={t} type="button" className="pick" aria-pressed={value.type === t} onClick={() => setType(t)}>{t}</button>
          ))}
        </div>
      </div>

      <label className="field">
        <span>Nota per l’artista (facoltativa)</span>
        <input className="input" value={value.note} onChange={(e) => onChange({ ...value, note: e.target.value })}
          placeholder="Porta il testo definitivo" />
      </label>

      <div className="session-preview">
        {parsed ? (
          <span>
            L’artista vedrà: <strong>{longDate(parsed)}, ore {time}{value.type ? ` · ${value.type}` : ''}</strong>
          </span>
        ) : (
          <span className="muted">Nessuna sessione in programma: il riquadro non compare nella home dell’artista.</span>
        )}
        {(value.at || value.type || value.note) && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange(emptySession)}>Rimuovi sessione</button>
        )}
      </div>
    </div>
  );
}
