// Password facile da dettare e copiare: tre parole + due cifre (es. "luna-basso-onda-47").
const WORDS = [
  'luna', 'basso', 'onda', 'ritmo', 'nota', 'sole', 'notte', 'vinile', 'cassa', 'fader',
  'tempo', 'groove', 'coro', 'beat', 'synth', 'piano', 'vento', 'faro', 'blu', 'oro',
  'lampo', 'corda', 'eco', 'fiume', 'stella', 'radio', 'mare', 'neon', 'riff', 'loop',
  'traccia', 'voce', 'stereo', 'brano', 'palco', 'luce', 'fuoco', 'cuffia', 'disco', 'tasto',
];

function rand(max: number): number {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] % max;
}

export function generatePassword(): string {
  const w = () => WORDS[rand(WORDS.length)];
  return `${w()}-${w()}-${w()}-${10 + rand(90)}`;
}
