import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Auth } from '../../core/auth';
import { LegacyImport } from '../../core/legacy-import';
import { Toasts } from '../../core/toast';

@Component({
  selector: 'app-account',
  imports: [FormsModule],
  templateUrl: './account.html',
})
export class Account {
  readonly auth = inject(Auth);
  private readonly toasts = inject(Toasts);
  private readonly legacyImport = inject(LegacyImport);

  readonly username = signal(this.auth.user()?.username ?? '');
  readonly currentPassword = signal('');
  readonly newPassword = signal('');
  readonly importing = signal(false);

  async rename() {
    await this.auth.rename(this.username().trim());
    this.toasts.success('Pseudo modifié');
  }

  async changePassword() {
    const hasPassword = this.auth.user()?.hasPassword;
    await this.auth.changePassword(hasPassword ? this.currentPassword() : undefined, this.newPassword());
    this.currentPassword.set('');
    this.newPassword.set('');
    this.toasts.success(hasPassword ? 'Mot de passe modifié, tes autres appareils sont déconnectés' : 'Mot de passe défini');
  }

  // fichier YGOToolsProfile.json ou YGOToolsBinders.json exporté par l'ancien site
  async importFile(input: HTMLInputElement) {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.importing.set(true);
    try {
      const s = await this.legacyImport.importFile(file);
      this.toasts.success(
        `Import terminé : ${s.owned} possédées, ${s.wanted} voulues, ${s.favorites} favoris, ${s.customArchetypes} archétypes perso, ${s.binders} classeurs`,
      );
    } catch (error) {
      if (error instanceof Error && !('status' in error)) this.toasts.error(error.message);
    } finally {
      this.importing.set(false);
    }
  }

  async deleteAccount() {
    const username = prompt(`Supprimer définitivement ton compte et toutes tes données ?\nTape ton pseudo (${this.auth.user()?.username}) pour confirmer :`);
    if (username) await this.auth.deleteAccount(username);
  }
}
