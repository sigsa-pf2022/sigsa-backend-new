/**
 * Configuración de firma de los tokens de sesión.
 *
 * El secreto vive en la variable `JWT_SECRET`, no en el código: con él se firma
 * un token válido de cualquier usuario, así que un valor commiteado equivale a
 * dejar la puerta abierta para siempre — queda en el historial de git aunque
 * después se borre del archivo.
 *
 * Se resuelve a través de `ConfigService` y no leyendo `process.env` acá
 * arriba, porque los decoradores de los módulos se evalúan antes de que
 * `ConfigModule` cargue el `.env`, y el valor llegaría vacío.
 */

/** Longitud mínima razonable para un secreto generado al azar. */
const MIN_LENGTH = 32;

export function resolveJwtSecret(raw?: string | null): string {
  const secret = (raw ?? '').trim();
  if (secret.length < MIN_LENGTH) {
    throw new Error(
      `Falta JWT_SECRET en el .env, o tiene menos de ${MIN_LENGTH} caracteres. ` +
        'Generá uno con: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'base64url\'))"',
    );
  }
  return secret;
}

export const DEFAULT_EXPIRES_IN = '10h';
