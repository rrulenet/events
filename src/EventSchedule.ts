import { Recurrence } from '@rrulenet/recurrence';
import { Temporal } from 'temporal-polyfill';

import { EventSet, type EventWindow } from './EventSet.ts';
import { validateEventScheduleJson } from './validation.ts';
import type {
  EventDurationJson,
  EventRelativeTriggerJson,
  EventScheduleJson,
  EventTransformJson,
} from './types.ts';

export class EventSchedule {
  readonly events: EventSet;
  readonly recurrence?: Recurrence;
  readonly timezone: string;
  readonly transform: EventTransformJson;

  constructor(options: {
    events: EventSet;
    recurrence?: Recurrence;
    timezone: string;
    transform: EventTransformJson;
  }) {
    const json: EventScheduleJson = {
      kind: 'event-schedule',
      timezone: options.timezone,
      events: options.events.toJSON(),
      transform: options.transform,
      ...(options.recurrence ? { recurrence: options.recurrence.toJSON() } : {}),
    } as EventScheduleJson;
    validateEventScheduleJson(json);
    this.events = options.events;
    this.recurrence = options.recurrence;
    this.timezone = options.timezone;
    this.transform = cloneJson(options.transform);
  }

  static fromJSON(json: EventScheduleJson): EventSchedule {
    validateEventScheduleJson(json);
    return new EventSchedule({
      events: EventSet.fromJSON(json.events),
      recurrence: 'recurrence' in json ? Recurrence.fromJSON(json.recurrence) : undefined,
      timezone: json.timezone,
      transform: json.transform,
    });
  }

  static isJSON(value: unknown): value is EventScheduleJson {
    return EventSchedule.validateJSON(value).ok;
  }

  static validateJSON(value: unknown): { ok: true } | { ok: false; error: Error } {
    try {
      validateEventScheduleJson(value);
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  toJSON(): EventScheduleJson {
    const json = {
      kind: 'event-schedule',
      timezone: this.timezone,
      events: this.events.toJSON(),
      transform: cloneJson(this.transform),
      ...(this.recurrence ? { recurrence: this.recurrence.toJSON() } : {}),
    } as EventScheduleJson;
    validateEventScheduleJson(json);
    return json;
  }

  occurrences(): Temporal.ZonedDateTime[] {
    return this.project();
  }

  between(after: Temporal.ZonedDateTime | Temporal.Instant | Date, before: Temporal.ZonedDateTime | Temporal.Instant | Date, inc = false): Temporal.ZonedDateTime[] {
    const afterInstant = toInstant(after);
    const beforeInstant = toInstant(before);
    return this.project().filter((value) => {
      const instant = value.toInstant();
      const lower = Temporal.Instant.compare(instant, afterInstant);
      const upper = Temporal.Instant.compare(instant, beforeInstant);
      return (inc ? lower >= 0 : lower > 0) && (inc ? upper <= 0 : upper < 0);
    });
  }

  private project(): Temporal.ZonedDateTime[] {
    switch (this.transform.kind) {
      case 'during':
        return this.projectDuring();
      case 'window':
        return this.projectWindow(this.transform.before, this.transform.after);
      case 'event-relative':
        return this.projectEventRelative(this.transform.triggers);
    }
  }

  private projectDuring(): Temporal.ZonedDateTime[] {
    const occurrences: Temporal.ZonedDateTime[] = [];
    for (const window of this.events.windows(this.timezone)) {
      occurrences.push(...this.occurrencesInWindow(window));
    }
    return sortAndDedupe(occurrences);
  }

  private projectWindow(before?: EventDurationJson, after?: EventDurationJson): Temporal.ZonedDateTime[] {
    const bounds = this.events.bounds(this.timezone);
    const start = bounds.start.subtract(durationToTemporal(before));
    const end = bounds.end.add(durationToTemporal(after));
    return sortAndDedupe(this.occurrencesInWindow({ kind: 'interval', memberId: 'event-window', start, end }));
  }

  private occurrencesInWindow(window: EventWindow): Temporal.ZonedDateTime[] {
    if (!this.recurrence) {
      throw new Error('EventSchedule recurrence is required for recurrence-based transforms');
    }
    return this.recurrence.between(window.start, window.end, true)
      .filter((value) => isWithinHalfOpenWindow(value, window));
  }

  private projectEventRelative(triggers: EventRelativeTriggerJson[]): Temporal.ZonedDateTime[] {
    const occurrences: Temporal.ZonedDateTime[] = [];
    for (const window of this.events.windows(this.timezone)) {
      for (const trigger of triggers) {
        const date = eventRelativeDate(window, trigger);
        const time = Temporal.PlainTime.from(trigger.time);
        occurrences.push(date.toZonedDateTime({ timeZone: this.timezone, plainTime: time }));
      }
    }
    return sortAndDedupe(occurrences);
  }
}

function eventRelativeDate(window: EventWindow, trigger: EventRelativeTriggerJson): Temporal.PlainDate {
  if ('before' in trigger) return window.start.toPlainDate().subtract({ days: trigger.before.days });
  const anchor = window.kind === 'interval' ? window.end : window.start;
  return anchor.toPlainDate().add({ days: trigger.after.days });
}

function isWithinHalfOpenWindow(value: Temporal.ZonedDateTime, window: EventWindow): boolean {
  const instant = value.toInstant();
  return Temporal.Instant.compare(instant, window.start.toInstant()) >= 0
    && Temporal.Instant.compare(instant, window.end.toInstant()) < 0;
}

function sortAndDedupe(values: Temporal.ZonedDateTime[]): Temporal.ZonedDateTime[] {
  const sorted = values.slice().sort((a, b) => Temporal.Instant.compare(a.toInstant(), b.toInstant()));
  const out: Temporal.ZonedDateTime[] = [];
  const seen = new Set<string>();
  for (const value of sorted) {
    const key = value.toInstant().toString();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

function durationToTemporal(value?: EventDurationJson): Temporal.DurationLike {
  return { days: value?.days ?? 0 };
}

function toInstant(value: Temporal.ZonedDateTime | Temporal.Instant | Date): Temporal.Instant {
  if (value instanceof Date) return Temporal.Instant.from(value.toISOString());
  if ('toInstant' in value && typeof value.toInstant === 'function') return value.toInstant();
  return value as Temporal.Instant;
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
