import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';

import { AttendanceModule } from './attendance/attendance.module';
import { Attendance } from './attendance/attendance.entity';
import { ScheduleController } from './schedule/schedule.controller';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: 'localhost',
      port: 3306,
      username: 'root',
      password: '',
      database: 'student_attendance',
      entities: [Attendance],
      synchronize: true, // Set to false in production
    }),
    AttendanceModule,
  ],
  controllers: [AppController, ScheduleController],
  providers: [AppService],
})
export class AppModule {}
