import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { join } from 'path';
import * as express from 'express';
import * as os from 'os';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS
  app.enableCors();

  // Set global prefix for API routes (optional but recommended)
  // app.setGlobalPrefix('api'); // Uncomment if you want /api/attendance

  // IMPORTANT: Serve static files AFTER setting up routes
  // But better to use a different path for static files
  app.use('/', express.static(join(__dirname, '..', 'public')));

  // Listen on all interfaces
  const port = 3000;
  await app.listen(port, '0.0.0.0');

  // Get local network IPs
  const nets = os.networkInterfaces();
  console.log("Server running on:");
  console.log(`http://localhost:${port}`);
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]!) {
      // Only IPv4 and non-internal addresses
      if (net.family === 'IPv4' && !net.internal) {
        console.log(`http://${net.address}:${port}`);
      }
    }
  }
}
bootstrap();