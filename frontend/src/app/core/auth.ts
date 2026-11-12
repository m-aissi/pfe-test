import { inject, Injectable, signal } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Api, User } from './api';
import { Toasts } from './toast';

@Injectable({ providedIn: 'root' })
export class Auth {
  private readonly api = inject(Api);
  private readonly router = inject(Router);
  private readonly toasts = inject(Toasts);

  readonly user = signal<User | null>(null);
  // boutons "avec Google" / "avec Discord" : affichés seulement si le serveur est configuré pour
  readonly providers = signal({ google: false, discord: false });
  // résolue une fois la session relue au démarrage de l'appli
  readonly ready: Promise<void>;

  constructor() {
    this.ready = this.restore();
    this.api.onSessionExpired = () => {
      if (!this.user()) return;
      this.user.set(null);
      this.toasts.error('Session expirée, reconnecte-toi');
      this.goToLogin();
    };
  }

  // remember : rester connecté ; sinon la session s'arrête à la fermeture du navigateur
  async login(username: string, password: string, remember: boolean) {
    const { user } = await this.api.post<{ user: User }>('/auth/login', { username, password, remember }, { silent: true });
    this.user.set(user);
  }

  async register(username: string, password: string, remember: boolean) {
    const { user } = await this.api.post<{ user: User }>('/auth/register', { username, password, remember }, { silent: true });
    this.user.set(user);
  }

  async logout() {
    await this.api.post('/auth/logout');
    this.user.set(null);
    this.router.navigateByUrl('/');
  }

  async rename(username: string) {
    const { user } = await this.api.put<{ user: User }>('/auth/username', { username });
    this.user.set(user);
  }

  async changePassword(currentPassword: string | undefined, newPassword: string) {
    const { user } = await this.api.post<{ user: User }>('/auth/password', { currentPassword, newPassword });
    this.user.set(user);
  }

  async deleteAccount(username: string) {
    await this.api.post('/me/delete', { username });
    this.user.set(null);
    this.router.navigateByUrl('/');
  }

  // envoie vers la page de connexion, puis retour à la page en cours une fois connecté
  goToLogin(returnUrl = this.router.url) {
    this.router.navigate(['/connexion'], { queryParams: { retour: returnUrl } });
  }

  private async restore() {
    try {
      const [me, providers] = await Promise.all([
        this.api.get<{ user: User | null }>('/auth/me', undefined, { silent: true }),
        this.api.get<{ google: boolean; discord: boolean }>('/auth/providers', undefined, { silent: true }),
      ]);
      this.user.set(me.user);
      this.providers.set(providers);
    } catch {
      // serveur injoignable : on reste en visiteur
    }
  }
}

// pages réservées aux comptes : sans session, on passe par la connexion
export const authGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(Auth);
  const router = inject(Router);
  await auth.ready;
  return auth.user() ? true : router.createUrlTree(['/connexion'], { queryParams: { retour: state.url } });
};
