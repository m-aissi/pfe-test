import { BadGatewayException, Injectable, NotFoundException } from '@nestjs/common';
import { env } from '../config';
import { ProviderField } from './auth.service';

export type ProviderName = 'google' | 'discord';

interface Provider {
  field: ProviderField;
  clientId: string;
  clientSecret: string;
  authorizeUrl: string;
  tokenUrl: string;
  profileUrl: string;
  scope: string;
  toProfile: (json: any) => OAuthProfile;
}

export interface OAuthProfile {
  id: string;
  name: string;
}

// connexion "avec Google" / "avec Discord" (OAuth 2, flux par code d'autorisation).
// On ne demande que l'identité : ni email, ni contacts, ni serveurs Discord.
@Injectable()
export class OAuthService {
  private readonly config = env();

  private readonly providers: Record<ProviderName, Provider> = {
    google: {
      field: 'googleId',
      ...this.config.google,
      authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      profileUrl: 'https://openidconnect.googleapis.com/v1/userinfo',
      scope: 'openid profile',
      toProfile: json => ({ id: String(json.sub), name: json.given_name || json.name || '' }),
    },
    discord: {
      field: 'discordId',
      ...this.config.discord,
      authorizeUrl: 'https://discord.com/oauth2/authorize',
      tokenUrl: 'https://discord.com/api/oauth2/token',
      profileUrl: 'https://discord.com/api/users/@me',
      scope: 'identify',
      toProfile: json => ({ id: String(json.id), name: json.global_name || json.username || '' }),
    },
  };

  // fournisseurs dont les identifiants sont renseignés dans la configuration
  enabled(): Record<ProviderName, boolean> {
    return { google: this.isConfigured(this.providers.google), discord: this.isConfigured(this.providers.discord) };
  }

  get(name: string): Provider {
    const provider = this.providers[name as ProviderName];
    if (!provider || !this.isConfigured(provider)) throw new NotFoundException('Connexion indisponible');
    return provider;
  }

  // adresse à déclarer telle quelle dans la console Google / Discord
  redirectUri(name: string): string {
    return `${this.config.publicUrl}/api/auth/oauth/${name}/callback`;
  }

  authorizeUrl(name: string, state: string): string {
    const provider = this.get(name);
    const params = new URLSearchParams({
      client_id: provider.clientId,
      redirect_uri: this.redirectUri(name),
      response_type: 'code',
      scope: provider.scope,
      state,
    });
    return `${provider.authorizeUrl}?${params}`;
  }

  // échange le code reçu au retour du fournisseur contre l'identité de la personne
  async fetchProfile(name: string, code: string): Promise<OAuthProfile> {
    const provider = this.get(name);
    const tokenResponse = await fetch(provider.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams({
        client_id: provider.clientId,
        client_secret: provider.clientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: this.redirectUri(name),
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const token: any = await tokenResponse.json().catch(() => ({}));
    if (!tokenResponse.ok || !token.access_token) throw new BadGatewayException('Connexion refusée par le fournisseur');

    const profileResponse = await fetch(provider.profileUrl, {
      headers: { Authorization: `Bearer ${token.access_token}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(15_000),
    });
    if (!profileResponse.ok) throw new BadGatewayException('Profil indisponible chez le fournisseur');
    const profile = provider.toProfile(await profileResponse.json());
    if (!profile.id || profile.id == 'undefined') throw new BadGatewayException('Profil incomplet chez le fournisseur');
    return profile;
  }

  private isConfigured(provider: Provider): boolean {
    return !!provider.clientId && !!provider.clientSecret;
  }
}
