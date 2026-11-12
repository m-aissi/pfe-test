import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { join } from 'path';
import { AccountModule } from './account/account.module';
import { AuthModule } from './auth/auth.module';
import { BindersModule } from './binders/binders.module';
import { CardsModule } from './cards/cards.module';
import { CollectionModule } from './collection/collection.module';
import { env } from './config';
import { ImagesModule } from './images/images.module';

// fichiers du front dont le nom contient une empreinte de leur contenu : ils peuvent rester en cache indéfiniment
const HASHED_ASSET = /[-.][A-Za-z0-9_]{8,}\.(js|css|woff2?|ttf|svg|png|jpg)$/;

@Module({
  imports: [
    // en premier : charge backend/.env avant que les autres modules ne lisent leur configuration
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({ useFactory: () => ({ uri: env().mongoUri }) }),
    ScheduleModule.forRoot(),
    // limite générale par adresse IP ; les routes de connexion ont une limite plus stricte
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 600 }]),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', '..', 'frontend', 'dist', 'frontend', 'browser'),
      exclude: ['/api/{*path}'],
      serveStaticOptions: {
        setHeaders: (res, path) =>
          res.setHeader('Cache-Control', HASHED_ASSET.test(path) ? 'public, max-age=31536000, immutable' : 'no-cache'),
      },
    }),
    AuthModule,
    CardsModule,
    ImagesModule,
    CollectionModule,
    BindersModule,
    AccountModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
