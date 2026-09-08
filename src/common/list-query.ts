import { FindOperator, Raw } from 'typeorm';

/**
 * Helpers para los listados paginados del backoffice.
 *
 * Todos los filtros llegan por query string, así que siempre son strings (o
 * `undefined` cuando el front no manda el campo). Antes cada servicio armaba
 * el `where` a mano con `Like('%' + name + '%')` y eso rompía de dos formas:
 * un filtro vacío devolvía todo por casualidad, y un filtro ausente terminaba
 * buscando literalmente "%undefined%", que no matchea nada.
 */

/** Acentos que ignoramos al buscar: "mendez" tiene que encontrar a "Méndez". */
const ACCENTED = 'áàäâãéèëêíìïîóòöôõúùüûñç';
const PLAIN = 'aaaaaeeeeiiiiooooouuuunc';

/** Cada filtro necesita su propio parámetro o el último pisa a los anteriores. */
let paramCount = 0;

/**
 * Búsqueda parcial, insensible a mayúsculas y a acentos; undefined si no hay
 * nada que filtrar. El texto se compara ya sin acentos de los dos lados: en SQL
 * con `translate` (no hace falta la extensión unaccent) y en JS normalizando.
 */
export function textFilter(value?: unknown): FindOperator<string> | undefined {
  const text = String(value ?? '').trim();
  if (!text || text === 'undefined' || text === 'null') return undefined;

  const plain = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  const param = `filter_${++paramCount}`;

  return Raw(
    (column) =>
      `translate(lower(${column}), '${ACCENTED}', '${PLAIN}') LIKE :${param}`,
    { [param]: `%${plain}%` },
  );
}

/** Los checkboxes viajan como '0' / '1'. */
export function boolFilter(value?: unknown): boolean {
  return value === true || value === 'true' || value === '1';
}

/** Id de una relación (los selects mandan '' cuando están en blanco). */
export function relationFilter(value?: unknown): { id: number } | undefined {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? { id } : undefined;
}

/** Saca del `where` las claves sin filtro para no restringir de más. */
export function buildWhere<T extends object>(where: T): T {
  return Object.fromEntries(
    Object.entries(where).filter(([, value]) => value !== undefined),
  ) as T;
}

/** `take` / `skip` tolerantes: si la query viene rara, primera página de 10. */
export function paginate(page?: unknown, take?: unknown) {
  const quantity = Number(take) > 0 ? Number(take) : 10;
  const current = Number(page) > 0 ? Number(page) : 0;
  return { take: quantity, skip: current * quantity };
}
