import { validate } from 'class-validator';
import { IsImageDataUri, MAX_PHOTO_LENGTH } from './is-image-data-uri';

class Dto {
  @IsImageDataUri()
  photo: unknown;
}

const errorsFor = async (photo: unknown) => {
  const dto = new Dto();
  dto.photo = photo;
  return validate(dto);
};

describe('IsImageDataUri', () => {
  it.each([
    ['png', 'data:image/png;base64,iVBORw0KGgo='],
    ['jpeg', 'data:image/jpeg;base64,AAAA'],
    ['webp', 'data:image/webp;base64,AAAA'],
    ['null (borrar la foto)', null],
  ])('acepta %s', async (_caso, value) => {
    await expect(errorsFor(value)).resolves.toHaveLength(0);
  });

  it.each([
    ['un número', 42],
    ['texto cualquiera', 'hola'],
    ['un data URI de HTML', 'data:text/html;base64,PHNjcmlwdD4='],
    ['un SVG', 'data:image/svg+xml;base64,AAAA'],
    ['una imagen de más de 1MB', `data:image/png;base64,${'A'.repeat(MAX_PHOTO_LENGTH)}`],
  ])('rechaza %s con un mensaje claro', async (_caso, value) => {
    const [error] = await errorsFor(value);
    expect(error.constraints.isImageDataUri).toBe(
      'photo debe ser una imagen en base64 (jpeg, png o webp) de menos de 1MB',
    );
  });
});
