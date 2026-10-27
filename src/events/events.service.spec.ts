import { Test, TestingModule } from '@nestjs/testing';
import { AppointmentsService } from 'src/appointments/appointments.service';
import { MedsEventService } from 'src/meds/meds-event/meds-event.service';
import { EventsService } from './events.service';

describe('EventsService', () => {
  let service: EventsService;
  let appointments: { getNextAppointmentsByUser: jest.Mock; getNextAppointmentsByDependent: jest.Mock };
  let medEvents: { getNextMedsEventsByUser: jest.Mock; getNextMedsEventsByDependent: jest.Mock };

  const HOUR = 3600_000;
  const at = (h: number) => new Date(Date.now() + h * HOUR);

  beforeEach(async () => {
    appointments = { getNextAppointmentsByUser: jest.fn(async () => []), getNextAppointmentsByDependent: jest.fn(async () => []) };
    medEvents = { getNextMedsEventsByUser: jest.fn(async () => []), getNextMedsEventsByDependent: jest.fn(async () => []) };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventsService,
        { provide: AppointmentsService, useValue: appointments },
        { provide: MedsEventService, useValue: medEvents },
      ],
    }).compile();
    service = module.get<EventsService>(EventsService);
  });

  it('carrusel del usuario: lo próximo primero, después lo de hoy ya pasado, máximo 3', async () => {
    medEvents.getNextMedsEventsByUser.mockResolvedValue([
      { id: 1, med: { name: 'Ibuprofeno', dosage: 400 }, date: at(-1) },
      { id: 2, med: { name: 'Amoxicilina', dosage: 0 }, date: at(3).toISOString() },
    ]);
    appointments.getNextAppointmentsByUser.mockResolvedValue([
      { id: 70, professional: { firstName: 'julia', lastName: 'ruiz' }, description: 'Control', date: at(1) },
      { id: 71, myProfessional: { firstName: 'Ana', lastName: null }, date: at(-3) },
    ]);

    const events = await service.getEventsByUser({ id: 1 } as any);

    expect(events.map((e) => [e.type, e.id])).toEqual([
      ['appointment', 70],
      ['medication', 2],
      ['medication', 1],
    ]);
    expect(events[0]).toMatchObject({ title: 'Dr/a Julia Ruiz', subtitle: 'Control' });
    expect(events[1]).toMatchObject({ title: 'Amoxicilina', subtitle: '0' });
    expect(events[1].date).toBeInstanceOf(Date);
    expect(events[2].subtitle).toBe('400');
  });

  it('dos eventos ya pasados quedan del más reciente al más viejo', async () => {
    appointments.getNextAppointmentsByDependent.mockResolvedValue([
      { id: 1, date: at(-5) },
      { id: 2, date: at(-1) },
    ]);
    const events = await service.getEventsByDependent({ id: 10 } as any);
    expect(events.map((e) => e.id)).toEqual([2, 1]);
    expect(events[0].title).toBe('Profesional');
  });

  it('descarta datos incompletos o fechas inválidas sin romper', async () => {
    medEvents.getNextMedsEventsByDependent.mockResolvedValue([
      null,
      { id: 1, med: null, date: at(1) },
      { id: 2, med: {}, date: 'no-es-fecha' },
      { id: 3, med: { dosage: null }, date: at(2) },
    ]);
    appointments.getNextAppointmentsByDependent.mockResolvedValue([
      null,
      { id: 4, date: 'basura' },
      { id: 5, professional: { firstName: '', lastName: '' }, date: at(1) },
    ]);
    const events = await service.getEventsByDependent({ id: 10 } as any);
    expect(events).toEqual([
      expect.objectContaining({ id: 5, title: 'Profesional', subtitle: '' }),
      expect.objectContaining({ id: 3, title: 'Medicamento', subtitle: '' }),
    ]);
  });

  it('si los servicios no devuelven listas, el carrusel queda vacío', async () => {
    medEvents.getNextMedsEventsByUser.mockResolvedValue(null);
    appointments.getNextAppointmentsByUser.mockResolvedValue(undefined);
    await expect(service.getEventsByUser({ id: 1 } as any)).resolves.toEqual([]);
  });
});
