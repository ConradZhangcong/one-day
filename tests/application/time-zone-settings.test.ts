import { describe, expect, it } from 'vitest';

import {
  APPLICATION_TIME_ZONE_KEY,
  TimeZoneSettingsService,
} from '../../src/application';
import { decodeTimeZoneId } from '../../src/domain';
import { DexieUnitOfWork } from '../../src/infrastructure/db';
import { createTestDatabase } from '../infrastructure/db/test-database';

describe('TimeZoneSettingsService', () => {
  it('persists the detected IANA zone on first launch', async () => {
    const context = await createTestDatabase();
    try {
      const service = new TimeZoneSettingsService(new DexieUnitOfWork(context.db));
      const shanghai = decodeTimeZoneId('Asia/Shanghai');

      await expect(service.inspectDeviceTimeZone(shanghai)).resolves.toEqual({
        applicationTimeZone: shanghai,
        deviceTimeZone: shanghai,
        requiresConfirmation: false,
        initialized: true,
      });
      await expect(context.db.settings.get(APPLICATION_TIME_ZONE_KEY)).resolves.toEqual({
        key: APPLICATION_TIME_ZONE_KEY,
        value: shanghai,
      });
    } finally {
      await context.cleanup();
    }
  });

  it('reports a device-zone change without silently persisting it', async () => {
    const context = await createTestDatabase();
    try {
      const service = new TimeZoneSettingsService(new DexieUnitOfWork(context.db));
      const shanghai = decodeTimeZoneId('Asia/Shanghai');
      const newYork = decodeTimeZoneId('America/New_York');
      await service.inspectDeviceTimeZone(shanghai);

      await expect(service.inspectDeviceTimeZone(newYork)).resolves.toEqual({
        applicationTimeZone: shanghai,
        deviceTimeZone: newYork,
        requiresConfirmation: true,
        initialized: false,
      });
      await expect(
        context.db.settings.get(APPLICATION_TIME_ZONE_KEY),
      ).resolves.toMatchObject({ value: shanghai });
    } finally {
      await context.cleanup();
    }
  });

  it('changes the application zone only through explicit confirmation', async () => {
    const context = await createTestDatabase();
    try {
      const service = new TimeZoneSettingsService(new DexieUnitOfWork(context.db));
      const shanghai = decodeTimeZoneId('Asia/Shanghai');
      const newYork = decodeTimeZoneId('America/New_York');
      await service.inspectDeviceTimeZone(shanghai);

      await expect(service.confirmDeviceTimeZone(newYork)).resolves.toBe(newYork);
      await expect(service.inspectDeviceTimeZone(newYork)).resolves.toMatchObject({
        applicationTimeZone: newYork,
        requiresConfirmation: false,
        initialized: false,
      });
    } finally {
      await context.cleanup();
    }
  });
});
