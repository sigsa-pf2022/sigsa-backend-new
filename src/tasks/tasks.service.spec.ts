import { TasksService } from './tasks.service';

describe('TasksService', () => {
  // El cron que cancelaba turnos vencidos se apagó a propósito: el servicio
  // queda vacío y no debe registrar ningún método programado.
  it('se construye sin crons activos', () => {
    const service = new TasksService();
    expect(service).toBeDefined();
    const methods = Object.getOwnPropertyNames(TasksService.prototype).filter((m) => m !== 'constructor');
    expect(methods).toEqual([]);
  });
});
