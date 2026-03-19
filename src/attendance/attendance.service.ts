import { Injectable } from '@nestjs/common';
import * as mysql from 'mysql2/promise';

@Injectable()
export class AttendanceService {
  private pool: mysql.Pool;
  private scheduleCache: any = null;
  private lastScheduleFetch: number = 0;

  constructor() {
    // Create connection pool
    this.pool = mysql.createPool({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'student_attendance',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
      timezone: '+08:00',
      dateStrings: true
    });

    // Test database connection
    this.testConnection();
  }

  private async testConnection() {
    try {
      const connection = await this.pool.getConnection();
      console.log('✅ Database connected successfully');
      
      // Set session timezone to Philippine Time
      await connection.query("SET time_zone = '+08:00'");
      
      connection.release();
    } catch (error) {
      console.error('❌ Database connection failed:', error.message);
    }
  }

  // Get schedule settings (with caching)
  async getScheduleSettings(forceRefresh = false) {
    // Cache for 5 minutes to reduce DB calls
    const now = Date.now();
    if (!forceRefresh && this.scheduleCache && (now - this.lastScheduleFetch < 300000)) {
      return this.scheduleCache;
    }

    const connection = await this.pool.getConnection();
    try {
      const [rows]: any = await connection.execute(
        'SELECT * FROM schedule_settings ORDER BY id DESC LIMIT 1'
      );
      
      if (rows.length > 0) {
        this.scheduleCache = rows[0];
        this.lastScheduleFetch = now;
        return rows[0];
      }
      
      // Return default if no settings found
      const defaultSettings = {
        morning_start: '09:00:00',
        morning_late_cutoff: '09:20:00',
        morning_end: '10:30:00',
        afternoon_start: '17:00:00',
        afternoon_late_cutoff: '17:22:00',
        afternoon_end: '18:24:00'
      };
      this.scheduleCache = defaultSettings;
      return defaultSettings;
    } catch (error) {
      console.error('Error fetching schedule settings:', error);
      throw error;
    } finally {
      connection.release();
    }
  }

  // Update schedule settings
  async updateScheduleSettings(settings: any) {
    const connection = await this.pool.getConnection();
    try {
      // Check if settings exist
      const [rows]: any = await connection.execute('SELECT COUNT(*) as count FROM schedule_settings');
      
      if (rows[0].count > 0) {
        // Update existing settings
        await connection.execute(
          `UPDATE schedule_settings SET 
            morning_start = ?, 
            morning_late_cutoff = ?, 
            morning_end = ?, 
            afternoon_start = ?, 
            afternoon_late_cutoff = ?, 
            afternoon_end = ? 
          WHERE id = (SELECT id FROM (SELECT id FROM schedule_settings ORDER BY id DESC LIMIT 1) as temp)`,
          [
            settings.morning_start,
            settings.morning_late_cutoff,
            settings.morning_end,
            settings.afternoon_start,
            settings.afternoon_late_cutoff,
            settings.afternoon_end || null
          ]
        );
      } else {
        // Insert new settings
        await connection.execute(
          `INSERT INTO schedule_settings 
            (morning_start, morning_late_cutoff, morning_end, afternoon_start, afternoon_late_cutoff, afternoon_end) 
          VALUES (?, ?, ?, ?, ?, ?)`,
          [
            settings.morning_start,
            settings.morning_late_cutoff,
            settings.morning_end,
            settings.afternoon_start,
            settings.afternoon_late_cutoff,
            settings.afternoon_end || null
          ]
        );
      }
      
      // Clear cache
      this.scheduleCache = null;
      
      return { success: true, message: 'Schedule updated successfully' };
    } catch (error) {
      console.error('Error updating schedule settings:', error);
      throw error;
    } finally {
      connection.release();
    }
  }

  // Check if time is late based on schedule settings
  async checkIfLate(time: string): Promise<boolean> {
    if (!time) return false;
    
    const settings = await this.getScheduleSettings();
    
    // Parse times for comparison
    const [hours, minutes] = time.split(':').map(Number);
    const currentMinutes = hours * 60 + minutes;
    
    // Parse settings times to minutes for easier comparison
    const parseTimeToMinutes = (timeStr: string): number => {
      if (!timeStr) return 0;
      const [h, m] = timeStr.split(':').map(Number);
      return h * 60 + m;
    };
    
    const morningStart = parseTimeToMinutes(settings.morning_start);
    const morningLateCutoff = parseTimeToMinutes(settings.morning_late_cutoff);
    const morningEnd = parseTimeToMinutes(settings.morning_end);
    const afternoonStart = parseTimeToMinutes(settings.afternoon_start);
    const afternoonLateCutoff = parseTimeToMinutes(settings.afternoon_late_cutoff);
    
    // Check if within morning class period
    if (currentMinutes >= morningStart && currentMinutes <= morningEnd) {
      return currentMinutes > morningLateCutoff;
    }
    
    // Check if within afternoon class period
    if (currentMinutes >= afternoonStart) {
      return currentMinutes > afternoonLateCutoff;
    }
    
    // Outside class hours - not considered late
    return false;
  }

  async markAttendance(name: string, section: string, clientIp: string, deviceDate?: string, deviceTime?: string) {
    const connection = await this.pool.getConnection();
    
    try {
      console.log('========== SERVICE MARKATTENDANCE ==========');
      console.log('RAW INPUTS:', { name, section, clientIp, deviceDate, deviceTime });

      // Set session timezone to Philippine Time
      await connection.query("SET time_zone = '+08:00'");

      // ALWAYS use the device date/time from client
      let today: string;
      let time: string;

      if (deviceDate && deviceTime && deviceDate.trim() !== '' && deviceTime.trim() !== '') {
        today = deviceDate.trim();
        time = deviceTime.trim();
        console.log('✅ USING CLIENT DATE/TIME:', { today, time });
      } else {
        // Fallback to server time with Philippine Timezone
        const now = new Date();
        
        // Adjust to Philippine Time (UTC+8)
        const philippineTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));
        
        today = philippineTime.toISOString().slice(0, 10);
        time = philippineTime.toTimeString().slice(0, 8);
        
        console.log('⚠️ USING SERVER TIME (adjusted to PHT):', { today, time });
      }

      // Check if late based on schedule settings
      const isLate = await this.checkIfLate(time);
      console.log('⏰ LATE STATUS:', isLate ? 'LATE' : 'ON TIME');

      // Check for duplicate (same IP and date)
      const [existing]: any = await connection.execute(
        'SELECT * FROM attendance WHERE ip_address = ? AND date = ?',
        [clientIp, today]
      );

      if (existing.length > 0) {
        console.log('⚠️ Duplicate found:', existing[0]);
        return { 
          success: false, 
          message: 'You have already submitted attendance for today' 
        };
      }

      // Insert new record
      const [result]: any = await connection.execute(
        'INSERT INTO attendance (name, section, date, time, ip_address) VALUES (?, ?, ?, ?, ?)',
        [name, section, today, time, clientIp]
      );

      console.log('✅ INSERT RESULT:', result);

      return {
        success: true,
        message: isLate ? 'Attendance submitted successfully (LATE)' : 'Attendance submitted successfully',
        date: today,
        time: time,
        isLate: isLate,
        id: result.insertId
      };
    } catch (error) {
      console.error('Service - markAttendance error:', error);
      throw error;
    } finally {
      connection.release();
    }
  }

  // FIXED: Get attendance ONLY for specific IP address
  async getAttendance(clientIp?: string) {
    const connection = await this.pool.getConnection();
    
    try {
      // Set session timezone
      await connection.query("SET time_zone = '+08:00'");
      
      let rows: any;
      
      if (clientIp) {
        // If IP is provided, get only records for that IP
        console.log(`Service - Getting attendance for IP: ${clientIp}`);
        [rows] = await connection.execute(
          'SELECT id, name, section, DATE_FORMAT(date, "%Y-%m-%d") as date, TIME_FORMAT(time, "%H:%i:%s") as time, ip_address FROM attendance WHERE ip_address = ? ORDER BY id DESC',
          [clientIp]
        );
        console.log(`Service - Retrieved ${rows.length} records for IP ${clientIp}`);
      } else {
        // If no IP provided (admin/fallback), get all records
        console.log('Service - No IP provided, returning all records');
        [rows] = await connection.execute(
          'SELECT id, name, section, DATE_FORMAT(date, "%Y-%m-%d") as date, TIME_FORMAT(time, "%H:%i:%s") as time, ip_address FROM attendance ORDER BY id DESC'
        );
        console.log(`Service - Retrieved ${rows.length} total records`);
      }
      
      // Calculate is_late on the fly based on schedule settings
      const enhancedRows = await Promise.all(rows.map(async (row) => {
        const isLate = await this.checkIfLate(row.time);
        return {
          ...row,
          is_late: isLate ? 1 : 0
        };
      }));
      
      return enhancedRows;
    } catch (error) {
      console.error('Service - getAttendance error:', error);
      throw error;
    } finally {
      connection.release();
    }
  }

  // Get attendance for a specific IP (alias for clarity)
  async getAttendanceByIp(clientIp: string) {
    return this.getAttendance(clientIp);
  }

  async editAttendance(id: number, name: string, section: string, clientIp: string) {
    const connection = await this.pool.getConnection();
    
    try {
      console.log('Service - Editing record:', { id, name, section, clientIp });

      // Set session timezone
      await connection.query("SET time_zone = '+08:00'");

      // Check if record exists and belongs to this IP
      const [rows]: any = await connection.execute(
        'SELECT * FROM attendance WHERE id = ?',
        [id]
      );

      if (rows.length === 0) {
        return { 
          success: false, 
          message: 'Record not found' 
        };
      }

      const record = rows[0];

      // Check ownership
      if (record.ip_address !== clientIp) {
        console.log(`IP mismatch: Record IP="${record.ip_address}", Your IP="${clientIp}"`);
        return { 
          success: false, 
          message: 'You do not have permission to edit this record' 
        };
      }

      // Update record (keep original date and time)
      await connection.execute(
        'UPDATE attendance SET name = ?, section = ? WHERE id = ?',
        [name, section, id]
      );

      console.log('✅ Record updated successfully:', id);

      return { 
        success: true, 
        message: 'Attendance updated successfully' 
      };
    } catch (error) {
      console.error('Service - editAttendance error:', error);
      throw error;
    } finally {
      connection.release();
    }
  }

  async deleteAttendanceAdmin(id: number) {
    const connection = await this.pool.getConnection();
    
    try {
      console.log('Service - Admin deleting record:', id);

      // Set session timezone
      await connection.query("SET time_zone = '+08:00'");

      // Check if record exists
      const [rows]: any = await connection.execute(
        'SELECT * FROM attendance WHERE id = ?',
        [id]
      );

      if (rows.length === 0) {
        return { 
          success: false, 
          message: 'Record not found' 
        };
      }

      // Delete record
      await connection.execute('DELETE FROM attendance WHERE id = ?', [id]);

      console.log('✅ Record admin deleted successfully:', id);

      return { 
        success: true, 
        message: 'Attendance deleted successfully (admin)' 
      };
    } catch (error) {
      console.error('Service - deleteAttendanceAdmin error:', error);
      throw error;
    } finally {
      connection.release();
    }
  }

  // Get attendance statistics by section
  async getAttendanceStats(section?: string) {
    const connection = await this.pool.getConnection();
    
    try {
      let query = `
        SELECT 
          section,
          COUNT(*) as total,
          DATE_FORMAT(date, '%Y-%m-%d') as date
        FROM attendance
      `;
      
      const params: any[] = [];
      
      if (section) {
        query += ' WHERE section = ? ';
        params.push(section);
      }
      
      query += ' GROUP BY section, date ORDER BY date DESC, section';
      
      const [rows]: any = await connection.execute(query, params);
      
      // Enhance with late counts calculated on the fly
      const enhancedRows = await Promise.all(rows.map(async (row) => {
        // Get all records for this section and date to count late ones
        const [records]: any = await connection.execute(
          'SELECT time FROM attendance WHERE section = ? AND date = ?',
          [row.section, row.date]
        );
        
        let lateCount = 0;
        for (const record of records) {
          const isLate = await this.checkIfLate(record.time);
          if (isLate) lateCount++;
        }
        
        return {
          ...row,
          late_count: lateCount,
          ontime_count: row.total - lateCount
        };
      }));
      
      return enhancedRows;
    } catch (error) {
      console.error('Service - getAttendanceStats error:', error);
      throw error;
    } finally {
      connection.release();
    }
  }

  // Get today's attendance for a specific IP
  async getTodayAttendance(clientIp?: string) {
    const connection = await this.pool.getConnection();
    
    try {
      // Set session timezone
      await connection.query("SET time_zone = '+08:00'");
      
      // Get current date in Philippine Time
      const now = new Date();
      const philippineTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));
      const today = philippineTime.toISOString().slice(0, 10);
      
      let rows: any;
      
      if (clientIp) {
        // Get today's attendance for specific IP
        [rows] = await connection.execute(
          `SELECT id, name, section, DATE_FORMAT(date, "%Y-%m-%d") as date, 
                  TIME_FORMAT(time, "%h:%i %p") as time, ip_address 
           FROM attendance 
           WHERE date = ? AND ip_address = ?
           ORDER BY time ASC`,
          [today, clientIp]
        );
      } else {
        // Get all today's attendance (admin view)
        [rows] = await connection.execute(
          `SELECT id, name, section, DATE_FORMAT(date, "%Y-%m-%d") as date, 
                  TIME_FORMAT(time, "%h:%i %p") as time, ip_address 
           FROM attendance 
           WHERE date = ? 
           ORDER BY time ASC`,
          [today]
        );
      }
      
      // Calculate is_late on the fly
      const enhancedRows = await Promise.all(rows.map(async (row) => {
        const isLate = await this.checkIfLate(row.time);
        return {
          ...row,
          is_late: isLate ? 1 : 0
        };
      }));
      
      return enhancedRows;
    } catch (error) {
      console.error('Service - getTodayAttendance error:', error);
      throw error;
    } finally {
      connection.release();
    }
  }

  // Get attendance by date range for a specific IP
  async getAttendanceByDateRange(startDate: string, endDate: string, section?: string, clientIp?: string) {
    const connection = await this.pool.getConnection();
    
    try {
      let query = `
        SELECT id, name, section, DATE_FORMAT(date, "%Y-%m-%d") as date, 
               TIME_FORMAT(time, "%h:%i %p") as time, ip_address 
        FROM attendance 
        WHERE date BETWEEN ? AND ?
      `;
      
      const params: any[] = [startDate, endDate];
      
      if (section) {
        query += ' AND section = ? ';
        params.push(section);
      }
      
      if (clientIp) {
        query += ' AND ip_address = ? ';
        params.push(clientIp);
      }
      
      query += ' ORDER BY date DESC, time ASC';
      
      const [rows]: any = await connection.execute(query, params);
      
      // Calculate is_late on the fly
      const enhancedRows = await Promise.all(rows.map(async (row) => {
        const isLate = await this.checkIfLate(row.time);
        return {
          ...row,
          is_late: isLate ? 1 : 0
        };
      }));
      
      return enhancedRows;
    } catch (error) {
      console.error('Service - getAttendanceByDateRange error:', error);
      throw error;
    } finally {
      connection.release();
    }
  }

  // Admin method to get all attendance (no IP filter)
  async getAllAttendance() {
    const connection = await this.pool.getConnection();
    
    try {
      // Set session timezone
      await connection.query("SET time_zone = '+08:00'");
      
      const [rows]: any = await connection.execute(
        'SELECT id, name, section, DATE_FORMAT(date, "%Y-%m-%d") as date, TIME_FORMAT(time, "%H:%i:%s") as time, ip_address FROM attendance ORDER BY id DESC'
      );

      console.log(`Service - Admin retrieved ${rows.length} records`);
      
      // Calculate is_late on the fly
      const enhancedRows = await Promise.all(rows.map(async (row) => {
        const isLate = await this.checkIfLate(row.time);
        return {
          ...row,
          is_late: isLate ? 1 : 0
        };
      }));
      
      return enhancedRows;
    } catch (error) {
      console.error('Service - getAllAttendance error:', error);
      throw error;
    } finally {
      connection.release();
    }
  }

  // Clean up connection pool on module destroy
  async onModuleDestroy() {
    if (this.pool) {
      await this.pool.end();
      console.log('Database connection pool closed');
    }
  }
}