import { Recurrence } from '@rrulenet/recurrence';
import { Temporal } from 'temporal-polyfill';

import { EVENT_ERROR_CODES, eventError } from './errors.ts';
import type {
  EventDurationJson,
  EventRelativeTriggerJson,
  EventScheduleJson,
  EventSetJson,
  EventSetMemberJson,
  EventTransformJson,
  JsonObject,
  JsonValue,
} from './types.ts';

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function assertPlainObject(value: unknown, context: string): asserts value is Record<string, unknown> {
  if (!isPlainObject(value)) {
    eventError(EVENT_ERROR_CODES.INVALID_JSON, `${context} expects a plain JSON object`);
  }
}

export function assertString(value: unknown, context: string): asserts value is string {
  if (typeof value !== 'string' || value.trim() === '') {
    eventError(EVENT_ERROR_CODES.INVALID_JSON, `${context} expects a non-empty string`);
  }
}

export function assertOptionalJsonObject(value: unknown, context: string): asserts value is JsonObject | undefined {
  if (value === undefined) return;
  if (!isJsonObject(value)) {
    eventError(EVENT_ERROR_CODES.INVALID_JSON, `${context} expects a JSON object`);
  }
}

export function assertTimezone(value: unknown, context: string): asserts value is string {
  assertString(value, context);
  try {
    Temporal.Instant.fromEpochMilliseconds(0).toZonedDateTimeISO(value);
  } catch {
    eventError(EVENT_ERROR_CODES.INVALID_JSON, `${context} expects a valid IANA timezone`);
  }
}

export function validateEventSetJson(value: unknown, context = 'EventSet.fromJSON()'): asserts value is EventSetJson {
  assertPlainObject(value, context);
  if (value.kind !== 'event-set') eventError(EVENT_ERROR_CODES.INVALID_EVENT_SET, `${context} expects kind "event-set"`);
  assertString(value.id, `${context}.id`);
  assertString(value.version, `${context}.version`);
  if (value.source !== undefined) assertString(value.source, `${context}.source`);
  if (value.timezone !== undefined && value.timezone !== null) assertTimezone(value.timezone, `${context}.timezone`);
  assertOptionalJsonObject(value.metadata, `${context}.metadata`);
  if (!Array.isArray(value.members)) eventError(EVENT_ERROR_CODES.INVALID_EVENT_SET, `${context}.members expects an array`);
  for (const [index, member] of value.members.entries()) {
    validateEventSetMemberJson(member, `${context}.members[${index}]`);
  }
}

export function validateEventSetMemberJson(value: unknown, context: string): asserts value is EventSetMemberJson {
  assertPlainObject(value, context);
  assertString(value.id, `${context}.id`);
  if (value.label !== undefined) assertString(value.label, `${context}.label`);
  assertOptionalJsonObject(value.metadata, `${context}.metadata`);

  switch (value.kind) {
    case 'date':
      assertString(value.date, `${context}.date`);
      try {
        Temporal.PlainDate.from(value.date);
      } catch {
        eventError(EVENT_ERROR_CODES.INVALID_EVENT_MEMBER, `${context}.date expects an ISO plain date`);
      }
      return;
    case 'point':
      assertString(value.at, `${context}.at`);
      parseTemporalBoundary(value.at, 'UTC', `${context}.at`);
      return;
    case 'interval':
      assertString(value.start, `${context}.start`);
      assertString(value.end, `${context}.end`);
      return;
    default:
      eventError(EVENT_ERROR_CODES.INVALID_EVENT_MEMBER, `${context}.kind expects "date", "point", or "interval"`);
  }
}

export function validateEventTransformJson(value: unknown, context = 'EventSchedule.fromJSON().transform'): asserts value is EventTransformJson {
  assertPlainObject(value, context);
  switch (value.kind) {
    case 'during':
      return;
    case 'window':
      if (value.before !== undefined) validateDurationJson(value.before, `${context}.before`);
      if (value.after !== undefined) validateDurationJson(value.after, `${context}.after`);
      return;
    case 'event-relative':
      if (value.anchor !== undefined && value.anchor !== 'start') {
        eventError(EVENT_ERROR_CODES.INVALID_TRANSFORM, `${context}.anchor expects "start"`);
      }
      if (!Array.isArray(value.triggers) || value.triggers.length === 0) {
        eventError(EVENT_ERROR_CODES.INVALID_TRANSFORM, `${context}.triggers expects a non-empty array`);
      }
      for (const [index, trigger] of value.triggers.entries()) {
        validateEventRelativeTriggerJson(trigger, `${context}.triggers[${index}]`);
      }
      return;
    default:
      eventError(EVENT_ERROR_CODES.INVALID_TRANSFORM, `${context}.kind expects "during", "window", or "event-relative"`);
  }
}

export function validateDurationJson(value: unknown, context: string): asserts value is EventDurationJson {
  assertPlainObject(value, context);
  const days = value.days;
  if (days === undefined) return;
  if (typeof days !== 'number' || !Number.isInteger(days) || days < 0) {
    eventError(EVENT_ERROR_CODES.INVALID_TRANSFORM, `${context}.days expects a non-negative integer`);
  }
}

export function validateEventRelativeTriggerJson(value: unknown, context: string): asserts value is EventRelativeTriggerJson {
  assertPlainObject(value, context);
  const keys = Object.keys(value);
  for (const key of keys) {
    if (key !== 'before' && key !== 'after' && key !== 'at' && key !== 'time') {
      eventError(EVENT_ERROR_CODES.INVALID_TRANSFORM, `${context}.${key} is not supported`);
    }
  }
  const hasBefore = 'before' in value;
  const hasAfter = 'after' in value;
  const hasAt = 'at' in value;
  if (Number(hasBefore) + Number(hasAfter) + Number(hasAt) !== 1) {
    eventError(EVENT_ERROR_CODES.INVALID_TRANSFORM, `${context} expects exactly one of before, after, or at`);
  }

  if (hasAt) {
    if (value.at !== 'start' && value.at !== 'end') {
      eventError(EVENT_ERROR_CODES.INVALID_TRANSFORM, `${context}.at expects "start" or "end"`);
    }
    if (value.time !== undefined) {
      eventError(EVENT_ERROR_CODES.INVALID_TRANSFORM, `${context}.time is not supported for exact anchor triggers`);
    }
    return;
  }

  const durationKind = hasBefore
    ? validateEventRelativeDurationJson(value.before, `${context}.before`)
    : validateEventRelativeDurationJson(value.after, `${context}.after`);

  if (durationKind === 'elapsed') {
    if (value.time !== undefined) {
      eventError(EVENT_ERROR_CODES.INVALID_TRANSFORM, `${context}.time is not supported for exact elapsed triggers`);
    }
    return;
  }

  assertString(value.time, `${context}.time`);
  try {
    Temporal.PlainTime.from(value.time);
  } catch {
    eventError(EVENT_ERROR_CODES.INVALID_TRANSFORM, `${context}.time expects an ISO plain time`);
  }
}

function validateEventRelativeDurationJson(value: unknown, context: string): 'calendar' | 'elapsed' {
  assertPlainObject(value, context);
  const keys = Object.keys(value);
  for (const key of keys) {
    if (key !== 'days' && key !== 'hours' && key !== 'minutes') {
      eventError(EVENT_ERROR_CODES.INVALID_TRANSFORM, `${context}.${key} is not supported`);
    }
  }

  if (value.days !== undefined) {
    if (value.hours !== undefined || value.minutes !== undefined) {
      eventError(EVENT_ERROR_CODES.INVALID_TRANSFORM, `${context} cannot mix calendar days with elapsed hours or minutes`);
    }
    if (typeof value.days !== 'number' || !Number.isInteger(value.days) || value.days < 0) {
      eventError(EVENT_ERROR_CODES.INVALID_TRANSFORM, `${context}.days expects a non-negative integer`);
    }
    return 'calendar';
  }

  if (value.hours === undefined && value.minutes === undefined) {
    eventError(EVENT_ERROR_CODES.INVALID_TRANSFORM, `${context} expects days, hours, or minutes`);
  }

  for (const unit of ['hours', 'minutes'] as const) {
    const amount = value[unit];
    if (amount !== undefined && (typeof amount !== 'number' || !Number.isInteger(amount) || amount < 0)) {
      eventError(EVENT_ERROR_CODES.INVALID_TRANSFORM, `${context}.${unit} expects a non-negative integer`);
    }
  }

  const elapsedHours = (value.hours as number | undefined) ?? 0;
  const elapsedMinutes = (value.minutes as number | undefined) ?? 0;
  if (elapsedHours + elapsedMinutes === 0) {
    eventError(EVENT_ERROR_CODES.INVALID_TRANSFORM, `${context} expects a positive elapsed duration`);
  }

  return 'elapsed';
}

export function validateEventScheduleJson(value: unknown, context = 'EventSchedule.fromJSON()'): asserts value is EventScheduleJson {
  assertPlainObject(value, context);
  if (value.kind !== 'event-schedule') eventError(EVENT_ERROR_CODES.INVALID_SCHEDULE, `${context} expects kind "event-schedule"`);
  assertTimezone(value.timezone, `${context}.timezone`);
  validateEventSetJson(value.events, `${context}.events`);
  validateEventTransformJson(value.transform, `${context}.transform`);
  if (value.transform.kind === 'event-relative') {
    validateExactTriggerEventMembers(value.transform.triggers, value.events.members, `${context}.transform`);
    if ('recurrence' in value && value.recurrence !== undefined) {
      eventError(EVENT_ERROR_CODES.INVALID_SCHEDULE, `${context}.recurrence is not supported for event-relative transforms`);
    }
    return;
  }
  if (!Recurrence.isJSON(value.recurrence)) {
    const result = Recurrence.validateJSON(value.recurrence);
    const detail = result.ok ? 'invalid recurrence JSON' : result.error.message;
    eventError(EVENT_ERROR_CODES.INVALID_SCHEDULE, `${context}.recurrence is invalid: ${detail}`);
  }
}

function validateExactTriggerEventMembers(
  triggers: EventRelativeTriggerJson[],
  members: EventSetMemberJson[],
  context: string,
): void {
  const hasExactTrigger = triggers.some((trigger) =>
    'at' in trigger
    || ('before' in trigger && !('days' in trigger.before))
    || ('after' in trigger && !('days' in trigger.after))
  );
  if (hasExactTrigger && members.some((member) => member.kind === 'date')) {
    eventError(
      EVENT_ERROR_CODES.INVALID_TRANSFORM,
      `${context} exact elapsed and anchor triggers require point or interval event members`,
    );
  }

  const hasEndAnchor = triggers.some((trigger) => 'at' in trigger && trigger.at === 'end');
  if (hasEndAnchor && members.some((member) => member.kind !== 'interval')) {
    eventError(
      EVENT_ERROR_CODES.INVALID_TRANSFORM,
      `${context} exact end anchor triggers require interval event members`,
    );
  }
}

export function parseTemporalBoundary(value: string, timezone: string, context: string): Temporal.ZonedDateTime {
  try {
    if (value.includes('[')) return Temporal.ZonedDateTime.from(value);
    return Temporal.Instant.from(value).toZonedDateTimeISO(timezone);
  } catch {
    eventError(EVENT_ERROR_CODES.INVALID_EVENT_MEMBER, `${context} expects an ISO instant or ZonedDateTime string`);
  }
}

function isJsonObject(value: unknown): value is JsonObject {
  if (!isPlainObject(value)) return false;
  return Object.values(value).every(isJsonValue);
}

function isJsonValue(value: unknown): value is JsonValue {
  if (value === null) return true;
  if (typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJsonValue);
  return isJsonObject(value);
}
