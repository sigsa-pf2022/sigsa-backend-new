import { Raw } from 'typeorm';

/**
 * Ventana de "próximos eventos": desde las 00:00 de hoy en adelante.
 *
 * Antes el filtro era `> NOW()` estricto y un turno de hoy a las 10:00
 * desaparecía del carrusel a las 10:01, justo cuando todavía hace falta que
 * alguien del grupo se haga cargo.
 *
 * Comparamos contra `LOCALTIMESTAMP` y no contra `NOW()` porque la columna
 * `date` es `timestamp` sin zona horaria: así los dos lados de la comparación
 * viven en el mismo dominio y no depende del `TimeZone` de la sesión, que con
 * `NOW()` (que es `timestamptz`) obliga a un casteo implícito.
 */
export const sinceStartOfToday = () =>
  Raw((alias) => `${alias} >= DATE_TRUNC('day', LOCALTIMESTAMP)`);

/**
 * Cuántos eventos pedimos por tipo. Traemos de más porque la lista final mezcla
 * turnos y medicamentos y los reordena poniendo primero lo que todavía no pasó.
 */
export const UPCOMING_FETCH_LIMIT = 6;
