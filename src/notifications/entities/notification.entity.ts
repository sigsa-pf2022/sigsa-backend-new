import { Column, CreateDateColumn, Entity, Index, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { NotificationType } from '../enums/notification-type.enum';
import { NotificationStatus } from '../enums/notification-status.enum';
import { NotificationRecipient } from './notification-recipient.entity'; // explicit import

@Entity('notifications')
@Index(['type', 'referenceId', 'groupId'], { unique: true })
export class Notification {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'enum', enum: NotificationType })
  type: NotificationType;

  @Column()
  referenceId: number; // id del turno o med-event

  @Column({ nullable: true })
  groupId: number | null; // grupo familiar

  @Column({ type: 'timestamp' })
  scheduledFor: Date; // fecha del evento base

  @Column({ type: 'int', default: 0 })
  leadMinutes: number; // minutos de anticipación mostrados al usuario

  @Column({ type: 'enum', enum: NotificationStatus, default: NotificationStatus.CREATED })
  status: NotificationStatus;

  @Column({ type: 'json', nullable: true })
  payload: any; // cache de título/subtítulo o datos serializados

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => NotificationRecipient, (r: NotificationRecipient) => r.notification, { cascade: true })
  recipients: NotificationRecipient[];
}
