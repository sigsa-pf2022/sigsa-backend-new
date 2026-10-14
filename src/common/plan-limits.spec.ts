import { BadRequestException } from '@nestjs/common';
import { assertFreePlanLimit } from './plan-limits';

describe('assertFreePlanLimit', () => {
  it('deja pasar mientras no se llegó al límite', () => {
    expect(() => assertFreePlanLimit(false, 9, 10, 'turnos activos')).not.toThrow();
  });

  it('rechaza al llegar al límite con un mensaje claro', () => {
    expect(() => assertFreePlanLimit(false, 10, 10, 'turnos activos')).toThrow(
      new BadRequestException('Alcanzaste el límite del plan gratuito: hasta 10 turnos activos.'),
    );
  });

  it('no limita a los usuarios premium', () => {
    expect(() => assertFreePlanLimit(true, 50, 10, 'turnos activos')).not.toThrow();
  });
});
