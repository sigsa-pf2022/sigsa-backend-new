import { registerDecorator, ValidationOptions, ValidationArguments } from 'class-validator';

/** ~1MB de base64. Una foto reescalada a 256px pesa unos 20-40KB. */
export const MAX_PHOTO_LENGTH = 1_400_000;

const IMAGE_DATA_URI = /^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+$/;

/**
 * Acepta sólo un data URI de imagen, o null para borrar la foto.
 * Evita que entre cualquier string (o un `data:text/html`) en una columna que
 * después se renderiza como `<img src>`.
 */
export function IsImageDataUri(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isImageDataUri',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: any) {
          if (value === null) return true; // borrar la foto
          if (typeof value !== 'string') return false;
          if (value.length > MAX_PHOTO_LENGTH) return false;
          return IMAGE_DATA_URI.test(value);
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} debe ser una imagen en base64 (jpeg, png o webp) de menos de 1MB`;
        },
      },
    });
  };
}
