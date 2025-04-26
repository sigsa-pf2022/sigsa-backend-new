import { Injectable } from '@nestjs/common';
import { AppointmentsService } from 'src/appointments/appointments.service';
import { User } from 'src/users/entities/user.entity';
import { MedsEventService } from 'src/meds/meds-event/meds-event.service';


type NextEventType = 'medication' | 'appointment';

// Define a consistent event interface for all event types
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
   * Get all events for a user, combining med events and appointments
   * @param user The user to get events for
   * @returns A list of events sorted by date
   */
  async getEventsByUser(user: User): Promise<Event[]> {
    // STEP 1: Fetch events from different sources
    const medEvents = await this.medEventService.getMedsEventsByUser(user);
    const appointments = await this.appointmentsService.getNextAppointmentsByUser(user);

    // STEP 2: Transform events to a consistent format
    const typedMedEvents = this.transformMedEvents(medEvents);
    const typedAppointments = this.transformAppointments(appointments);

    // STEP 3: Combine and sort events
    const allEvents = this.combineAndSortEvents(typedMedEvents, typedAppointments);

    // STEP 4: Limit to the most recent events
    return this.lastThreeEvents(allEvents);
  }

  /**
   * Transform medication events to the common Event format
   */
  private transformMedEvents(medEvents: any[]): Event[] {
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
  private transformAppointments(appointments: any[]): Event[] {
    return appointments.map((event) => ({
      id: event.id,
      type: 'appointment',
      title: this.getProfessionalName(event),
      subtitle: event.description || '',
      date: event.date,
    }));
  }

  /**
   * Extract professional name from an appointment
   */
  private getProfessionalName(event: any): string {
    if (event.myProfessional) {
      return `${event.myProfessional.firstName} ${event.myProfessional.lastName}`;
    }
    return `${event.professional.firstName} ${event.professional.lastName}`;
  }

  /**
   * Combine and sort events by date
   */
  private combineAndSortEvents(medEvents: Event[], appointments: Event[]): Event[] {
    const allEvents = [...medEvents, ...appointments];
    return allEvents.sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  /**
   * Limit the number of events returned
   */
  private lastThreeEvents(events: Event[]): Event[] {
    if (events.length <= 3) {
      return events;
    }
    return events.slice(0, 3);
  }
}
