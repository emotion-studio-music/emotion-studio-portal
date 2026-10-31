export function Stars({ value, onChange, size = 22 }: { value: number; onChange?: (v: number) => void; size?: number }) {
  return (
    <div className="stars" role={onChange ? 'radiogroup' : 'img'} aria-label={`Valutazione ${value} su 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        onChange ? (
          <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} stelle`}
            onClick={() => onChange(value === n ? 0 : n)} style={{ fontSize: size }} className={n <= value ? 'on' : ''}>★</button>
        ) : (
          <span key={n} style={{ fontSize: size }} className={n <= value ? 'on' : ''} aria-hidden="true">★</span>
        )
      ))}
    </div>
  );
}
