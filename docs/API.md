# Event scheduling reference

[Package overview](../README.md) · [Release history](https://github.com/rrulenet/events/releases)

## Table of contents

- [JSON Model](#json-model)
- [Event-relative example](#event-relative-example)
- [JSON persistence](#json-persistence)

## JSON Model

`EventSetJson` contains explicit members:

```ts
type EventSetMemberJson =
  | { kind: 'date'; id: string; date: string }
  | { kind: 'point'; id: string; at: string }
  | { kind: 'interval'; id: string; start: string; end: string };
```

For recurrence projection, the schedule combines events, recurrence, and transform:

```ts
type EventScheduleJson = {
  kind: 'event-schedule';
  timezone: string;
  events: EventSetJson;
  recurrence: RecurrenceJson;
  transform:
    | { kind: 'during' }
    | { kind: 'window'; before?: { days?: number }; after?: { days?: number } };
};
```

For event-relative triggers, `recurrence` is intentionally absent:

```ts
type EventScheduleJson = {
  kind: 'event-schedule';
  timezone: string;
  events: EventSetJson;
  transform: {
    kind: 'event-relative';
    anchor?: 'start';
    triggers: Array<
      | { before: { days: number }; time: string }
      | { after: { days: number }; time: string }
      | { before: ElapsedDuration }
      | { after: ElapsedDuration }
      | { at: 'start' | 'end' }
    >;
  };
};

type ElapsedDuration =
  | { hours: number; minutes?: number }
  | { hours?: number; minutes: number };
```

Date members are calendar dates. They are projected into the schedule timezone as half-open local-day windows:

```text
[YYYY-MM-DDT00:00, next local midnight)
```

Point members are exact temporal points. Interval members are half-open windows:

```text
[start, end)
```

Event-relative transforms deliberately distinguish calendar projection from
elapsed-time arithmetic.

Calendar triggers use integer `days` plus a required local `time`:

- date members anchor on their date
- point members anchor on the point instant converted to the schedule timezone
- interval `before` triggers anchor on the interval start instant converted to the schedule timezone
- interval `after` triggers anchor on the interval end instant converted to the schedule timezone

They apply calendar days to the local anchor date, then combine the resulting
date with the supplied wall-clock time. The local time therefore remains stable
across daylight-saving transitions.

Exact elapsed triggers use non-negative integer `hours`, `minutes`, or both,
with a positive total duration, and do not accept `time`. They subtract from the
start instant for `before`, and add to the interval end or point instant for
`after`. Exact `{ at: 'start' }` and `{ at: 'end' }` triggers project the
corresponding instant directly.

Date members support only calendar triggers because a date does not identify an
exact instant. Point members support elapsed triggers and `at: 'start'`.
Interval members support every trigger, including `at: 'end'`. Every trigger
must contain exactly one of `before`, `after`, or `at`; calendar `days` cannot be
mixed with elapsed `hours` or `minutes`.

## Event-relative example

```js
import { EventSchedule } from '@rrulenet/events';

const schedule = EventSchedule.fromJSON({
  kind: 'event-schedule',
  timezone: 'Australia/Perth',
  events: {
    kind: 'event-set',
    id: 'inline.maintenance.2026-09-15',
    version: 'user-snapshot-1',
    source: 'inline',
    timezone: 'UTC',
    members: [
      {
        kind: 'interval',
        id: 'maintenance-window',
        start: '2026-09-15T02:00:00Z',
        end: '2026-09-15T04:00:00Z',
      },
    ],
  },
  transform: {
    kind: 'event-relative',
    triggers: [
      { before: { days: 7 }, time: '09:00' },
      { before: { hours: 2 } },
      { before: { minutes: 15 } },
      { at: 'start' },
      { at: 'end' },
      { after: { minutes: 30 } },
      { after: { days: 2 }, time: '09:00' },
    ],
  },
});

console.log(schedule.occurrences().map((value) => value.toString()));
// [
//   '2026-09-08T09:00:00+08:00[Australia/Perth]',
//   '2026-09-15T08:00:00+08:00[Australia/Perth]',
//   '2026-09-15T09:45:00+08:00[Australia/Perth]',
//   '2026-09-15T10:00:00+08:00[Australia/Perth]',
//   '2026-09-15T12:00:00+08:00[Australia/Perth]',
//   '2026-09-15T12:30:00+08:00[Australia/Perth]',
//   '2026-09-17T09:00:00+08:00[Australia/Perth]'
// ]
```


## JSON persistence

Use `EventSchedule.toJSON()` and `EventSchedule.fromJSON()` to persist and
restore schedules. Nested recurrence JSON uses `temporalVersion: 2`; event-set
versions describe application-supplied data separately.

For reviewed legacy calendar definitions,
`EventSchedule.fromJSON(json, { legacy: 'calendar' })` explicitly selects the
calendar interpretation. Unknown temporal versions fail. Update all readers
and workers before writing migrated JSON, and keep the original definitions
for rollback.
