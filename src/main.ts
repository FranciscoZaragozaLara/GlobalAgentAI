import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Load env variables and set absolute path for Google credentials
dotenv.config();
const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (credentialsPath) {
  const fullPath = path.isAbsolute(credentialsPath)
    ? credentialsPath
    : path.join(process.cwd(), credentialsPath);
  if (fs.existsSync(fullPath)) {
    process.env.GOOGLE_APPLICATION_CREDENTIALS = fullPath;
  }
}

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Enable Cross-Origin Resource Sharing
  app.enableCors();

  // Global Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  // Swagger Documentation Setup
  const config = new DocumentBuilder()
    .setTitle('Global Agent AI — Jetour Soueast')
    .setDescription(
      'APIs de control para el Agente Experto en ventas y marketing. Permite ejecutar scripts de análisis, ' +
      'estrategias por agencia, generación de PDFs e integración con n8n.'
    )
    .setVersion('1.0.0')
    .addTag('Scripts Manager', 'Control de ejecución de scripts del Agente')
    .build();
    
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // Config Service
  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3000);

  await app.listen(port);
  
  logger.log(`=======================================================`);
  logger.log(`  Application is running on: http://localhost:${port}`);
  logger.log(`  Swagger documentation is available at: http://localhost:${port}/api/docs`);
  logger.log(`=======================================================`);
}
bootstrap();
