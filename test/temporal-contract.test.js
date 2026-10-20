import test from 'node:test';
import assert from 'node:assert/strict';
import { Temporal } from 'temporal-polyfill';
import { Recurrence } from '@rrulenet/recurrence';
import { EventSchedule, EventSet } from '../dist/index.mjs';

const instant = value => Temporal.Instant.from(value);
const utc = schedule => schedule.occurrences().map(value => value.toInstant().toString());
function events(start, end) {
  return EventSet.fromJSON({kind: 'event-set', id: 'transition', version: '1', members: [{id: 'window', kind: 'interval', start, end}]});
}

test('autumn event windows retain an elapsed grid phase and both passages', () => {
  const recurrence = Recurrence.elapsed({start: instant('2026-10-24T23:10:00Z'), every: 'PT30M'});
  const schedule = new EventSchedule({events: events('2026-10-25T00:00:00Z', '2026-10-25T02:00:00Z'),
    recurrence, timezone: 'Europe/Paris', transform: {kind: 'during'}});
  const expected = ['2026-10-25T00:10:00Z', '2026-10-25T00:40:00Z', '2026-10-25T01:10:00Z', '2026-10-25T01:40:00Z'];
  assert.deepEqual(utc(schedule), expected);
  assert.deepEqual(utc(EventSchedule.fromJSON(schedule.toJSON())), expected);
});

test('spring event window is half open and does not refill source COUNT', () => {
  const recurrence = Recurrence.elapsed({start: instant('2026-03-29T00:10:00Z'), every: 'PT30M', count: 4});
  const schedule = new EventSchedule({events: events('2026-03-29T00:30:00Z', '2026-03-29T01:40:00Z'),
    recurrence, timezone: 'Europe/Paris', transform: {kind: 'during'}});
  assert.deepEqual(utc(schedule), ['2026-03-29T00:40:00Z', '2026-03-29T01:10:00Z']);
});

test('calendar event projection uses nominal daily time after spring resolution', () => {
  const recurrence = Recurrence.rule({freq: 'DAILY', count: 3,
    start: instant('2026-03-28T01:30:00Z'), tzid: 'Europe/Paris'});
  const schedule = new EventSchedule({events: events('2026-03-28T00:00:00Z', '2026-03-31T00:00:00Z'),
    recurrence, timezone: 'Europe/Paris', transform: {kind: 'during'}});
  assert.deepEqual(utc(schedule), ['2026-03-28T01:30:00Z', '2026-03-29T01:30:00Z', '2026-03-30T00:30:00Z']);
});

for (const start of ['2026-03-29T01:15:00Z', '2026-10-25T01:15:00Z']) {
  test(`exact event offsets preserve elapsed time at ${start}`, () => {
    const end = instant(start).add({hours: 1}).toString();
    const schedule = new EventSchedule({events: events(start, end), timezone: 'Europe/Paris',
      transform: {kind: 'event-relative', triggers: [{before: {minutes: 30}}, {at: 'start'}, {after: {minutes: 15}}]}});
    assert.deepEqual(utc(schedule), [instant(start).subtract({minutes: 30}).toString(), start, instant(end).add({minutes: 15}).toString()]);
  });
}

test('legacy event recurrence needs an explicit migration choice', () => {
  const recurrence = Recurrence.rule({freq: 'HOURLY', count: 4,
    start: instant('2026-10-24T23:30:00Z'), tzid: 'Europe/Paris'});
  const schedule = new EventSchedule({events: events('2026-10-24T23:00:00Z', '2026-10-25T04:00:00Z'),
    recurrence, timezone: 'Europe/Paris', transform: {kind: 'during'}});
  const legacy = JSON.parse(JSON.stringify(schedule.toJSON()));
  delete legacy.recurrence.temporalVersion;
  assert.throws(() => EventSchedule.fromJSON(legacy), /migration choice/);
  assert.deepEqual(utc(EventSchedule.fromJSON(legacy, {legacy: 'calendar'})), utc(schedule));
});
