import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('attendance')
export class Attendance {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'char', length: 1 })
  section: string;

  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'time' })
  time: string;

  @Column({ type: 'varchar', length: 45, name: 'ip_address' })
  ipAddress: string;
}