/**
 * Capitaliza nombres de personas para el texto de las notificaciones.
 *
 * Los nombres se guardan como los tipeó el usuario al registrarse, así que en
 * la base conviven "Pedro Martinez" y "pedra martinez". Se normaliza al armar
 * el push y no al guardar, para que las notificaciones ya existentes también
 * se vean bien.
 *
 * Ojo: sólo para nombres de personas. No aplicar a nombres de medicamentos,
 * que llevan unidades ("Ibuprofeno 400mg" quedaría "Ibuprofeno 400Mg").
 */
export function titleCase(value?: string | null): string {
  if (!value) return '';
  return value
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
