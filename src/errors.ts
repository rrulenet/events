export const EVENT_ERROR_CODES = {
  INVALID_JSON: 'EVENT_INVALID_JSON',
  INVALID_EVENT_SET: 'EVENT_INVALID_EVENT_SET',
  INVALID_EVENT_MEMBER: 'EVENT_INVALID_EVENT_MEMBER',
  INVALID_SCHEDULE: 'EVENT_INVALID_SCHEDULE',
  INVALID_TRANSFORM: 'EVENT_INVALID_TRANSFORM',
  EMPTY_EVENT_SET: 'EVENT_EMPTY_EVENT_SET',
} as const;

export type EventErrorCode = (typeof EVENT_ERROR_CODES)[keyof typeof EVENT_ERROR_CODES];

export class EventScheduleError extends Error {
  readonly code: EventErrorCode;

  constructor(code: EventErrorCode, message: string) {
    super(message);
    this.name = 'EventScheduleError';
    this.code = code;
  }
}

export function eventError(code: EventErrorCode, message: string): never {
  throw new EventScheduleError(code, message);
}
