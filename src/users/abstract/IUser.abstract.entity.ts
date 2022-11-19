import { Column, PrimaryGeneratedColumn } from 'typeorm';

export abstract class IUser {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'first_name' })
  firstName: string;

  @Column({ name: 'last_name' })
  lastName: string;

  @Column()
  dni: string;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column()
  gender: string;

  @Column({ type: 'datetime' })
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
}
