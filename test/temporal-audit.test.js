import test from 'node:test';
import assert from 'node:assert/strict';
import { Recurrence } from '@rrulenet/recurrence';
import { EventSchedule, EventSet } from '../dist/index.mjs';

test('dense annual recurrence stays bounded by the event window after JSON restoration', () => {
  const recurrence = Recurrence.parse({ rruleString: [
    'DTSTART;VALUE=DATE-TIME;TZID="UTC":20250101T000000',
    `RRULE:FREQ=YEARLY;BYMONTH=1,2,3,4,5,6,7,8,9,10,11,12;BYMONTHDAY=${Array.from({ length: 31 }, (_, i) => i + 1)};BYHOUR=${Array.from({ length: 24 }, (_, i) => i)};BYMINUTE=${Array.from({ length: 60 }, (_, i) => i)};BYSECOND=${Array.from({ length: 60 }, (_, i) => i)}`,
  ].join('\n') });
  const events = EventSet.fromJSON({ kind: 'event-set', id: 'dense', version: '1', members: [
    { id: 'window', kind: 'interval', start: '2025-06-15T12:00:00Z', end: '2025-06-15T12:00:03Z' },
  ] });
  const schedule = new EventSchedule({ events, recurrence, timezone: 'UTC', transform: { kind: 'during' } });
  for (const value of [schedule, EventSchedule.fromJSON(schedule.toJSON())]) {
    assert.deepEqual(value.occurrences().map(date => date.toInstant().toString()), [
      '2025-06-15T12:00:00Z', '2025-06-15T12:00:01Z', '2025-06-15T12:00:02Z',
    ]);
  }
});
