import { BadRequestException } from '@nestjs/common';

/**
 * Topes del plan gratuito (modelo freemium del Plan de Negocio). Los usuarios
 * con `premium` no los tienen. No hay pagos: sólo se avisa que se llegó al
 * límite.
 *
 * Turnos y medicamentos cuentan sólo los activos (de hoy en adelante y sin
 * cancelar, el mismo criterio que la lista de próximos); un tratamiento cuenta
 * como un medicamento.
 */
export const FREE_PLAN_LIMITS = {
  meds: 10,
  appointments: 10,
  groups: 5,
  myProfessionals: 10,
};

export function assertFreePlanLimit(
  premium: boolean | undefined,
  current: number,
  limit: number,
  label: string,
) {
  if (premium || current < limit) return;
  throw new BadRequestException(
    `Alcanzaste el límite del plan gratuito: hasta ${limit} ${label}.`,
  );
}
