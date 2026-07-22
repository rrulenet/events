import test from 'node:test';
import assert from 'node:assert/strict';
import { Temporal } from 'temporal-polyfill';
import { Recurrence } from '@rrulenet/recurrence';

import {
  EVENT_ERROR_CODES,
  EventSchedule,
  EventScheduleError,
  EventSet,
} from '../dist/index.mjs';

import {
  blackFriday2026,
  cyberMonday2026,
  retailWeekend2026,
} from './fixtures/retail-2026.mjs';

test('EventSet accepts explicit Black Friday and Cyber Monday date fixtures', () => {
  const blackFriday = EventSet.fromJSON(blackFriday2026);
  const cyberMonday = EventSet.fromJSON(cyberMonday2026);

  assert.equal(blackFriday.id, 'black_friday_2026');
  assert.equal(cyberMonday.id, 'cyber_monday_2026');
  assert.deepEqual(blackFriday.windows('Europe/Paris').map((window) => [
    window.start.toString(),
    window.end.toString(),
  ]), [
    [
      '2026-11-27T00:00:00+01:00[Europe/Paris]',
      '2026-11-28T00:00:00+01:00[Europe/Paris]',
    ],
  ]);
});

test('EventSchedule projects a daily 09:00 recurrence during retail event dates in Europe/Paris', () => {
  const schedule = scheduleFor('Europe/Paris', { kind: 'during' });

  assert.deepEqual(schedule.occurrences().map((value) => value.toString()), [
    '2026-11-27T09:00:00+01:00[Europe/Paris]',
    '2026-11-30T09:00:00+01:00[Europe/Paris]',
  ]);
});

test('EventSchedule projects a daily 09:00 recurrence during retail event dates in America/New_York', () => {
  const schedule = scheduleFor('America/New_York', { kind: 'during' });

  assert.deepEqual(schedule.occurrences().map((value) => value.toString()), [
    '2026-11-27T09:00:00-05:00[America/New_York]',
    '2026-11-30T09:00:00-05:00[America/New_York]',
  ]);
});

test('EventSchedule expands a window from 10 days before Black Friday through 2 days after Cyber Monday', () => {
  const schedule = scheduleFor('America/New_York', {
    kind: 'window',
    before: { days: 10 },
    after: { days: 2 },
  });

  const occurrences = schedule.occurrences().map((value) => value.toString());

  assert.equal(occurrences.length, 16);
  assert.equal(occurrences[0], '2026-11-17T09:00:00-05:00[America/New_York]');
  assert.equal(occurrences.at(-1), '2026-12-02T09:00:00-05:00[America/New_York]');
  assert.equal(occurrences.includes('2026-12-03T09:00:00-05:00[America/New_York]'), false);
});

test('EventSchedule projects interval event-relative triggers before the event start in one timezone', () => {
  const schedule = eventRelativeScheduleFor('Australia/Perth', maintenanceEventSet(), [
    { before: { days: 7 }, time: '09:00' },
    { before: { days: 1 }, time: '09:00' },
  ]);

  assert.deepEqual(schedule.occurrences().map((value) => value.toString()), [
    '2026-09-08T09:00:00+08:00[Australia/Perth]',
    '2026-09-14T09:00:00+08:00[Australia/Perth]',
  ]);
  assert.equal('recurrence' in schedule.toJSON(), false);
});

test('EventSchedule projects the same interval event-relative triggers in different target timezones', () => {
  const eventSet = maintenanceEventSet();
  const triggers = [{ before: { days: 7 }, time: '09:00' }];

  assert.deepEqual(eventRelativeScheduleFor('Europe/Paris', eventSet, triggers).occurrences().map((value) => value.toString()), [
    '2026-09-08T09:00:00+02:00[Europe/Paris]',
  ]);
  assert.deepEqual(eventRelativeScheduleFor('Australia/Perth', eventSet, triggers).occurrences().map((value) => value.toString()), [
    '2026-09-08T09:00:00+08:00[Australia/Perth]',
  ]);
});

test('EventSchedule projects event-relative triggers before date events', () => {
  const schedule = eventRelativeScheduleFor('Europe/Paris', {
    kind: 'event-set',
    id: 'inline.black_friday_2026',
    version: 'test',
    members: [
      { kind: 'date', id: 'black_friday_2026', date: '2026-11-27' },
    ],
  }, [
    { before: { days: 7 }, time: '09:00' },
  ]);

  assert.deepEqual(schedule.occurrences().map((value) => value.toString()), [
    '2026-11-20T09:00:00+01:00[Europe/Paris]',
  ]);
});

test('EventSchedule projects event-relative triggers before and after date events', () => {
  const schedule = eventRelativeScheduleFor('Europe/Paris', {
    kind: 'event-set',
    id: 'inline.assumption_2026',
    version: 'test',
    members: [
      { kind: 'date', id: 'assumption_2026', date: '2026-08-15' },
    ],
  }, [
    { before: { days: 7 }, time: '08:00' },
    { after: { days: 2 }, time: '08:00' },
  ]);

  assert.deepEqual(schedule.occurrences().map((value) => value.toString()), [
    '2026-08-08T08:00:00+02:00[Europe/Paris]',
    '2026-08-17T08:00:00+02:00[Europe/Paris]',
  ]);
});

test('EventSchedule projects interval event-relative triggers before start and after end', () => {
  const schedule = eventRelativeScheduleFor('Europe/Paris', {
    kind: 'event-set',
    id: 'inline.two_day_maintenance_2026',
    version: 'test',
    members: [
      {
        kind: 'interval',
        id: 'two-day-maintenance',
        start: '2026-08-15T02:00:00Z',
        end: '2026-08-16T04:00:00Z',
      },
    ],
  }, [
    { before: { days: 7 }, time: '08:00' },
    { after: { days: 2 }, time: '08:00' },
  ]);

  assert.deepEqual(schedule.occurrences().map((value) => value.toString()), [
    '2026-08-08T08:00:00+02:00[Europe/Paris]',
    '2026-08-18T08:00:00+02:00[Europe/Paris]',
  ]);
});

test('EventSchedule projects before and after event-relative triggers in multiple target timezones', () => {
  const eventSet = {
    kind: 'event-set',
    id: 'inline.global_launch_2026_08_15',
    version: 'test',
    source: 'inline',
    timezone: 'UTC',
    members: [
      {
        kind: 'point',
        id: 'global-launch',
        at: '2026-08-15T02:00:00Z',
      },
    ],
  };
  const triggers = [
    { before: { days: 7 }, time: '08:00' },
    { after: { days: 2 }, time: '08:00' },
  ];

  assert.deepEqual(eventRelativeScheduleFor('Europe/Paris', eventSet, triggers).occurrences().map((value) => value.toString()), [
    '2026-08-08T08:00:00+02:00[Europe/Paris]',
    '2026-08-17T08:00:00+02:00[Europe/Paris]',
  ]);
  assert.deepEqual(eventRelativeScheduleFor('Asia/Singapore', eventSet, triggers).occurrences().map((value) => value.toString()), [
    '2026-08-08T08:00:00+08:00[Asia/Singapore]',
    '2026-08-17T08:00:00+08:00[Asia/Singapore]',
  ]);
});

test('EventSchedule event-relative triggers are sorted chronologically and deduped', () => {
  const schedule = eventRelativeScheduleFor('Europe/Paris', maintenanceEventSet(), [
    { before: { days: 1 }, time: '09:00' },
    { before: { days: 7 }, time: '09:00' },
    { before: { days: 7 }, time: '09:00' },
  ]);

  assert.deepEqual(schedule.occurrences().map((value) => value.toString()), [
    '2026-09-08T09:00:00+02:00[Europe/Paris]',
    '2026-09-14T09:00:00+02:00[Europe/Paris]',
  ]);
});

test('EventSchedule event-relative triggers preserve wall-clock time across DST boundaries', () => {
  const schedule = eventRelativeScheduleFor('Europe/Paris', {
    kind: 'event-set',
    id: 'inline.dst_maintenance_2026',
    version: 'test',
    members: [
      {
        kind: 'interval',
        id: 'dst-maintenance',
        start: '2026-03-30T08:00:00Z',
        end: '2026-03-30T10:00:00Z',
      },
    ],
  }, [
    { before: { days: 2 }, time: '09:00' },
    { before: { days: 1 }, time: '09:00' },
  ]);

  assert.deepEqual(schedule.occurrences().map((value) => value.toString()), [
    '2026-03-28T09:00:00+01:00[Europe/Paris]',
    '2026-03-29T09:00:00+02:00[Europe/Paris]',
  ]);
});

test('EventSchedule projects exact elapsed triggers and interval anchors', () => {
  const schedule = eventRelativeScheduleFor('Europe/Paris', maintenanceEventSet(), [
    { before: { hours: 2 } },
    { before: { minutes: 15 } },
    { at: 'start' },
    { at: 'end' },
    { after: { minutes: 30 } },
  ]);

  assert.deepEqual(schedule.occurrences().map((value) => value.toString()), [
    '2026-09-15T02:00:00+02:00[Europe/Paris]',
    '2026-09-15T03:45:00+02:00[Europe/Paris]',
    '2026-09-15T04:00:00+02:00[Europe/Paris]',
    '2026-09-15T06:00:00+02:00[Europe/Paris]',
    '2026-09-15T06:30:00+02:00[Europe/Paris]',
  ]);
});

test('EventSchedule projects exact elapsed triggers around point events', () => {
  const schedule = eventRelativeScheduleFor('Europe/Paris', {
    kind: 'event-set',
    id: 'inline.global_launch_2026_08_15',
    version: 'test',
    members: [
      { kind: 'point', id: 'global-launch', at: '2026-08-15T02:00:00Z' },
    ],
  }, [
    { before: { hours: 2 } },
    { at: 'start' },
    { after: { minutes: 30 } },
  ]);

  assert.deepEqual(schedule.occurrences().map((value) => value.toString()), [
    '2026-08-15T02:00:00+02:00[Europe/Paris]',
    '2026-08-15T04:00:00+02:00[Europe/Paris]',
    '2026-08-15T04:30:00+02:00[Europe/Paris]',
  ]);
});

test('EventSchedule exact elapsed triggers preserve elapsed time across DST boundaries', () => {
  const schedule = eventRelativeScheduleFor('Europe/Paris', {
    kind: 'event-set',
    id: 'inline.dst_maintenance_2026',
    version: 'test',
    members: [
      {
        kind: 'interval',
        id: 'dst-maintenance',
        start: '2026-03-29T01:30:00Z',
        end: '2026-03-29T03:30:00Z',
      },
    ],
  }, [
    { before: { hours: 2 } },
    { at: 'start' },
  ]);

  const occurrences = schedule.occurrences();
  assert.deepEqual(occurrences.map((value) => value.toString()), [
    '2026-03-29T00:30:00+01:00[Europe/Paris]',
    '2026-03-29T03:30:00+02:00[Europe/Paris]',
  ]);
  assert.equal(
    occurrences[0].until(occurrences[1], { largestUnit: 'hours' }).total('hours'),
    2,
  );
});

test('EventSchedule JSON round-trips deterministically', () => {
  const original = scheduleFor('Europe/Paris', {
    kind: 'window',
    before: { days: 10 },
    after: { days: 2 },
  });
  const json = original.toJSON();
  const rebuilt = EventSchedule.fromJSON(json);

  assert.equal(EventSchedule.isJSON(json), true);
  assert.deepEqual(EventSchedule.validateJSON(json), { ok: true });
  assert.deepEqual(rebuilt.toJSON(), json);
  assert.deepEqual(
    rebuilt.occurrences().map((value) => value.toString()),
    original.occurrences().map((value) => value.toString()),
  );
});

test('EventSchedule event-relative JSON round-trips without recurrence', () => {
  const original = eventRelativeScheduleFor('Europe/Paris', maintenanceEventSet(), [
    { before: { days: 7 }, time: '09:00' },
    { before: { hours: 2 } },
    { at: 'start' },
    { at: 'end' },
    { after: { minutes: 30 } },
  ]);
  const json = original.toJSON();
  const rebuilt = EventSchedule.fromJSON(json);

  assert.equal(EventSchedule.isJSON(json), true);
  assert.deepEqual(EventSchedule.validateJSON(json), { ok: true });
  assert.equal('recurrence' in json, false);
  assert.deepEqual(rebuilt.toJSON(), json);
});

test('EventSet and EventSchedule validation reject invalid inputs', () => {
  assert.equal(EventSet.isJSON({ kind: 'event-set', id: 'x', version: '1', members: [] }), true);
  assert.equal(EventSet.isJSON({ kind: 'event-set', id: 'x', version: '1', members: [{ kind: 'date', id: 'x', date: 'nope' }] }), false);

  assert.throws(
    () => EventSchedule.fromJSON({
      kind: 'event-schedule',
      timezone: 'Europe/Paris',
      events: retailWeekend2026,
      recurrence: recurrenceJson('Europe/Paris'),
      transform: { kind: 'window', before: { days: -1 } },
    }),
    (error) =>
      error instanceof EventScheduleError
      && error.code === EVENT_ERROR_CODES.INVALID_TRANSFORM
      && error.message === 'EventSchedule.fromJSON().transform.before.days expects a non-negative integer',
  );

  assert.throws(
    () => EventSchedule.fromJSON({
      kind: 'event-schedule',
      timezone: 'Not/AZone',
      events: retailWeekend2026,
      recurrence: recurrenceJson('Europe/Paris'),
      transform: { kind: 'during' },
    }),
    /timezone expects a valid IANA timezone/,
  );

  assert.throws(
    () => EventSchedule.fromJSON({
      kind: 'event-schedule',
      timezone: 'Europe/Paris',
      events: maintenanceEventSet(),
      transform: {
        kind: 'event-relative',
        triggers: [{ before: { days: 1 }, time: '25:00' }],
      },
    }),
    /transform.triggers\[0\]\.time expects an ISO plain time/,
  );

  assert.throws(
    () => EventSchedule.fromJSON({
      kind: 'event-schedule',
      timezone: 'Europe/Paris',
      events: maintenanceEventSet(),
      transform: {
        kind: 'event-relative',
        triggers: [{ before: { days: -1 }, time: '09:00' }],
      },
    }),
    /transform.triggers\[0\]\.before\.days expects a non-negative integer/,
  );

  assert.equal(EventSchedule.isJSON({
    kind: 'event-schedule',
    timezone: 'Europe/Paris',
    events: maintenanceEventSet(),
    transform: {
      kind: 'event-relative',
      triggers: [{ after: { days: 2 }, time: '08:00' }],
    },
  }), true);

  assert.throws(
    () => EventSchedule.fromJSON({
      kind: 'event-schedule',
      timezone: 'Europe/Paris',
      events: maintenanceEventSet(),
      transform: {
        kind: 'event-relative',
        triggers: [{ time: '08:00' }],
      },
    }),
    /transform.triggers\[0\] expects exactly one of before, after, or at/,
  );

  assert.throws(
    () => EventSchedule.fromJSON({
      kind: 'event-schedule',
      timezone: 'Europe/Paris',
      events: maintenanceEventSet(),
      transform: {
        kind: 'event-relative',
        triggers: [{ before: { days: 7 }, after: { days: 2 }, time: '08:00' }],
      },
    }),
    /transform.triggers\[0\] expects exactly one of before, after, or at/,
  );

  assert.throws(
    () => EventSchedule.fromJSON({
      kind: 'event-schedule',
      timezone: 'Europe/Paris',
      events: maintenanceEventSet(),
      transform: {
        kind: 'event-relative',
        triggers: [{ days_before: 1, time: '09:00' }],
      },
    }),
    /transform.triggers\[0\]\.days_before is not supported/,
  );

  assert.throws(
    () => EventSchedule.fromJSON({
      kind: 'event-schedule',
      timezone: 'Europe/Paris',
      events: maintenanceEventSet(),
      recurrence: recurrenceJson('Europe/Paris'),
      transform: {
        kind: 'event-relative',
        triggers: [{ before: { days: 1 }, time: '09:00' }],
      },
    }),
    /recurrence is not supported for event-relative transforms/,
  );
});

test('EventSchedule validation rejects ambiguous or unsupported exact triggers', () => {
  const invalidCases = [
    {
      trigger: { before: { hours: 2 }, time: '09:00' },
      error: /time is not supported for exact elapsed triggers/,
    },
    {
      trigger: { before: { days: 1, hours: 2 }, time: '09:00' },
      error: /cannot mix calendar days with elapsed hours or minutes/,
    },
    {
      trigger: { before: { hours: 0, minutes: 0 } },
      error: /expects a positive elapsed duration/,
    },
    {
      trigger: { before: {} },
      error: /expects days, hours, or minutes/,
    },
    {
      trigger: { after: { minutes: -1 } },
      error: /minutes expects a non-negative integer/,
    },
    {
      trigger: { after: { hours: 1.5 } },
      error: /hours expects a non-negative integer/,
    },
    {
      trigger: { at: 'middle' },
      error: /at expects "start" or "end"/,
    },
    {
      trigger: { at: 'start', time: '09:00' },
      error: /time is not supported for exact anchor triggers/,
    },
  ];

  for (const { trigger, error } of invalidCases) {
    assert.throws(
      () => eventRelativeScheduleFor('Europe/Paris', maintenanceEventSet(), [trigger]),
      error,
    );
  }

  const dateEventSet = {
    kind: 'event-set',
    id: 'inline.black_friday_2026',
    version: 'test',
    members: [
      { kind: 'date', id: 'black_friday_2026', date: '2026-11-27' },
    ],
  };
  assert.throws(
    () => eventRelativeScheduleFor('Europe/Paris', dateEventSet, [{ before: { hours: 2 } }]),
    /exact elapsed and anchor triggers require point or interval event members/,
  );
  assert.throws(
    () => eventRelativeScheduleFor('Europe/Paris', dateEventSet, [{ at: 'start' }]),
    /exact elapsed and anchor triggers require point or interval event members/,
  );

  const pointEventSet = {
    kind: 'event-set',
    id: 'inline.global_launch_2026_08_15',
    version: 'test',
    members: [
      { kind: 'point', id: 'global-launch', at: '2026-08-15T02:00:00Z' },
    ],
  };
  assert.throws(
    () => eventRelativeScheduleFor('Europe/Paris', pointEventSet, [{ at: 'end' }]),
    /exact end anchor triggers require interval event members/,
  );
});

function scheduleFor(timezone, transform) {
  return EventSchedule.fromJSON({
    kind: 'event-schedule',
    timezone,
    events: retailWeekend2026,
    recurrence: recurrenceJson(timezone),
    transform,
  });
}

function eventRelativeScheduleFor(timezone, events, triggers) {
  return EventSchedule.fromJSON({
    kind: 'event-schedule',
    timezone,
    events,
    transform: {
      kind: 'event-relative',
      triggers,
    },
  });
}

function maintenanceEventSet() {
  return {
    kind: 'event-set',
    id: 'inline.maintenance_2026_09_15',
    version: 'test',
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
  };
}

function recurrenceJson(timezone) {
  return Recurrence.rule({
    freq: 'DAILY',
    byHour: [9],
    byMinute: [0],
    bySecond: [0],
    start: Temporal.ZonedDateTime.from(`2026-11-01T09:00:00[${timezone}]`),
    until: Temporal.ZonedDateTime.from(`2026-12-10T09:00:00[${timezone}]`),
  }).toJSON();
}
