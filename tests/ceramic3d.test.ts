import assert from 'node:assert/strict';
import test from 'node:test';
import { CERAMIC_PRESETS, CERAMIC_PROFILE_SAMPLES, createCeramicDraft, isCeramicDraft, normalizeCeramicDraft, radiusAt, sculptProfile } from '../src/games/Ceramic3D.logic.ts';

test('all nine ceramic presets have a distinct, bounded profile and round-trip through JSON', () => {
  const signatures = new Set<string>();
  for (const preset of CERAMIC_PRESETS) {
    const draft = createCeramicDraft(preset.id);
    assert.equal(draft.profile.length, CERAMIC_PROFILE_SAMPLES);
    assert.ok(isCeramicDraft(draft));
    assert.deepEqual(normalizeCeramicDraft(JSON.parse(JSON.stringify(draft))), draft);
    assert.equal(radiusAt(draft.profile, 0), draft.profile[0]);
    assert.equal(radiusAt(draft.profile, 1), draft.profile.at(-1));
    signatures.add(JSON.stringify(draft.profile));
  }
  assert.equal(signatures.size, 9);
});

test('sculpting changes only the touched band, keeps the original and distinguishes widening from narrowing', () => {
  const initial = createCeramicDraft().profile, original = initial.slice();
  const wider = sculptProfile(initial, .5, .2, .7, .1, 'widen'), narrower = sculptProfile(initial, .5, .2, .7, .1, 'narrow');
  assert.deepEqual(initial, original);
  assert.equal(wider[0], initial[0]); assert.equal(wider.at(-1), initial.at(-1));
  assert.ok(wider[16] > initial[16]); assert.ok(narrower[16] < initial[16]);
  assert.equal(wider[5], initial[5]);
});

test('repeated extreme gestures remain finite and valid for every tool and preset', () => {
  for (const preset of CERAMIC_PRESETS) for (const tool of ['widen', 'narrow', 'smooth', 'wave'] as const) {
    let draft = createCeramicDraft(preset.id);
    for (let stroke = 0; stroke < 300; stroke++) draft = { ...draft, profile: sculptProfile(draft.profile, (stroke % 33) / 32, .45, 1, .12, tool) };
    assert.ok(isCeramicDraft(draft), `${preset.id}/${tool}`);
  }
});

test('smoothing reduces an isolated ridge, and waves can create both a ridge and a groove', () => {
  const profile = Array(CERAMIC_PROFILE_SAMPLES).fill(.7); profile[16] = 1.2;
  assert.ok(sculptProfile(profile, 16 / 31, .2, 1, .1, 'smooth')[16] < 1.2);
  const wave = sculptProfile(Array(CERAMIC_PROFILE_SAMPLES).fill(.7), .5, .3, 1, .1, 'wave');
  assert.ok(wave.some(radius => radius > .7)); assert.ok(wave.some(radius => radius < .7));
});

test('draft validation rejects nonfinite, unsupported, unbounded and oversized imports', () => {
  const draft = createCeramicDraft();
  for (const invalid of [
    { ...draft, version: 2 }, { ...draft, preset: 'unknown' }, { ...draft, profile: [1, 2] },
    { ...draft, profile: Array(32).fill(Infinity) }, { ...draft, height: NaN }, { ...draft, color: 'red' },
    { ...draft, pattern: 'url' }, { ...draft, view: { azimuth: 99, elevation: .4 } },
    { ...draft, stamps: [{ u: .4, v: .5, type: 'flower', color: '#fff9ed', size: 99 }] },
    { ...draft, stamps: Array(121).fill({ u: .4, v: .5, type: 'flower', color: '#fff9ed', size: .05 }) },
  ]) assert.equal(isCeramicDraft(invalid), false);
});

test('normalization recovers corrupt local data into a valid finite plain-JSON draft', () => {
  const normalized = normalizeCeramicDraft({ preset: 'mug', profile: Array(32).fill(999), height: -7, color: 'broken', finish: 'mirror', patternColor: '#ff0000', pattern: 'petals', view: { azimuth: Infinity, elevation: 99 }, stamps: [null, { u: .4, v: .5, type: 'paw', color: '#fff9ed', size: .05 }] });
  assert.ok(isCeramicDraft(normalized)); assert.equal(normalized.preset, 'mug'); assert.equal(normalized.stamps.length, 1);
  assert.equal(normalized.height, .35); assert.ok(normalized.profile.every(radius => radius === 1.55));
  for (const invalid of [null, undefined, [], 42, 'bad', { profile: Array(32).fill(NaN) }]) assert.ok(isCeramicDraft(normalizeCeramicDraft(invalid)));
});
