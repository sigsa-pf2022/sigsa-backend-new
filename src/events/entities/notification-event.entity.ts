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
}
