/** Qué pasó. Es lo que se lee en el historial del grupo. */
export enum GroupEventAction {
  EVENT_CREATED = 'event_created',
  EVENT_TAKEN_CHARGE = 'event_taken_charge',
  /** Un integrante avisó que no puede ocuparse. No resuelve el evento. */
  EVENT_DECLINED = 'event_declined',
  /** Se borró un evento cargado por error. La entrada sobrevive al borrado. */
  EVENT_DELETED = 'event_deleted',
  EVENT_CONFIRMED = 'event_confirmed',
  /** Se marcó una toma como "No la tomé". */
  EVENT_SKIPPED = 'event_skipped',
  EVENT_CANCELED = 'event_canceled',
  MEMBER_ADDED = 'member_added',
  MEMBER_REMOVED = 'member_removed',
  PROFESSIONAL_LINKED = 'professional_linked',
  /** Un profesional vinculado dejó una indicación para el dependiente. */
  PROFESSIONAL_NOTE = 'professional_note',
}

/** Sobre qué pasó. */
export enum GroupEventTargetType {
  MED_EVENT = 'med_event',
  APPOINTMENT = 'appointment',
  DOCUMENT = 'document',
  MEMBER = 'member',
}
