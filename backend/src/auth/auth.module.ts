import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthController } from './auth.controller';
import { AdminGuard, AuthGuard, OptionalAuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { OAuthService } from './oauth.service';
import { SessionService } from './session.service';
import { User, UserSchema } from './user.schema';

// global : les gardes AuthGuard / OptionalAuthGuard sont utilisables dans tous les modules sans réimport
@Global()
@Module({
  imports: [MongooseModule.forFeature([{ name: User.name, schema: UserSchema }])],
  controllers: [AuthController],
  providers: [AuthService, SessionService, OAuthService, AuthGuard, OptionalAuthGuard, AdminGuard],
  exports: [AuthService, SessionService, AuthGuard, OptionalAuthGuard, AdminGuard],
})
export class AuthModule {}
