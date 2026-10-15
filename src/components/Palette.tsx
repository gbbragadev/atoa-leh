import { PALETTE } from '../lib/art';
export function Palette({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  return <div className="color-palette" aria-label="Paleta de cores">{PALETTE.map((color, i) =>
    <button key={color} type="button" className={`color-dot ${value === color ? 'selected' : ''}`} style={{ backgroundColor: color }} onClick={() => onChange(color)} aria-label={`Cor ${i + 1}`} aria-pressed={value === color} />
  )}<label className="custom-color" title="Escolher outra cor">+<input type="color" value={value} onChange={e => onChange(e.target.value)} aria-label="Cor personalizada" /></label></div>;
}
