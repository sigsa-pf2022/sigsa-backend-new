import { sortByRelevance } from './sort-by-relevance';
import { sinceStartOfToday, UPCOMING_FETCH_LIMIT } from './upcoming-window';

describe('sortByRelevance', () => {
  const now = new Date('2026-10-26T12:00:00Z').getTime();
  const at = (h: number) => new Date(now + h * 3600_000);

  it('próximos del más cercano al más lejano, después los pasados del más reciente al más viejo', () => {
    const items = [
      { id: 'pasado-viejo', date: at(-48) },
      { id: 'lejano', date: at(72).toISOString() },
      { id: 'pasado-reciente', date: at(-1) },
      { id: 'cercano', date: at(2) },
    ];
    expect(sortByRelevance(items, now).map((i) => i.id)).toEqual(['cercano', 'lejano', 'pasado-reciente', 'pasado-viejo']);
  });

  it('no modifica el arreglo original y usa la hora actual por defecto', () => {
    const items = [{ date: new Date(0) }, { date: new Date(Date.now() + 3600_000) }];
    const copy = [...items];
    expect(sortByRelevance(items)[0]).toBe(items[1]);
    expect(items).toEqual(copy);
  });
});

describe('upcoming-window', () => {
  it('compara contra el comienzo del día local en la base', () => {
    const operator: any = sinceStartOfToday();
    expect(operator.getSql('"date"')).toBe(`"date" >= DATE_TRUNC('day', LOCALTIMESTAMP)`);
  });

  it('trae más eventos de los que muestra el carrusel', () => {
    expect(UPCOMING_FETCH_LIMIT).toBeGreaterThan(3);
  });
});
