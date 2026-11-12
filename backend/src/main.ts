import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { env } from './config';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = env();
  if (config.production && !config.sessionSecret) {
    throw new Error('SESSION_SECRET est obligatoire en production (voir backend/.env.example)');
  }

  app.setGlobalPrefix('api');
  // derrière Caddy : la vraie adresse du visiteur est dans X-Forwarded-For (utilisée par la limite de requêtes)
  app.set('trust proxy', 'loopback');
  // l'import d'un ancien profil JSON dépasse la limite par défaut de 100 ko
  app.useBodyParser('json', { limit: '5mb' });
  app.use(cookieParser());
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          // Angular injecte les styles des composants dans des balises <style>
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'blob:'],
          fontSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: ["'none'"],
        },
      },
      // ces en-têtes n'ont de sens qu'en https ; en http (aperçu sur le réseau local) ils cassent le chargement
      strictTransportSecurity: config.secureCookies,
      crossOriginOpenerPolicy: config.secureCookies,
      originAgentCluster: config.secureCookies,
    }),
  );
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  await app.listen(config.port, config.host);
  // eslint-disable-next-line no-console
  console.log(`yugioh backend listening on ${config.host}:${config.port}`);
}
bootstrap();
