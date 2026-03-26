import { Column, Entity } from 'typeorm';
import { NotificationEvent } from '../events/entities/notification-event.entity';

@Entity()
export class MedicalDocument extends NotificationEvent {
  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'text' })
  fileContent: string; // Base64 encoded file

  @Column()
  fileName: string;

  @Column()
  mimeType: string; // 'application/pdf', 'image/png', 'image/jpeg', etc.

  @Column()
  fileSize: number; // Size in bytes

  @Column({ type: 'date' })
  documentDate: Date; // Date of the medical document (not creation date)
}
