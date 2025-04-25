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

  @Column({
    type: 'enum',
    enum: Role,
  })
  role: Role;
  
  @Column()
  type: string;
}
