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
  /**
   * Aviso al resto del grupo de que un integrante no puede ocuparse.
   *
   * A diferencia de `EVENT_TAKEN_CHARGE`, el evento sigue abierto: es una señal
   * de coordinación, no una resolución. Antes esta acción no avisaba a nadie y
   * el resto no tenía forma de enterarse de que alguien se había bajado.
   */
  EVENT_DECLINED = 'event_declined',
}
