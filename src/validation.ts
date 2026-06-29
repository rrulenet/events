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
    if (key !== 'before' && key !== 'after' && key !== 'time') {
      eventError(EVENT_ERROR_CODES.INVALID_TRANSFORM, `${context}.${key} is not supported`);
    }
  }
  const hasBefore = 'before' in value;
  const hasAfter = 'after' in value;
  if (hasBefore === hasAfter) {
    eventError(EVENT_ERROR_CODES.INVALID_TRANSFORM, `${context} expects exactly one of before or after`);
  }
  if (hasBefore) {
    validateEventRelativeDurationJson(value.before, `${context}.before`);
  }
  if (hasAfter) {
    validateEventRelativeDurationJson(value.after, `${context}.after`);
  }
  assertString(value.time, `${context}.time`);
  try {
    Temporal.PlainTime.from(value.time);
  } catch {
    eventError(EVENT_ERROR_CODES.INVALID_TRANSFORM, `${context}.time expects an ISO plain time`);
  }
}

function validateEventRelativeDurationJson(value: unknown, context: string): asserts value is Required<Pick<EventDurationJson, 'days'>> {
  assertPlainObject(value, context);
  const keys = Object.keys(value);
  for (const key of keys) {
    if (key !== 'days') {
      eventError(EVENT_ERROR_CODES.INVALID_TRANSFORM, `${context}.${key} is not supported`);
    }
  }
  const days = value.days;
  if (typeof days !== 'number' || !Number.isInteger(days) || days < 0) {
    eventError(EVENT_ERROR_CODES.INVALID_TRANSFORM, `${context}.days expects a non-negative integer`);
  }
}

export function validateEventScheduleJson(value: unknown, context = 'EventSchedule.fromJSON()'): asserts value is EventScheduleJson {
  assertPlainObject(value, context);
  if (value.kind !== 'event-schedule') eventError(EVENT_ERROR_CODES.INVALID_SCHEDULE, `${context} expects kind "event-schedule"`);
  assertTimezone(value.timezone, `${context}.timezone`);
  validateEventSetJson(value.events, `${context}.events`);
  validateEventTransformJson(value.transform, `${context}.transform`);
  if (value.transform.kind === 'event-relative') {
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
