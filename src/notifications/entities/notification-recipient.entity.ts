import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Notification } from './notification.entity';
import { NotificationRecipientStatus } from '../enums/notification-recipient-status.enum';
import { NotificationRecipientAction } from '../enums/notification-recipient-action.enum';

@Entity('notification_recipients')
@Index(['notificationId', 'userId'], { unique: true })
export class NotificationRecipient {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  notificationId: number;

  @ManyToOne(() => Notification, (n) => n.recipients, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'notificationId' })
  notification: Notification;

  @Column()
  userId: number; // destinatario

  @Column({ type: 'enum', enum: NotificationRecipientStatus, default: NotificationRecipientStatus.PENDING })
  status: NotificationRecipientStatus;

  @Column({ type: 'enum', enum: NotificationRecipientAction, nullable: true })
  action: NotificationRecipientAction | null;

  @Column({ type: 'timestamp', nullable: true })
  deliveredAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  respondedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
