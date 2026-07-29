/** Qué pasó. Es lo que se lee en el historial del grupo. */
export enum GroupEventAction {
  EVENT_CREATED = 'event_created',
  EVENT_TAKEN_CHARGE = 'event_taken_charge',
  EVENT_CONFIRMED = 'event_confirmed',
  EVENT_CANCELED = 'event_canceled',
  MEMBER_ADDED = 'member_added',
  MEMBER_REMOVED = 'member_removed',
  PROFESSIONAL_LINKED = 'professional_linked',
}

/** Sobre qué pasó. */
export enum GroupEventTargetType {
  MED_EVENT = 'med_event',
  APPOINTMENT = 'appointment',
  DOCUMENT = 'document',
  MEMBER = 'member',
}
