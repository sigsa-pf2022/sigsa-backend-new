import { Injectable } from '@nestjs/common';
import { AppointmentsService } from 'src/appointments/appointments.service';
import { User } from 'src/users/entities/user.entity';
import { MedsEventService } from 'src/meds/meds-event/meds-event.service';
import { Dependent } from 'src/family-groups/entities/dependent.entity';

type NextEventType = 'medication' | 'appointment';

export interface Event {
  id: number;
  type: NextEventType;
  title: string;
  subtitle: string;
  date: Date;
}

@Injectable()
export class EventsService {
  constructor(
    private appointmentsService: AppointmentsService,
    private medEventService: MedsEventService,
  ) {}

  /**
   * Devuelve todos los eventos de un usuario
   * @param user El usuario al cual consulta sus eventos
   * @returns Una lista de eventos ordenanos por fecha
   */
  async getEventsByUser(user: User): Promise<Event[]> {
    const medEvents = await this.medEventService.getNextMedsEventsByUser(user);
    const appointments =
      await this.appointmentsService.getNextAppointmentsByUser(user);

    const typedMedEvents = this._transformMedEvents(medEvents);
    const typedAppointments = this._transformAppointments(appointments);

    const allEvents = this._combineAndSortEvents(
      typedMedEvents,
      typedAppointments,
    );

    return this._lastThreeEvents(allEvents);
  }

  /**
   * Devuelve todos los eventos de un dependiente
   * @param dependent El dependiente al cual consulta sus eventos
   * @returns Una lista de eventos ordenanos por fecha
   */
  async getEventsByDependent(dependent: Dependent): Promise<Event[]> {
    const medEvents = await this.medEventService.getNextMedsEventsByDependent(dependent);
    const appointments =
      await this.appointmentsService.getNextAppointmentsByDependent(dependent);

    const typedMedEvents = this._transformMedEvents(medEvents);
    const typedAppointments = this._transformAppointments(appointments);

    const allEvents = this._combineAndSortEvents(
      typedMedEvents,
      typedAppointments,
    );

    return this._lastThreeEvents(allEvents);
  }

  /**
   * Transform medication events to the common Event format
   */
  private _transformMedEvents(medEvents: any[]): Event[] {
    if (!Array.isArray(medEvents)) return [];
    return (medEvents
      .filter((event) => event && event.med)
      .map((event) => ({
        id: event.id,
        type: 'medication' as const,
        title: event.med?.name || 'Medicamento',
        subtitle: (event.med?.dosage !== undefined && event.med?.dosage !== null)
          ? event.med.dosage.toString()
          : '',
        date: event.date instanceof Date ? event.date : new Date(event.date),
      }))
      .filter(e => !isNaN(e.date.getTime()))) as Event[];
  }

  /**
   * Transform appointments to the common Event format
   */
  private _transformAppointments(appointments: any[]): Event[] {
    if (!Array.isArray(appointments)) return [];
    return (appointments
      .filter(a => a)
      .map((event) => ({
        id: event.id,
        type: 'appointment' as const,
        title: this._getProfessionalName(event),
        subtitle: event.description || '',
        date: event.date instanceof Date ? event.date : new Date(event.date),
      }))
      .filter(e => !isNaN(e.date.getTime()))) as Event[];
  }

  /**
   * Extract professional name from an appointment
   */
  private _getProfessionalName(event: any): string {
    const prof = event?.myProfessional || event?.professional;
    if (!prof) return 'Profesional';
    const first = prof.firstName || '';
    const last = prof.lastName || '';
    return `${first} ${last}`.trim() || 'Profesional';
  }

  /**
   * Combina turnos y medicamentos poniendo primero lo que todavía no pasó.
   *
   * La ventana arranca a las 00:00 de hoy, así que la lista puede traer eventos
   * de esta mañana ya vencidos. Si ordenáramos por fecha a secas, tres tomas
   * pasadas se comerían las tres tarjetas del carrusel y el usuario no vería lo
   * que se viene. Entonces: primero lo pendiente de más cerca a más lejos, y
   * después lo de hoy que ya pasó, de más reciente a más viejo.
   */
  private _combineAndSortEvents(
    medEvents: Event[],
    appointments: Event[],
  ): Event[] {
    const normalize = (e: Event) => ({
      ...e,
      date: e.date instanceof Date ? e.date : new Date(e.date),
    });
    const allEvents = [...(medEvents || []), ...(appointments || [])]
      .filter(e => e && e.date)
      .map(normalize)
      .filter(e => !isNaN(e.date.getTime()));

    const now = Date.now();
    const isUpcoming = (e: Event) => e.date.getTime() >= now;

    return allEvents.sort((a, b) => {
      if (isUpcoming(a) !== isUpcoming(b)) {
        return isUpcoming(a) ? -1 : 1;
      }
      return isUpcoming(a)
        ? a.date.getTime() - b.date.getTime()
        : b.date.getTime() - a.date.getTime();
    });
  }

  /**
   * Limit the number of events returned
   */
  private _lastThreeEvents(events: Event[]): Event[] {
    if (events.length <= 3) {
      return events;
    }
    return events.slice(0, 3);
  }
}
