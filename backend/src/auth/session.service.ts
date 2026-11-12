import { Injectable } from '@nestjs/common';
import { CookieOptions, Request, Response } from 'express';
import * as jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import { env } from '../config';

export const SESSION_COOKIE = 'ygo_session';
// "rester connecté" : session de 90 jours, prolongée à chaque visite (au plus une fois par jour)
const REMEMBER_DAYS = 90;
const REFRESH_AFTER_S = 86_400;
// sinon : le cookie disparaît à la fermeture du navigateur, et le jeton expire de toute façon au bout de 12 h
const SHORT_SESSION = '12h';

export interface SessionPayload {
  sub: string;
  v: number;
  // rester connecté
  r?: boolean;
  iat?: number;
}

// session = jeton signé rangé dans un cookie httpOnly : le JavaScript de la page ne peut pas le lire,
// et SameSite=Lax empêche un autre site de déclencher des actions avec
@Injectable()
export class SessionService {
  private readonly config = env();
  private readonly secret = this.config.sessionSecret || 'secret-de-developpement';

  cookieOptions(maxAgeMs?: number): CookieOptions {
    return { httpOnly: true, sameSite: 'lax', secure: this.config.secureCookies, path: '/', maxAge: maxAgeMs };
  }

  start(res: Response, user: { id: string; tokenVersion: number }, remember = true) {
    const token = jwt.sign({ sub: user.id, v: user.tokenVersion, r: remember }, this.secret, {
      expiresIn: remember ? `${REMEMBER_DAYS}d` : SHORT_SESSION,
    });
    res.cookie(SESSION_COOKIE, token, this.cookieOptions(remember ? REMEMBER_DAYS * 86_400_000 : undefined));
  }

  // repousse l'expiration d'une session "rester connecté" quand on revient sur le site
  refresh(res: Response, payload: SessionPayload) {
    if (payload.r && payload.iat && Date.now() / 1000 - payload.iat > REFRESH_AFTER_S) {
      this.start(res, { id: payload.sub, tokenVersion: payload.v }, true);
    }
  }

  end(res: Response) {
    res.clearCookie(SESSION_COOKIE, this.cookieOptions());
  }

  // contenu du cookie de session s'il est valide, sinon null
  read(req: Request): SessionPayload | null {
    const token = req.cookies?.[SESSION_COOKIE];
    if (!token) return null;
    try {
      const payload = jwt.verify(token, this.secret, { algorithms: ['HS256'] }) as SessionPayload;
      return typeof payload.sub == 'string' && Types.ObjectId.isValid(payload.sub) ? payload : null;
    } catch {
      return null;
    }
  }
}
