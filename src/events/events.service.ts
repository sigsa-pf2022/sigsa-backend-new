import { Injectable } from '@nestjs/common';
import { AppointmentsService } from 'src/appointments/appointments.service';
import { User } from 'src/users/entities/user.entity';
import { MedsEventService } from 'src/meds/meds-event/meds-event.service';

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
    const medEvents = await this.medEventService.getNextMedsEventByUser(user);
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
   * Transform medication events to the common Event format
   */
  private _transformMedEvents(medEvents: any[]): Event[] {
    return medEvents.map((event) => ({
      id: event.id,
      type: 'medication',
      title: event.med.name,
      subtitle: event.med.dosage.toString(),
      date: event.date,
    }));
  }

  /**
   * Transform appointments to the common Event format
   */
  private _transformAppointments(appointments: any[]): Event[] {
    return appointments.map((event) => ({
      id: event.id,
      type: 'appointment',
      title: this._getProfessionalName(event),
      subtitle: event.description || '',
      date: event.date,
    }));
  }

  /**
   * Extract professional name from an appointment
   */
  private _getProfessionalName(event: any): string {
    if (event.myProfessional) {
      return `${event.myProfessional.firstName} ${event.myProfessional.lastName}`;
    }
    return `${event.professional.firstName} ${event.professional.lastName}`;
  }

  /**
   * Combine and sort events by date
   */
  private _combineAndSortEvents(
    medEvents: Event[],
    appointments: Event[],
  ): Event[] {
    const allEvents = [...medEvents, ...appointments];
    return allEvents.sort((a, b) => a.date.getTime() - b.date.getTime());
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
