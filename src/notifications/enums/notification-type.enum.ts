export enum NotificationType {
  APPOINTMENT = 'appointment',
  MEDICATION = 'medication',
  PROFESSIONAL_LINK_REQUEST = 'professional_link_request',
  PROFESSIONAL_LINK_ACCEPTED = 'professional_link_accepted',
  /**
   * Aviso al paciente de que un profesional lo vinculó.
   *
   * Sólo aplica a pacientes con cuenta propia: ahí el vínculo se crea directo,
   * sin pedir autorización, así que sin este aviso la persona no se enteraría
   * de que alguien pasó a tener acceso a sus documentos.
   */
  PROFESSIONAL_LINKED = 'professional_linked',
  /** Aviso al resto del grupo de que alguien se hizo cargo de un evento. */
  EVENT_TAKEN_CHARGE = 'event_taken_charge',
}
