/**
 * Deja el email en una forma comparable.
 *
 * Postgres compara `varchar` byte a byte, así que 'Pedro@x.com' y 'pedro@x.com'
 * son dos valores distintos: quien se registraba con mayúsculas (el teclado del
 * teléfono capitaliza la primera letra) después no podía iniciar sesión.
 *
 * Se normaliza en el servicio y no en el DTO a propósito: los `ValidationPipe`
 * de estos controladores no usan `transform: true`, así que un `@Transform`
 * correría pero el controlador seguiría recibiendo el valor original.
 */
export function normalizeEmail(email?: string | null): string {
  return (email ?? '').trim().toLowerCase();
}
