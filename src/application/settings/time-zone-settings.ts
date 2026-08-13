import { decodeTimeZoneId, type TimeZoneId } from '../../domain';
import type { UnitOfWork } from '../repositories';

export const APPLICATION_TIME_ZONE_KEY = 'applicationTimeZone';

export interface TimeZoneInspection {
  readonly applicationTimeZone: TimeZoneId;
  readonly deviceTimeZone: TimeZoneId;
  readonly requiresConfirmation: boolean;
  readonly initialized: boolean;
}

/**
 * Returns the browser's named IANA zone. Numeric offsets are intentionally not
 * accepted because they cannot preserve wall-clock meaning across DST.
 */
export function detectDeviceTimeZone(): TimeZoneId {
  return decodeTimeZoneId(Intl.DateTimeFormat().resolvedOptions().timeZone);
}

/**
 * Owns the application time-zone setting. Detection may initialize an empty
 * database, but a later device-zone change is never persisted by inspection.
 */
export class TimeZoneSettingsService {
  constructor(private readonly unitOfWork: UnitOfWork) {}

  inspectDeviceTimeZone(deviceTimeZone: TimeZoneId): Promise<TimeZoneInspection> {
    return this.unitOfWork.write(async ({ settings }) => {
      const stored = await settings.get(APPLICATION_TIME_ZONE_KEY);

      if (stored === undefined) {
        await settings.set(APPLICATION_TIME_ZONE_KEY, deviceTimeZone);
        return {
          applicationTimeZone: deviceTimeZone,
          deviceTimeZone,
          requiresConfirmation: false,
          initialized: true,
        };
      }

      const applicationTimeZone = decodeTimeZoneId(stored);
      return {
        applicationTimeZone,
        deviceTimeZone,
        requiresConfirmation: applicationTimeZone !== deviceTimeZone,
        initialized: false,
      };
    });
  }

  confirmDeviceTimeZone(deviceTimeZone: TimeZoneId): Promise<TimeZoneId> {
    return this.unitOfWork.write(async ({ settings }) => {
      await settings.set(APPLICATION_TIME_ZONE_KEY, deviceTimeZone);
      return deviceTimeZone;
    });
  }
}
