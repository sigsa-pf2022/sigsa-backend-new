import { User } from '../../users/entities/user.entity';
import { Column, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

export enum EventStatus {
  CREATED = 'created',
  SENDED = 'sended',
  CONFIRMED = 'confirmed',
  DISCARDED = 'discarded',
  CANCELED = 'canceled',
}

export abstract class NotificationEvent {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'timestamp' })
  date: Date;

  @Column({ nullable: true })
  createdById: number;

  @Column({ type: 'enum', enum: ['user', 'dependent', 'professional'] })
  createdByType: string;

  @Column({
    type: 'enum',
    enum: EventStatus,
    default: EventStatus.CREATED,
  })
  status: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  /**
   * Integrante del grupo que se hizo cargo de llevar a cabo el evento del
   * dependiente (dar el medicamento, llevarlo al turno). Null mientras nadie
   * lo tomó. Vive en la base para que lo hereden MedEvent, Appointment y
   * MedicalDocument por igual.
   */
  @Column({ nullable: true })
  takenChargeByUserId: number | null;

  /**
   * Misma columna que `takenChargeByUserId`, como relación, para poder traer
   * el nombre de quien se hizo cargo sin una consulta aparte.
   */
  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'takenChargeByUserId' })
  takenChargeBy: User | null;

  @Column({ type: 'timestamp', nullable: true })
  takenChargeAt: Date | null;
}
