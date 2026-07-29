import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { GroupEventAction, GroupEventTargetType } from '../enums/group-event-action.enum';

/**
 * Historial del grupo: quién hizo qué. Es append-only, nunca se edita.
 *
 * El payload guarda los nombres ya resueltos (medicamento, profesional,
 * dependiente, miembro) para que el historial siga siendo legible aunque
 * después se borre el evento o el miembro al que hacía referencia.
 */
@Entity('group_event_log')
@Index(['groupId', 'createdAt'])
export class GroupEventLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  groupId: number;

  /** Quién lo hizo. Null cuando lo generó el sistema. */
  @Column({ nullable: true })
  actorUserId: number | null;

  @Column({ type: 'enum', enum: GroupEventAction })
  action: GroupEventAction;

  @Column({ type: 'enum', enum: GroupEventTargetType })
  targetType: GroupEventTargetType;

  @Column({ nullable: true })
  targetId: number | null;

  @Column({ type: 'json', nullable: true })
  payload: any;

  @CreateDateColumn()
  createdAt: Date;
}
