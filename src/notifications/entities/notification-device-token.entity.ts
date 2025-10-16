import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type NotificationPlatform = 'android' | 'ios' | 'web';

@Entity('notification_device_tokens')
@Index(['userId'])
@Index(['token'], { unique: true })
export class NotificationDeviceToken {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number;

  @Column({ type: 'enum', enum: ['android','ios','web'] })
  platform: NotificationPlatform;

  @Column()
  token: string;

  @Column({ default: true })
  enabled: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
