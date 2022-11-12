import {
    Column,
    Entity,
    PrimaryGeneratedColumn,
  } from 'typeorm';
  
  @Entity({ name: 'event_type' })
  export class EventType {
    @PrimaryGeneratedColumn()
    id: number;
  
    @Column()
    name: string;
    
    @Column()
    value: string;
    
    @Column({nullable: true})
    description: string;
    
    @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
    createdAt: Date;
  }
  