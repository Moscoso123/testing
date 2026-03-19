import { Controller, Get, Post, Put, Delete, Body, Param, Req, HttpException, HttpStatus } from '@nestjs/common';
import * as express from 'express';
import { AttendanceService } from './attendance.service';

@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {
    console.log('✅ AttendanceController initialized');
  }

  @Get('test')
  test() {
    return { 
      success: true, 
      message: 'Attendance controller is working!',
      timestamp: new Date().toISOString()
    };
  }

  // ADD THIS NEW ENDPOINT FOR SCHEDULE
  @Get('schedule')
  async getScheduleSettings() {
    console.log('📅 Schedule endpoint hit');
    try {
      const settings = await this.attendanceService.getScheduleSettings();
      console.log('Controller - Schedule settings fetched:', settings);
      return settings;
    } catch (error) {
      console.error('Controller - Get schedule error:', error);
      throw new HttpException(
        { success: false, message: 'Failed to fetch schedule settings' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get()
  async getAllAttendance() {
    try {
      const records = await this.attendanceService.getAttendance();
      return records;
    } catch (error) {
      console.error('Controller - Get all error:', error);
      throw new HttpException(
        { success: false, message: 'Failed to fetch attendance records' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post()
  async markAttendance(@Body() body: any, @Req() req: express.Request) {
    try {
      const { name, section, deviceDate, deviceTime } = body;

      // Validate required fields
      if (!name || !section) {
        throw new HttpException(
          { success: false, message: 'Name and section are required' },
          HttpStatus.BAD_REQUEST,
        );
      }

      // Get client IP from various headers
      let clientIp = '127.0.0.1';
      
      const forwardedFor = req.headers['x-forwarded-for'];
      if (forwardedFor) {
        if (typeof forwardedFor === 'string') {
          clientIp = forwardedFor.split(',')[0].trim();
        } else if (Array.isArray(forwardedFor) && forwardedFor.length > 0) {
          clientIp = forwardedFor[0].split(',')[0].trim();
        }
      } else if (req.socket && req.socket.remoteAddress) {
        clientIp = req.socket.remoteAddress;
      }

      // Handle IPv6 localhost
      if (clientIp === '::1' || clientIp === '::ffff:127.0.0.1') {
        clientIp = '127.0.0.1';
      }

      console.log('Controller - Marking attendance:', {
        name,
        section,
        clientIp,
        deviceDate,
        deviceTime,
      });

      const result = await this.attendanceService.markAttendance(
        name,
        section,
        clientIp,
        deviceDate,
        deviceTime,
      );

      return result;
    } catch (error) {
      console.error('Controller - Mark attendance error:', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        { success: false, message: error.message || 'Failed to mark attendance' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Put(':id')
  async editAttendance(@Param('id') id: string, @Body() body: any, @Req() req: express.Request) {
    try {
      const { name, section } = body;

      // Validate required fields
      if (!name || !section) {
        throw new HttpException(
          { success: false, message: 'Name and section are required' },
          HttpStatus.BAD_REQUEST,
        );
      }

      // Validate ID
      const recordId = parseInt(id);
      if (isNaN(recordId)) {
        throw new HttpException(
          { success: false, message: 'Invalid record ID' },
          HttpStatus.BAD_REQUEST,
        );
      }

      // Get client IP
      let clientIp = '127.0.0.1';
      
      const forwardedFor = req.headers['x-forwarded-for'];
      if (forwardedFor) {
        if (typeof forwardedFor === 'string') {
          clientIp = forwardedFor.split(',')[0].trim();
        } else if (Array.isArray(forwardedFor) && forwardedFor.length > 0) {
          clientIp = forwardedFor[0].split(',')[0].trim();
        }
      } else if (req.socket && req.socket.remoteAddress) {
        clientIp = req.socket.remoteAddress;
      }

      // Handle IPv6 localhost
      if (clientIp === '::1' || clientIp === '::ffff:127.0.0.1') {
        clientIp = '127.0.0.1';
      }

      console.log('Controller - Editing attendance:', {
        id: recordId,
        name,
        section,
        clientIp,
      });

      const result = await this.attendanceService.editAttendance(
        recordId,
        name,
        section,
        clientIp,
      );

      return result;
    } catch (error) {
      console.error('Controller - Edit attendance error:', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        { success: false, message: error.message || 'Failed to edit attendance' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

 

  @Get('my-ip')
  async getMyIp(@Req() req: express.Request) {
    try {
      // Get client IP from various sources
      let clientIp = '127.0.0.1';
      
      const forwardedFor = req.headers['x-forwarded-for'];
      if (forwardedFor) {
        if (typeof forwardedFor === 'string') {
          clientIp = forwardedFor.split(',')[0].trim();
        } else if (Array.isArray(forwardedFor) && forwardedFor.length > 0) {
          clientIp = forwardedFor[0].split(',')[0].trim();
        }
      } else if (req.socket && req.socket.remoteAddress) {
        clientIp = req.socket.remoteAddress;
      }

      // Handle IPv6 localhost
      if (clientIp === '::1' || clientIp === '::ffff:127.0.0.1') {
        clientIp = '127.0.0.1';
      }

      // Get all possible IPs for debugging
      const allIps: string[] = [
        clientIp,
        req.socket?.remoteAddress || '',
      ];

      const xRealIp = req.headers['x-real-ip'];
      if (xRealIp && typeof xRealIp === 'string') {
        allIps.push(xRealIp);
      }

      // Handle x-forwarded-for which could be string or array
      if (forwardedFor) {
        if (typeof forwardedFor === 'string') {
          forwardedFor.split(',').forEach(ip => {
            const trimmed = ip.trim();
            if (trimmed) allIps.push(trimmed);
          });
        } else if (Array.isArray(forwardedFor)) {
          forwardedFor.forEach(ipStr => {
            if (typeof ipStr === 'string') {
              ipStr.split(',').forEach(ip => {
                const trimmed = ip.trim();
                if (trimmed) allIps.push(trimmed);
              });
            }
          });
        }
      }

      // Filter out empty strings and clean up
      const cleanIps = allIps
        .filter(ip => ip && typeof ip === 'string' && ip.trim() !== '')
        .map(ip => ip.trim());

      // Handle IPv6 localhost in all IPs
      const normalizedIps = cleanIps.map(ip => {
        if (ip === '::1' || ip === '::ffff:127.0.0.1') return '127.0.0.1';
        return ip;
      });

      // Remove duplicates
      const uniqueIps = [...new Set(normalizedIps)];

      console.log('Controller - IP info requested:', {
        clientIp,
        allIps: uniqueIps,
      });

      return {
        ip: clientIp,
        all_ips: uniqueIps,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Controller - Get IP error:', error);
      throw new HttpException(
        { success: false, message: 'Failed to get IP information' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Admin endpoints
  @Get('admin/all')
  async getAllRecordsAdmin() {
    try {
      const records = await this.attendanceService.getAttendance();
      return {
        success: true,
        data: records,
        count: records.length,
      };
    } catch (error) {
      console.error('Controller - Admin get all error:', error);
      throw new HttpException(
        { success: false, message: 'Failed to fetch all records' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Delete('admin/:id')
  async deleteAttendanceAdmin(@Param('id') id: string) {
    try {
      const recordId = parseInt(id);
      if (isNaN(recordId)) {
        throw new HttpException(
          { success: false, message: 'Invalid record ID' },
          HttpStatus.BAD_REQUEST,
        );
      }

      const result = await this.attendanceService.deleteAttendanceAdmin(recordId);
      return result;
    } catch (error) {
      console.error('Controller - Admin delete error:', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        { success: false, message: error.message || 'Failed to delete record' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}