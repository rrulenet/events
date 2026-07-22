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

`@rrulenet/events` is a small event-set projection layer. It combines explicit event sets supplied by an application with transforms that either project a `Recurrence` from `@rrulenet/recurrence` during or around those events, or generate event-relative triggers from those events.

It is not an event catalogue, a data client, or an event-discovery service. Applications own event sourcing, persistence, metadata, permissions, and product-specific availability rules.

## Install

```bash
npm install @rrulenet/events @rrulenet/recurrence
```

## Role

The package answers this question:

```text
given explicit event dates/windows + a transform,
which occurrences should run?
```

For example:

```text
Every day at 09:00 during Black Friday and Cyber Monday
```

or:

```text
Every day at 09:00 from 10 days before Black Friday through 2 days after Cyber Monday
```

or:

```text
Trigger each regional audience 7 days before a maintenance window at 09:00 local time
```

## Boundary With `@rrulenet/recurrence`

`@rrulenet/recurrence` remains the recurrence engine. It owns recurrence parsing, recurrence JSON, point occurrence generation, and recurrence algebra.

`@rrulenet/events` does not extend that API. It depends on `@rrulenet/recurrence` and uses `Recurrence` as the engine for `during` and `window` transforms. Event-relative transforms are not recurrence filters; they generate explicit occurrences from event anchors.

The event layer owns only:

- event-set JSON validation
- date, point, and interval member semantics
- projection of recurrence occurrences onto event dates or event windows
- event-relative trigger occurrences in a target timezone
- deterministic serialization of event schedules

## Data Boundary

Runtime event data does not live in this package.

Applications pass explicit `EventSetJson` objects into the library. Event ids, versions, sources, metadata, curation status, persistence, permissions, and availability rules belong to the application layer.

This package does not fetch event data and does not ship a runtime event catalogue.

Tests include deterministic fixtures such as `black_friday_2026` and `cyber_monday_2026`. They are fixtures, not bundled catalogue data.

## JSON Model

`EventSetJson` contains explicit members:

```ts
type EventSetMemberJson =
  | { kind: 'date'; id: string; date: '2026-11-27' }
  | { kind: 'point'; id: string; at: '2026-11-27T09:00:00Z' }
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

## Example

```js
import { Temporal } from 'temporal-polyfill';
import { Recurrence } from '@rrulenet/recurrence';
import { EventSchedule } from '@rrulenet/events';

const recurrence = Recurrence.rule({
  freq: 'DAILY',
  byHour: [9],
  start: Temporal.ZonedDateTime.from('2026-11-01T09:00:00[America/New_York]'),
  until: Temporal.ZonedDateTime.from('2026-12-10T09:00:00[America/New_York]'),
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

## Event-Relative Example

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

## Future VEVENT Relationship

`@rrulenet/vevent` is intentionally out of scope for this package.

This package keeps date sets, point sets, and interval/window semantics explicit, so a future VEVENT-oriented package can map richer event components into event sets later without forcing VEVENT concepts into this smaller projection layer.

## Development

```bash
npm install
npm test
```
