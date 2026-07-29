import { NotificationEvent } from '../../events/entities/notification-event.entity';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { Meds } from '../meds/meds.entity';

@Entity()
export class MedEvent extends NotificationEvent {
  @ManyToOne(() => Meds, { nullable: true })
  @JoinColumn()
  med: Meds;

  /**
   * Tratamientos periódicos ("cada 8 hs durante 5 días").
   *
   * Cada toma se materializa como su propia fila para que tenga su propia
   * notificación (la tabla `notifications` es única por
   * (type, referenceId, groupId), así que no puede haber N notificaciones
   * apuntando al mismo evento) y para poder confirmar o hacerse cargo de una
   * toma sin afectar a las demás.
   *
   * Las tomas de un mismo tratamiento comparten `seriesId`. Los eventos de
   * toma única tienen estas cuatro columnas en null.
   */
  @Index()
  @Column({ type: 'uuid', nullable: true })
  seriesId: string | null;

  /** Posición de la toma dentro del tratamiento, arrancando en 1. */
  @Column({ type: 'int', nullable: true })
  doseIndex: number | null;

  /** Cantidad total de tomas del tratamiento. */
  @Column({ type: 'int', nullable: true })
  totalDoses: number | null;

  /** Horas entre toma y toma. */
  @Column({ type: 'int', nullable: true })
  intervalHours: number | null;
}
