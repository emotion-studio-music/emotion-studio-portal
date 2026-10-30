// Le 7 fasi di un brano. Il colore "si scalda" dal grigio all'arancio fino all'ambra.
export const STAGES = [
  { key: 'ricevuto', label: 'Ricevuto', color: '#5B5F6A' },
  { key: 'lavorazione', label: 'In lavorazione', color: '#7D6B60' },
  { key: 'mix1', label: 'Mix v1', color: '#A06F4F' },
  { key: 'revisioni', label: 'Revisioni', color: '#C9703A' },
  { key: 'master', label: 'Master', color: '#E06A2C' },
  { key: 'consegnato', label: 'Consegnato', color: '#F16D2F' },
  { key: 'pubblicato', label: 'Pubblicato', color: '#FFB547' },
] as const;
