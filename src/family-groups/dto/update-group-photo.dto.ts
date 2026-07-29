import { IsImageDataUri } from 'src/users/validators/is-image-data-uri';

export class UpdateGroupPhotoDto {
  /** Data URI de la foto del grupo, o null para borrarla. */
  @IsImageDataUri()
  photo: string | null;
}
