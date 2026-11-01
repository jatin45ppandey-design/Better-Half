import { adminService } from '../modules/admin/admin.service.js';

/**
 * Ensure every server-known game has an availability row and the built-in
 * question decks are present before the API accepts traffic.
 *
 * Both seed operations use stable upsert keys and preserve existing admin
 * edits, so running them on every restart is safe and repairs partial seeds.
 */
export async function seedPlatformDefaults(): Promise<void> {
  await Promise.all([
    adminService.seedInitialGameConfigs(),
    adminService.seedQuestionLibrary(),
  ]);
}
