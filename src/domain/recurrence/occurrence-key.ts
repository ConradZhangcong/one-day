import { z } from 'zod';

import { DomainError, DomainErrorCode } from '../errors';
import {
  scheduledPointSchema,
  type ScheduledPoint,
} from '../schedule/time';

const PREFIX = 'occ:v1';
const KEY_PATTERN = /^occ:v1:([^:]+):([1-9]\d*):([dt]):([^:]+)$/;

export interface OccurrenceIdentity {
  readonly seriesId: string;
  readonly revision: number;
  readonly originalAnchor: ScheduledPoint;
}

function encodePart(value: string): string {
  return encodeURIComponent(value);
}

function canonicalKey(identity: OccurrenceIdentity): string {
  const anchorKind = identity.originalAnchor.kind === 'allDay' ? 'd' : 't';
  const anchorValue =
    identity.originalAnchor.kind === 'allDay'
      ? identity.originalAnchor.date
      : identity.originalAnchor.localDateTime;

  return `${PREFIX}:${encodePart(identity.seriesId)}:${identity.revision}:${anchorKind}:${encodePart(anchorValue)}`;
}

function tryParseOccurrenceKeyValue(value: string): OccurrenceIdentity | undefined {
  const match = KEY_PATTERN.exec(value);
  if (match === null) {
    return undefined;
  }

  const encodedSeriesId = match[1];
  const revisionText = match[2];
  const anchorKind = match[3];
  const encodedAnchorValue = match[4];
  if (
    encodedSeriesId === undefined ||
    revisionText === undefined ||
    anchorKind === undefined ||
    encodedAnchorValue === undefined
  ) {
    return undefined;
  }

  try {
    const seriesId = decodeURIComponent(encodedSeriesId);
    const revision = Number(revisionText);
    const anchorValue = decodeURIComponent(encodedAnchorValue);
    const originalAnchor = scheduledPointSchema.parse(
      anchorKind === 'd'
        ? { kind: 'allDay', date: anchorValue }
        : { kind: 'timed', localDateTime: anchorValue },
    );
    const identity = { seriesId, revision, originalAnchor };

    if (
      seriesId.length === 0 ||
      !Number.isSafeInteger(revision) ||
      revision < 1 ||
      canonicalKey(identity) !== value
    ) {
      return undefined;
    }

    return identity;
  } catch {
    return undefined;
  }
}

export const occurrenceKeySchema = z
  .string()
  .refine(
    (value) => tryParseOccurrenceKeyValue(value) !== undefined,
    'Expected a canonical occurrence key.',
  )
  .brand<'OccurrenceKey'>();

export type OccurrenceKey = z.infer<typeof occurrenceKeySchema>;

export function createOccurrenceKey(identity: OccurrenceIdentity): OccurrenceKey;
export function createOccurrenceKey(
  seriesId: string,
  revision: number,
  originalAnchor: ScheduledPoint,
): OccurrenceKey;
export function createOccurrenceKey(
  identityOrSeriesId: OccurrenceIdentity | string,
  revision?: number,
  originalAnchor?: ScheduledPoint,
): OccurrenceKey {
  let identity: OccurrenceIdentity;
  if (typeof identityOrSeriesId === 'string') {
    if (revision === undefined || originalAnchor === undefined) {
      throw new DomainError(
        DomainErrorCode.INVALID_OCCURRENCE_KEY,
        'Creating an occurrence key requires a revision and original anchor.',
        { seriesId: identityOrSeriesId },
      );
    }

    identity = {
      seriesId: identityOrSeriesId,
      revision,
      originalAnchor,
    };
  } else {
    identity = identityOrSeriesId;
  }

  if (
    identity.seriesId.length === 0 ||
    !Number.isSafeInteger(identity.revision) ||
    identity.revision < 1 ||
    !scheduledPointSchema.safeParse(identity.originalAnchor).success
  ) {
    throw new DomainError(
      DomainErrorCode.INVALID_OCCURRENCE_KEY,
      'Cannot create an occurrence key from an invalid identity.',
      { identity },
    );
  }

  return occurrenceKeySchema.parse(canonicalKey(identity));
}

export function tryParseOccurrenceKey(
  input: unknown,
): OccurrenceIdentity | undefined {
  if (typeof input !== 'string') {
    return undefined;
  }

  return tryParseOccurrenceKeyValue(input);
}

export function parseOccurrenceKey(input: unknown): OccurrenceIdentity {
  const parsed = tryParseOccurrenceKey(input);
  if (parsed === undefined) {
    throw new DomainError(
      DomainErrorCode.INVALID_OCCURRENCE_KEY,
      'The occurrence key is malformed or non-canonical.',
      { input },
    );
  }

  return parsed;
}
