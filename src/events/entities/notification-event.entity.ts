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

  @Column({ type: 'datetime' })
  date: Date;

  @ManyToOne(() => User)
  @JoinColumn()
  createdBy: User;

  @Column({
    type: 'enum',
    enum: EventStatus,
    default: EventStatus.CREATED,
  })
  status: string;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt: Date;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}
