import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity()
export class MedsType {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  name: string;
  
  @Column({ nullable: true })
  description: string;

  @Column({ default: false })
  deleted: boolean;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}
