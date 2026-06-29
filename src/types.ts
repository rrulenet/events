import type { RecurrenceJson } from '@rrulenet/recurrence';

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

export interface EventSetBaseMemberJson {
  id: string;
  label?: string;
  metadata?: JsonObject;
}

export interface EventDateMemberJson extends EventSetBaseMemberJson {
  kind: 'date';
  date: string;
}

export interface EventPointMemberJson extends EventSetBaseMemberJson {
  kind: 'point';
  at: string;
}

export interface EventIntervalMemberJson extends EventSetBaseMemberJson {
  kind: 'interval';
  start: string;
  end: string;
}

export type EventSetMemberJson =
  | EventDateMemberJson
  | EventPointMemberJson
  | EventIntervalMemberJson;

export interface EventSetJson {
  kind: 'event-set';
  id: string;
  version: string;
  source?: string;
  timezone?: string | null;
  metadata?: JsonObject;
  members: EventSetMemberJson[];
}

export interface EventDurationJson {
  days?: number;
}

export interface EventRelativeBeforeTriggerJson {
  before: Required<Pick<EventDurationJson, 'days'>>;
  time: string;
}

export interface EventRelativeAfterTriggerJson {
  after: Required<Pick<EventDurationJson, 'days'>>;
  time: string;
}

export type EventRelativeTriggerJson =
  | EventRelativeBeforeTriggerJson
  | EventRelativeAfterTriggerJson;

export interface EventRelativeTransformJson {
  kind: 'event-relative';
  anchor?: 'start';
  triggers: EventRelativeTriggerJson[];
}

export type EventRecurrenceTransformJson =
  | { kind: 'during' }
  | { kind: 'window'; before?: EventDurationJson; after?: EventDurationJson };

export type EventTransformJson =
  | EventRecurrenceTransformJson
  | EventRelativeTransformJson;

export interface EventRecurrenceScheduleJson {
  kind: 'event-schedule';
  timezone: string;
  events: EventSetJson;
  recurrence: RecurrenceJson;
  transform: EventRecurrenceTransformJson;
}

export interface EventRelativeScheduleJson {
  kind: 'event-schedule';
  timezone: string;
  events: EventSetJson;
  transform: EventRelativeTransformJson;
}

export type EventScheduleJson =
  | EventRecurrenceScheduleJson
  | EventRelativeScheduleJson;
