import { Controller, Get, Post, Put, Body, HttpException, HttpStatus } from '@nestjs/common';
import { AttendanceService } from '../attendance/attendance.service';

@Controller('schedule')
export class ScheduleController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Get()
  async getSchedule() {
    try {
      const settings = await this.attendanceService.getScheduleSettings();
      return {
        success: true,
        data: settings
      };
    } catch (error) {
      console.error('Controller - Get schedule error:', error);
      throw new HttpException(
        { success: false, message: 'Failed to fetch schedule settings' },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post()
  async updateSchedule(@Body() body: any) {
    try {
      const { 
        morning_start, 
        morning_late_cutoff, 
        morning_end, 
        afternoon_start, 
        afternoon_late_cutoff, 
        afternoon_end 
      } = body;

      // Validate required fields
      if (!morning_start || !morning_late_cutoff || !morning_end || !afternoon_start || !afternoon_late_cutoff) {
        throw new HttpException(
          { success: false, message: 'All schedule fields are required' },
          HttpStatus.BAD_REQUEST
        );
      }

      const result = await this.attendanceService.updateScheduleSettings({
        morning_start,
        morning_late_cutoff,
        morning_end,
        afternoon_start,
        afternoon_late_cutoff,
        afternoon_end
      });

      return result;
    } catch (error) {
      console.error('Controller - Update schedule error:', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        { success: false, message: error.message || 'Failed to update schedule' },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}