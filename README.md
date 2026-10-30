<p align="center">
  <a href="https://rrule.net">
    <img src="./assets/avatar.svg" alt="rrule.net" width="96" height="96">
  </a>
</p>

<h1 align="center">@rrulenet/events</h1>

<p align="center">
  Event-set projection layer for contextual scheduling with <code>@rrulenet/recurrence</code>.
</p>

<p align="center">
  <a href="https://rrule.net">rrule.net</a> •
  <strong>@rrulenet ecosystem</strong>
</p>

<p align="center">
  <code>@rrulenet/rrule</code> ·
  <code>@rrulenet/recurrence</code> ·
  <code>@rrulenet/core</code> ·
  <code>@rrulenet/events</code> ·
  <code>@rrulenet/cli</code>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@rrulenet/events"><img src="https://img.shields.io/npm/v/%40rrulenet%2Fevents" alt="npm version"></a>
  <a href="https://jsr.io/@rrulenet/events"><img src="https://img.shields.io/jsr/v/%40rrulenet%2Fevents" alt="JSR version"></a>
  <a href="https://rrulenet.github.io/events/coverage.json"><img src="https://img.shields.io/endpoint?url=https://rrulenet.github.io/events/coverage.json" alt="Coverage"></a>
  <img src="https://img.shields.io/badge/license-MIT-2563EB" alt="MIT License">
</p>

`@rrulenet/events` combines explicit event dates, instants and windows with
recurrences or event-relative triggers. Use it for schedules such as “every day
at 09:00 during a campaign” or “seven days before maintenance at 09:00 local
time”.

Applications supply the event data. The package does not fetch events or ship
an event catalogue. Recurrence rules and their algebra come from
[`@rrulenet/recurrence`](https://github.com/rrulenet/recurrence).

## Install

```bash
npm install @rrulenet/events @rrulenet/recurrence
```

Requires Node.js 20 or later when used with Node. Native Temporal is used where
available; the included polyfill covers other runtimes.

## Example

```js
import { Recurrence } from '@rrulenet/recurrence';
import { EventSchedule } from '@rrulenet/events';

const recurrence = Recurrence.rule({
  freq: 'DAILY',
  byHour: [9],
  start: new Date('2026-11-01T14:00:00Z'),
  tzid: 'America/New_York',
  until: new Date('2026-12-10T14:00:00Z'),
});

const schedule = EventSchedule.fromJSON({
  kind: 'event-schedule',
  timezone: 'America/New_York',
  events: {
    kind: 'event-set',
    id: 'campaign_events_2026',
    version: 'app-supplied-v1',
    members: [
      { kind: 'date', id: 'black_friday_2026', date: '2026-11-27' },
      { kind: 'date', id: 'cyber_monday_2026', date: '2026-11-30' },
    ],
  },
  recurrence: recurrence.toJSON(),
  transform: {
    kind: 'window',
    before: { days: 10 },
    after: { days: 2 },
  },
});

console.log(schedule.occurrences().map((value) => value.toString()));
```

## Event types and transforms

| Event type | Meaning |
| --- | --- |
| `date` | A calendar date in the schedule timezone |
| `point` | An exact instant |
| `interval` | A half-open window `[start, end)` |

Use `during` to keep recurrence occurrences inside the events, or `window` to
extend the event windows by calendar days. These filters preserve the source
recurrence's COUNT and, for elapsed cadences, its exact anchor and phase.

Use `event-relative` to generate triggers directly from event anchors:

- `{ before: { days: 7 }, time: '09:00' }` follows calendar days and local time.
- `{ before: { hours: 2 } }` subtracts an exact elapsed duration.
- `{ at: 'start' }` or `{ at: 'end' }` preserves an exact anchor instant.

Date members support calendar triggers. Point and interval members also support
elapsed triggers; `at: 'end'` requires an interval.

## Persistence and validation

Use `EventSchedule.toJSON()` and `EventSchedule.fromJSON()` to store and restore
schedules. Event timestamps and strictly increasing interval bounds are checked
at ingestion. `isJSON()` and `validateJSON()` provide non-throwing validation.

Nested recurrence JSON retains its temporal format and intention. Calendar
projections follow the recurrence timezone contract; elapsed offsets and exact
points preserve their instants through daylight-saving overlaps.

See the [event scheduling reference](https://github.com/rrulenet/events/blob/main/docs/API.md)
for JSON shapes, anchor rules, legacy JSON adoption and event-relative examples.
