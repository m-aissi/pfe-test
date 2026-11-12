import {
  BadRequestException, Body, Controller, Get, HttpCode, HttpException, Param, Post, Put, Query, Req, Res, UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { randomBytes } from 'crypto';
import { Request, Response } from 'express';
import { AuthGuard, OptionalAuthGuard, UserId } from './auth.guard';
import { AuthService } from './auth.service';
import { OAuthService } from './oauth.service';
import { SessionService } from './session.service';

const OAUTH_STATE_COOKIE = 'ygo_oauth_state';
// 2 à 24 lettres (accents compris), chiffres, espaces, points, - ou _ ; pas d'espace au bord ni d'espaces doublés
const USERNAME_RULE = /^(?!.* {2})[\p{L}\p{N}_.-][\p{L}\p{N}_. -]{0,22}[\p{L}\p{N}_.-]$/u;
const USERNAME_MESSAGE = 'Le pseudo doit faire 2 à 24 caractères : lettres, chiffres, espaces, points, - ou _';
const PASSWORD_MESSAGE = 'Le mot de passe doit faire au moins 4 caractères';

// un "é" tapé en deux caractères (lettre + accent, certains claviers de téléphone) devient un seul caractère avant la vérification
export const NormalizeUsername = () => Transform(({ value }) => (typeof value == 'string' ? value.normalize('NFC') : value));

class RegisterDto {
  @NormalizeUsername() @IsString() @Matches(USERNAME_RULE, { message: USERNAME_MESSAGE })
  username: string;

  @IsString() @MinLength(4, { message: PASSWORD_MESSAGE }) @MaxLength(200)
  password: string;

  // rester connecté (oui par défaut)
  @IsOptional() @IsBoolean()
  remember?: boolean;
}

class LoginDto {
  @IsString() @MaxLength(50)
  username: string;

  @IsString() @MaxLength(200)
  password: string;

  @IsOptional() @IsBoolean()
  remember?: boolean;
}

class PasswordDto {
  @IsOptional() @IsString() @MaxLength(200)
  currentPassword?: string;

  @IsString() @MinLength(4, { message: PASSWORD_MESSAGE }) @MaxLength(200)
  newPassword: string;
}

class UsernameDto {
  @NormalizeUsername() @IsString() @Matches(USERNAME_RULE, { message: USERNAME_MESSAGE })
  username: string;
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionService,
    private readonly oauth: OAuthService,
    private readonly optionalAuth: OptionalAuthGuard,
  ) {}

  // quels boutons "Se connecter avec..." afficher
  @Get('providers')
  providers() {
    return this.oauth.enabled();
  }

  @UseGuards(OptionalAuthGuard)
  @Get('me')
  async me(@UserId() userId: string | null) {
    return { user: userId ? this.auth.toPublic(await this.auth.require(userId)) : null };
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('register')
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const user = await this.auth.register(dto.username, dto.password);
    this.sessions.start(res, user, dto.remember ?? true);
    return { user: this.auth.toPublic(user) };
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(200)
  @Post('login')
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const user = await this.auth.login(dto.username, dto.password);
    this.sessions.start(res, user, dto.remember ?? true);
    return { user: this.auth.toPublic(user) };
  }

  @HttpCode(200)
  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    this.sessions.end(res);
    return { user: null };
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UseGuards(AuthGuard)
  @HttpCode(200)
  @Post('password')
  async changePassword(
    @UserId() userId: string,
    @Body() dto: PasswordDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.auth.changePassword(userId, dto.currentPassword, dto.newPassword);
    // le changement a invalidé toutes les sessions : on en rouvre une pour cet appareil, de même durée
    this.sessions.start(res, user, this.sessions.read(req)?.r ?? true);
    return { user: this.auth.toPublic(user) };
  }

  @UseGuards(AuthGuard)
  @Put('username')
  async rename(@UserId() userId: string, @Body() dto: UsernameDto) {
    return { user: this.auth.toPublic(await this.auth.rename(userId, dto.username)) };
  }

  // départ vers Google/Discord ; "state" protège le retour contre une requête forgée par un autre site
  @Get('oauth/:provider')
  start(@Param('provider') name: string, @Res() res: Response) {
    const state = randomBytes(24).toString('hex');
    const url = this.oauth.authorizeUrl(name, state);
    res.cookie(OAUTH_STATE_COOKIE, state, this.sessions.cookieOptions(600_000));
    res.redirect(url);
  }

  @Get('oauth/:provider/callback')
  async callback(
    @Param('provider') name: string,
    @Query('code') code: string,
    @Query('state') state: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const expectedState = req.cookies?.[OAUTH_STATE_COOKIE];
    res.clearCookie(OAUTH_STATE_COOKIE, this.sessions.cookieOptions());
    try {
      const provider = this.oauth.get(name);
      if (!code || !state || state !== expectedState) throw new BadRequestException('Connexion expirée, réessaie');
      const profile = await this.oauth.fetchProfile(name, code);

      // déjà connecté : on lie ce compte Google/Discord au pseudo courant au lieu d'ouvrir une autre session
      const currentUserId = await this.optionalAuth.resolve(req);
      if (currentUserId) {
        await this.auth.linkProvider(currentUserId, provider.field, profile.id);
        return res.redirect('/compte');
      }
      const user = await this.auth.loginWithProvider(provider.field, profile.id, profile.name);
      this.sessions.start(res, user);
      res.redirect('/');
    } catch (error) {
      const message = error instanceof HttpException ? error.message : 'Connexion impossible, réessaie';
      res.redirect(`/connexion?erreur=${encodeURIComponent(message)}`);
    }
  }
}
