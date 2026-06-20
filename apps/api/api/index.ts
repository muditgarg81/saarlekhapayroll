import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ExpressAdapter } from '@nestjs/platform-express';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from '../src/app.module';
import express from 'express';

const server = express();
let app: any;

export default async (req: any, res: any) => {
  try {
    if (!app) {
      app = await NestFactory.create(AppModule, new ExpressAdapter(server));
      app.setGlobalPrefix('api');
      app.enableCors({
        origin: (origin: string, callback: any) => {
          const allowedOrigins = process.env.FRONTEND_URL
            ? process.env.FRONTEND_URL.split(',')
            : [];
          if (
            !origin ||
            origin.startsWith('http://localhost:') ||
            origin.startsWith('https://localhost:') ||
            origin.endsWith('.vercel.app') ||
            allowedOrigins.includes(origin)
          ) {
            callback(null, true);
          } else {
            callback(new Error('Not allowed by CORS'));
          }
        },
        credentials: true,
      });
      app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

      const config = new DocumentBuilder()
        .setTitle('Saarlekha Payroll API')
        .setDescription('India-first payroll management system API')
        .setVersion('1.0')
        .addBearerAuth()
        .build();
      const document = SwaggerModule.createDocument(app, config);
      SwaggerModule.setup('api/docs', app, document);

      await app.init();
    }
    return server(req, res);
  } catch (err: any) {
    console.error('Crash during bootstrap:', err);
    res.status(500).json({
      error: 'Bootstrap failed',
      message: err.message,
      stack: err.stack,
    });
  }
};
