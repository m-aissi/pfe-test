import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiError } from '../../core/api';
import { Auth } from '../../core/auth';

@Component({
  selector: 'app-login',
  imports: [FormsModule, RouterLink],
  templateUrl: './login.html',
})
export class Login {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly auth = inject(Auth);

  readonly mode: 'login' | 'register' = this.route.snapshot.data['mode'];
  readonly username = signal('');
  readonly password = signal('');
  readonly confirm = signal('');
  readonly remember = signal(true);
  readonly busy = signal(false);
  // message renvoyé par le serveur, ou par le retour de Google/Discord (?erreur=...)
  readonly error = signal(this.route.snapshot.queryParamMap.get('erreur') ?? '');
  private readonly returnUrl = this.safeReturnUrl(this.route.snapshot.queryParamMap.get('retour'));

  constructor() {
    if (this.auth.user()) this.router.navigateByUrl(this.returnUrl);
  }

  async submit() {
    this.error.set('');
    if (this.mode == 'register' && this.password() != this.confirm()) {
      this.error.set('Les deux mots de passe ne correspondent pas');
      return;
    }
    this.busy.set(true);
    try {
      if (this.mode == 'login') await this.auth.login(this.username().trim(), this.password(), this.remember());
      else await this.auth.register(this.username().trim(), this.password(), this.remember());
      this.router.navigateByUrl(this.returnUrl);
    } catch (error) {
      this.error.set(error instanceof ApiError ? error.message : 'Une erreur est survenue');
      this.busy.set(false);
    }
  }

  // n'accepte que les chemins internes au site
  private safeReturnUrl(url: string | null): string {
    return url && url.startsWith('/') && !url.startsWith('//') && !url.startsWith('/connexion') && !url.startsWith('/inscription') ? url : '/';
  }
}
