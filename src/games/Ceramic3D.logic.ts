export const CERAMIC_PROFILE_SAMPLES = 32;
export const CERAMIC_PRESET_IDS = ['vase', 'bowl', 'plate', 'mug', 'pitcher', 'amphora', 'planter', 'bottle', 'goblet'] as const;
export type CeramicPresetId = typeof CERAMIC_PRESET_IDS[number];
export const CERAMIC_PATTERN_IDS = ['plain', 'speckles', 'stripes', 'waves', 'petals', 'leaves', 'dots', 'patchwork', 'arches'] as const;
export type CeramicPattern = typeof CERAMIC_PATTERN_IDS[number];
export type CeramicStamp = { u: number; v: number; type: 'flower' | 'paw' | 'leaf' | 'heart'; color: string; size: number };
export type CeramicDraft = {
  version: 1;
  preset: CeramicPresetId;
  profile: number[];
  height: number;
  color: string;
  finish: 'matte' | 'glossy';
  pattern: CeramicPattern;
  patternColor: string;
  stamps: CeramicStamp[];
  view: { azimuth: number; elevation: number };
};
export type SculptTool = 'widen' | 'narrow' | 'smooth' | 'wave';
type Preset = { id: CeramicPresetId; label: string; height: number; knots: [number, number][]; handle?: boolean; floor?: number };
export const CERAMIC_PRESETS: Preset[] = [
  { id: 'vase', label: 'Vasinho', height: 1.95, knots: [[0, .43], [.12, .56], [.38, .77], [.61, .68], [.79, .43], [1, .48]] },
  { id: 'bowl', label: 'Cumbuca', height: .92, knots: [[0, .46], [.14, .54], [.43, .75], [.75, .99], [1, 1.08]] },
  { id: 'plate', label: 'Pratinho', height: .38, knots: [[0, .68], [.15, .82], [.38, 1.08], [.76, 1.27], [1, 1.29]] },
  { id: 'mug', label: 'Caneca', height: 1.4, knots: [[0, .59], [.12, .67], [.5, .69], [.87, .71], [1, .72]], handle: true },
  { id: 'pitcher', label: 'Jarro', height: 2.05, knots: [[0, .48], [.16, .64], [.44, .78], [.7, .56], [.88, .48], [1, .61]], handle: true },
  { id: 'amphora', label: 'Ânfora', height: 2.5, knots: [[0, .37], [.1, .52], [.4, .83], [.65, .71], [.83, .35], [1, .4]] },
  { id: 'planter', label: 'Cachepô', height: 1.25, knots: [[0, .62], [.12, .69], [.55, .82], [.9, .93], [1, .96]] },
  { id: 'bottle', label: 'Garrafinha', height: 2.6, knots: [[0, .49], [.09, .57], [.53, .61], [.72, .34], [.8, .23], [1, .25]] },
  { id: 'goblet', label: 'Taça', height: 2.1, knots: [[0, .65], [.055, .65], [.17, .22], [.46, .2], [.57, .5], [.75, .75], [1, .85]], floor: .49 },
];
export const CERAMIC_PATTERN_LABELS: Record<CeramicPattern, string> = {
  plain: 'Liso', speckles: 'Pintinhas', stripes: 'Listras', waves: 'Maré', petals: 'Jardim', leaves: 'Folhinhas', dots: 'Confete', patchwork: 'Retalhos', arches: 'Arcos',
};
export const CERAMIC_COLORS = [
  { color: '#d59a7c', label: 'Terracota' }, { color: '#f2e5cb', label: 'Creme' }, { color: '#9ead8c', label: 'Sálvia' },
  { color: '#b9c5d1', label: 'Névoa azul' }, { color: '#c8a4ae', label: 'Rosa chá' }, { color: '#d9b56e', label: 'Mel' },
  { color: '#747b69', label: 'Oliva' }, { color: '#bcb0c9', label: 'Lavanda' },
];
export const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const finiteBetween = (value: unknown, min: number, max: number): value is number => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
const isColor = (value: unknown): value is string => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
export function profileForPreset(id: CeramicPresetId): number[] {
  const preset = CERAMIC_PRESETS.find(item => item.id === id) ?? CERAMIC_PRESETS[0];
  return Array.from({ length: CERAMIC_PROFILE_SAMPLES }, (_, index) => {
    const t = index / (CERAMIC_PROFILE_SAMPLES - 1);
    let right = preset.knots.findIndex(knot => knot[0] >= t);
    if (right <= 0) return preset.knots[0][1];
    if (right < 0) right = preset.knots.length - 1;
    const [a, ra] = preset.knots[right - 1], [b, rb] = preset.knots[right];
    const p = (t - a) / (b - a), smooth = p * p * (3 - 2 * p);
    return ra + (rb - ra) * smooth;
  });
}
export function createCeramicDraft(preset: CeramicPresetId = 'vase'): CeramicDraft {
  return { version: 1, preset, profile: profileForPreset(preset), height: CERAMIC_PRESETS.find(item => item.id === preset)!.height, color: '#d59a7c', finish: 'matte', pattern: 'speckles', patternColor: '#f2e5cb', stamps: [], view: { azimuth: .43, elevation: .36 } };
}
export function isCeramicDraft(value: unknown): value is CeramicDraft {
  if (!object(value) || value.version !== 1 || !CERAMIC_PRESET_IDS.includes(value.preset as CeramicPresetId)) return false;
  if (!Array.isArray(value.profile) || value.profile.length !== CERAMIC_PROFILE_SAMPLES || !value.profile.every(radius => finiteBetween(radius, .18, 1.55))) return false;
  if (!finiteBetween(value.height, .35, 2.9) || !isColor(value.color) || !isColor(value.patternColor) || !['matte', 'glossy'].includes(value.finish as string) || !CERAMIC_PATTERN_IDS.includes(value.pattern as CeramicPattern)) return false;
  if (!object(value.view) || !finiteBetween(value.view.azimuth, -Math.PI, Math.PI) || !finiteBetween(value.view.elevation, .12, 1.1)) return false;
  return Array.isArray(value.stamps) && value.stamps.length <= 120 && value.stamps.every(stamp => object(stamp) && finiteBetween(stamp.u, 0, 1) && finiteBetween(stamp.v, 0, 1) && ['flower', 'paw', 'leaf', 'heart'].includes(stamp.type as string) && isColor(stamp.color) && finiteBetween(stamp.size, .025, .14));
}
export function normalizeCeramicDraft(value: unknown): CeramicDraft {
  if (isCeramicDraft(value)) return value;
  if (!object(value)) return createCeramicDraft();
  const preset = CERAMIC_PRESET_IDS.includes(value.preset as CeramicPresetId) ? value.preset as CeramicPresetId : 'vase';
  const fallback = createCeramicDraft(preset);
  return {
    ...fallback,
    profile: Array.isArray(value.profile) && value.profile.length === CERAMIC_PROFILE_SAMPLES ? value.profile.map((radius, index) => typeof radius === 'number' && Number.isFinite(radius) ? clamp(radius, .18, 1.55) : fallback.profile[index]) : fallback.profile,
    height: typeof value.height === 'number' && Number.isFinite(value.height) ? clamp(value.height, .35, 2.9) : fallback.height,
    color: isColor(value.color) ? value.color : fallback.color,
    patternColor: isColor(value.patternColor) ? value.patternColor : fallback.patternColor,
    finish: value.finish === 'glossy' ? 'glossy' : 'matte',
    pattern: CERAMIC_PATTERN_IDS.includes(value.pattern as CeramicPattern) ? value.pattern as CeramicPattern : fallback.pattern,
    stamps: Array.isArray(value.stamps) ? value.stamps.filter(stamp => object(stamp) && finiteBetween(stamp.u, 0, 1) && finiteBetween(stamp.v, 0, 1) && ['flower', 'paw', 'leaf', 'heart'].includes(stamp.type as string) && isColor(stamp.color) && finiteBetween(stamp.size, .025, .14)).slice(0, 120) as CeramicStamp[] : [],
    view: object(value.view) ? { azimuth: typeof value.view.azimuth === 'number' && Number.isFinite(value.view.azimuth) ? clamp(value.view.azimuth, -Math.PI, Math.PI) : fallback.view.azimuth, elevation: typeof value.view.elevation === 'number' && Number.isFinite(value.view.elevation) ? clamp(value.view.elevation, .12, 1.1) : fallback.view.elevation } : fallback.view,
  };
}
/** Local radius edits affect a soft band around the touched height. */
export function sculptProfile(profile: number[], center: number, brushRadius: number, intensity: number, amount: number, tool: SculptTool): number[] {
  const position = clamp(center, 0, 1), radius = clamp(brushRadius, .04, .45), strength = clamp(intensity, .1, 1), delta = clamp(amount, 0, .12);
  return profile.map((current, index) => {
    const t = index / (profile.length - 1), distance = Math.abs(t - position) / radius;
    if (distance >= 1) return current;
    const weight = (1 - distance * distance) ** 2;
    if (tool === 'smooth') {
      const left = profile[Math.max(0, index - 2)], right = profile[Math.min(profile.length - 1, index + 2)];
      return clamp(current + ((left + right) / 2 - current) * weight * strength * Math.min(1, delta * 18), .18, 1.55);
    }
    const direction = tool === 'narrow' ? -1 : tool === 'wave' ? Math.cos((t - position) / radius * Math.PI * 2) : 1;
    return clamp(current + direction * delta * strength * weight, .18, 1.55);
  });
}
export function radiusAt(profile: number[], height: number): number {
  const at = clamp(height, 0, 1) * (profile.length - 1), index = Math.floor(at);
  return profile[index] + ((profile[Math.min(index + 1, profile.length - 1)] ?? profile[index]) - profile[index]) * (at - index);
}
