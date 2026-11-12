import { CanActivate, createParamDecorator, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { SessionService } from './session.service';

// laisse passer tout le monde, mais renseigne req.userId si la session est valide (routes consultables sans compte)
@Injectable()
export class OptionalAuthGuard implements CanActivate {
  constructor(
    protected readonly sessions: SessionService,
    protected readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request & { userId: string | null }>();
    req.userId = await this.resolve(req, http.getResponse<Response>());
    return true;
  }

  // res : pour prolonger une session "rester connecté" encore valide
  async resolve(req: Request, res?: Response): Promise<string | null> {
    const payload = this.sessions.read(req);
    if (!payload) return null;
    // le compte doit toujours exister et la session ne pas avoir été invalidée par un changement de mot de passe
    if (!(await this.auth.isSessionValid(payload.sub, payload.v))) return null;
    if (res) this.sessions.refresh(res, payload);
    return payload.sub;
  }
}

@Injectable()
export class AuthGuard extends OptionalAuthGuard {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    await super.canActivate(context);
    if (!context.switchToHttp().getRequest().userId) throw new UnauthorizedException('Connexion requise');
    return true;
  }
}

// identifiant du compte connecté (null derrière OptionalAuthGuard si personne n'est connecté)
export const UserId = createParamDecorator((_: unknown, context: ExecutionContext) => context.switchToHttp().getRequest().userId);
