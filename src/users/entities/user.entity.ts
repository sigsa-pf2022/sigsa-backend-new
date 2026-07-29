import { Role } from '../../roles/enums/role.enum';
import { Column, Entity, PrimaryGeneratedColumn, TableInheritance } from 'typeorm';

@Entity()
@TableInheritance({ column: { type: "varchar", name: "type" } })
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'first_name' })
  firstName: string;

  @Column({ name: 'last_name' })
  lastName: string;

  @Column({ unique: true })
  dni: string;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column()
  gender: string;

  @Column({ type: 'timestamp' })
  birthday: Date;

  @Column({
    name: 'verification_code',
    nullable: true,
    unique: true,
  })
  verificationCode: number;

  @Column({
    name: 'recovery_password_token',
    nullable: true,
    unique: true,
  })
  recoveryPasswordToken: number;

  @Column({ name: 'email_verified', default: false })
  emailVerified: boolean;

  /**
   * Foto de perfil como data URI ("data:image/jpeg;base64,..."), igual que los
   * documentos guardan su contenido en base64. El front la reescala a 256px
   * antes de subirla: este valor viaja en el login y vive en localStorage, así
   * que tiene que ser chico.
   */
  @Column({ type: 'text', nullable: true })
  photo: string | null;

  @Column({
    type: 'enum',
    enum: Role,
  })
  role: Role;
  
  @Column()
  type: string;
}
