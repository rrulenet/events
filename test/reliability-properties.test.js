import test from 'node:test';
import assert from 'node:assert/strict';
import { Temporal } from 'temporal-polyfill';
import { Recurrence } from '@rrulenet/recurrence';
import { EventSet, EventSchedule, EVENT_ERROR_CODES } from '../dist/index.mjs';

const start = Date.parse('2026-10-24T23:10:00Z');
const step = 30 * 60 * 1000;
const stamp = offset => new Date(start + offset * step).toISOString();
const set = members => ({ kind: 'event-set', id: 'generated', version: '1', members });

test('event interval validation rejects malformed, equal and reversed boundaries at ingestion', () => {
  for (const [begin, end] of [['bad', stamp(2)], [stamp(1), 'bad'], [stamp(2), stamp(2)], [stamp(3), stamp(2)]]) {
    const input = set([{ id: 'invalid', kind: 'interval', start: begin, end }]);
    assert.equal(EventSet.isJSON(input), false);
    const result = EventSet.validateJSON(input);
    assert.equal(result.ok, false);
    assert.equal(result.error.code, EVENT_ERROR_CODES.INVALID_EVENT_MEMBER);
    assert.throws(() => EventSet.fromJSON(input), error => error.code === EVENT_ERROR_CODES.INVALID_EVENT_MEMBER);
  }
  // Repeated local labels can still be an increasing interval of exact instants.
  const overlap = set([{ id: 'overlap', kind: 'interval', start: '2026-10-25T02:30:00+02:00[Europe/Paris]', end: '2026-10-25T02:30:00+01:00[Europe/Paris]' }]);
  assert.equal(EventSet.isJSON(overlap), true);
});

test('generated event windows preserve half-open membership, source COUNT and JSON across timezones', () => {
  const recurrence = Recurrence.elapsed({ start: Temporal.Instant.from(stamp(0)), every: 'PT30M', count: 12 });
  let state = 0x27c0ffee;
  const random = max => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state % max; };
  for (let index = 0; index < 48; index++) {
    const windows = Array.from({ length: 1 + random(4) }, (_, id) => {
      const begin = random(14) - 2;
      return { id: `window-${id}`, kind: 'interval', start: stamp(begin), end: stamp(begin + 1 + random(6)) };
    });
    const expected = Array.from({ length: 12 }, (_, i) => start + i * step)
      .filter(value => windows.some(window => value >= Date.parse(window.start) && value < Date.parse(window.end)));
    const events = EventSet.fromJSON(set([...windows, windows[0]]));
    for (const timezone of ['UTC', 'Europe/Paris', 'Australia/Lord_Howe']) {
      const schedule = new EventSchedule({ events, recurrence, timezone, transform: { kind: 'during' } });
      for (const value of [schedule, EventSchedule.fromJSON(schedule.toJSON())]) {
        assert.deepEqual(value.occurrences().map(date => date.epochMilliseconds), expected, `case=${index}; timezone=${timezone}`);
        const lower = Temporal.Instant.from(stamp(2));
        const upper = Temporal.Instant.from(stamp(8));
        assert.deepEqual(value.between(lower, upper, false).map(date => date.epochMilliseconds),
          expected.filter(time => time > start + 2 * step && time < start + 8 * step));
      }
    }
  }
});
