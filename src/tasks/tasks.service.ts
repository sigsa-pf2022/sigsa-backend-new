import { Injectable, Logger } from '@nestjs/common';

/**
 * Acá vivía un cron que cada minuto pasaba a `canceled` todo turno en `created`
 * con más de un día. Se apagó a propósito.
 *
 * El problema no era el cron sino lo que afirmaba: nadie había cancelado esos
 * turnos, simplemente habían vencido. Y como los cancelados se filtran de todos
 * los listados (`Not(EventStatus.CANCELED)`), el turno desaparecía de la vista
 * del usuario a las 24 horas sin que él hubiera decidido nada.
 *
 * "Vencido" no necesita escribirse: `resolveEventStatus` en el frontend lo
 * deriva de estado abierto + fecha pasada, y muestra la pastilla VENCIDO. El
 * turno se queda en `created` y a la vista, que es lo correcto.
 *
 * `AppointmentsService.cancelOldCreatedAppointments()` quedó sin llamadores.
 */
@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);
}
