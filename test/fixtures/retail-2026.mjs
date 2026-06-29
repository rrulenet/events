export const blackFriday2026 = {
  kind: 'event-set',
  id: 'black_friday_2026',
  version: 'test-fixture-2026',
  source: 'test-fixture',
  metadata: {
    fixture: true,
    note: 'Deterministic retail test fixture, not a runtime catalogue.',
  },
  members: [
    {
      kind: 'date',
      id: 'black_friday_2026',
      label: 'Black Friday 2026',
      date: '2026-11-27',
    },
  ],
};

export const cyberMonday2026 = {
  kind: 'event-set',
  id: 'cyber_monday_2026',
  version: 'test-fixture-2026',
  source: 'test-fixture',
  metadata: {
    fixture: true,
    note: 'Deterministic retail test fixture, not a runtime catalogue.',
  },
  members: [
    {
      kind: 'date',
      id: 'cyber_monday_2026',
      label: 'Cyber Monday 2026',
      date: '2026-11-30',
    },
  ],
};

export const retailWeekend2026 = {
  kind: 'event-set',
  id: 'retail_weekend_2026',
  version: 'test-fixture-2026',
  source: 'test-fixture',
  metadata: {
    fixture: true,
    note: 'Deterministic retail test fixture, not a runtime catalogue.',
  },
  members: [
    blackFriday2026.members[0],
    cyberMonday2026.members[0],
  ],
};

export const christmasSeason2026 = {
  kind: 'event-set',
  id: 'christmas_season_2026',
  version: 'test-fixture-2026',
  source: 'test-fixture',
  metadata: {
    fixture: true,
    note: 'Deterministic retail test fixture, not a runtime catalogue.',
  },
  members: [
    {
      kind: 'interval',
      id: 'christmas_season_2026',
      label: 'Christmas season 2026',
      start: '2026-12-01T00:00:00+01:00[Europe/Paris]',
      end: '2026-12-25T00:00:00+01:00[Europe/Paris]',
    },
  ],
};
