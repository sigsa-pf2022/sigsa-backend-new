/**
 * Orden de los listados de eventos: primero los próximos, del más cercano al
 * más lejano; después los que ya pasaron, del más reciente al más viejo.
 *
 * Es el mismo criterio que usa la app en el inicio del grupo y que siguen los
 * tratamientos (getMedTreatmentsByCreator). Con un `date DESC` a secas el turno
 * de mañana quedaba abajo de todos los futuros más lejanos.
 */
export function sortByRelevance<T extends { date: Date | string }>(
  items: T[],
  now = Date.now(),
): T[] {
  const time = (item: T) => new Date(item.date).getTime();
  const isUpcoming = (item: T) => time(item) >= now;

  return [...items].sort((a, b) => {
    if (isUpcoming(a) !== isUpcoming(b)) return isUpcoming(a) ? -1 : 1;
    return isUpcoming(a) ? time(a) - time(b) : time(b) - time(a);
  });
}
