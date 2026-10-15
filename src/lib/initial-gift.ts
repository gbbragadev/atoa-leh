import type { GiftContent } from './gift';
import { getStateRecords, readStored } from './storage';
import { allRecords } from './database';
import type { Creation } from './types';
import { parseBackup, restoreBackup } from './backup';

/** Public gift assets were explicitly approved by Guilherme on 30/09/2026.
 * Existing personal words, creations and layouts always take precedence. */
export async function prepareInitialGift() {
  const existing = readStored<GiftContent | null>('gift-content', null);
  if (existing && (existing.source === 'personal' || existing.letter || existing.notes.length || existing.cats?.length)) return;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch('/presente/inicial.json', { signal: controller.signal });
    if (!response.ok) throw new Error('O presente inicial não abriu.');
    const backup = parseBackup(await response.text());
    const existingKeys = new Set(getStateRecords().map(record => record.key));
    const existingIds = new Set((await allRecords<Creation>('creations')).map(item => item.id));
    backup.state = backup.state.filter(record => record.key === 'gift-content' || !existingKeys.has(record.key));
    backup.creations = backup.creations.filter(item => !existingIds.has(item.id));
    await restoreBackup(JSON.stringify(backup));
  } finally { clearTimeout(timeout); }
}
