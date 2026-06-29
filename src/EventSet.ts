import { Temporal } from 'temporal-polyfill';

import { EVENT_ERROR_CODES, eventError } from './errors.ts';
import { parseTemporalBoundary, validateEventSetJson } from './validation.ts';
import type { EventSetJson, EventSetMemberJson } from './types.ts';

export interface EventWindow {
  kind: EventSetMemberJson['kind'];
  memberId: string;
  start: Temporal.ZonedDateTime;
  end: Temporal.ZonedDateTime;
}

export class EventSet {
  readonly json: EventSetJson;

  constructor(json: EventSetJson) {
    validateEventSetJson(json);
    this.json = cloneJson(json);
  }

  static fromJSON(json: EventSetJson): EventSet {
    return new EventSet(json);
  }

  static isJSON(value: unknown): value is EventSetJson {
    return EventSet.validateJSON(value).ok;
  }

  static validateJSON(value: unknown): { ok: true } | { ok: false; error: Error } {
    try {
      validateEventSetJson(value);
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  get id(): string {
    return this.json.id;
  }

  get version(): string {
    return this.json.version;
  }

  get members(): EventSetMemberJson[] {
    return this.json.members.map((member) => cloneJson(member));
  }

  toJSON(): EventSetJson {
    return cloneJson(this.json);
  }

  windows(timezone: string): EventWindow[] {
    const windows = this.json.members.map((member) => memberToWindow(member, timezone));
    return windows.sort(compareWindows);
  }

  bounds(timezone: string): { start: Temporal.ZonedDateTime; end: Temporal.ZonedDateTime } {
    const windows = this.windows(timezone);
    if (!windows.length) {
      eventError(EVENT_ERROR_CODES.EMPTY_EVENT_SET, 'EventSet has no members');
    }

    let start = windows[0].start;
    let end = windows[0].end;
    for (const window of windows.slice(1)) {
      if (Temporal.Instant.compare(window.start.toInstant(), start.toInstant()) < 0) start = window.start;
      if (Temporal.Instant.compare(window.end.toInstant(), end.toInstant()) > 0) end = window.end;
    }
    return { start, end };
  }
}

function memberToWindow(member: EventSetMemberJson, timezone: string): EventWindow {
  switch (member.kind) {
    case 'date': {
      const start = Temporal.PlainDate.from(member.date).toZonedDateTime({
        timeZone: timezone,
        plainTime: Temporal.PlainTime.from('00:00:00'),
      });
      return {
        kind: member.kind,
        memberId: member.id,
        start,
        end: start.add({ days: 1 }),
      };
    }
    case 'point': {
      const start = parseTemporalBoundary(member.at, timezone, `EventSet ${member.id}`);
      return {
        kind: member.kind,
        memberId: member.id,
        start,
        end: start.add({ nanoseconds: 1 }),
      };
    }
    case 'interval': {
      const start = parseTemporalBoundary(member.start, timezone, `EventSet ${member.id}.start`);
      const end = parseTemporalBoundary(member.end, timezone, `EventSet ${member.id}.end`);
      if (Temporal.Instant.compare(end.toInstant(), start.toInstant()) <= 0) {
        eventError(EVENT_ERROR_CODES.INVALID_EVENT_MEMBER, `EventSet ${member.id} interval end must be after start`);
      }
      return { kind: member.kind, memberId: member.id, start, end };
    }
  }
}

function compareWindows(a: EventWindow, b: EventWindow): number {
  const start = Temporal.Instant.compare(a.start.toInstant(), b.start.toInstant());
  if (start !== 0) return start;
  return Temporal.Instant.compare(a.end.toInstant(), b.end.toInstant());
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
