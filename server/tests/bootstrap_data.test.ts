import { afterEach, describe, expect, it, vi } from 'vitest';
import { adminService } from '../src/modules/admin/admin.service.js';
import { seedPlatformDefaults } from '../src/lifecycle/bootstrapData.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Platform bootstrap content seeding', () => {
  it('always invokes idempotent game and question seeds instead of gating on one table count', async () => {
    const seedGames = vi
      .spyOn(adminService, 'seedInitialGameConfigs')
      .mockResolvedValue(undefined);
    const seedQuestions = vi
      .spyOn(adminService, 'seedQuestionLibrary')
      .mockResolvedValue(undefined);

    await seedPlatformDefaults();

    expect(seedGames).toHaveBeenCalledOnce();
    expect(seedQuestions).toHaveBeenCalledOnce();
  });

  it('propagates a failed required seed so production bootstrap can fail closed', async () => {
    vi.spyOn(adminService, 'seedInitialGameConfigs').mockResolvedValue(undefined);
    vi.spyOn(adminService, 'seedQuestionLibrary').mockRejectedValue(
      new Error('question table unavailable')
    );

    await expect(seedPlatformDefaults()).rejects.toThrow('question table unavailable');
  });
});
