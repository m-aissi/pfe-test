import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Api, Binder, BinderSummary } from '../../core/api';
import { LegacyImport } from '../../core/legacy-import';
import { Toasts } from '../../core/toast';
import { formatPrice, imgUrl } from '../../core/util';

@Component({
  selector: 'app-binders',
  imports: [RouterLink],
  templateUrl: './binders.html',
})
export class Binders {
  private readonly api = inject(Api);
  private readonly router = inject(Router);
  private readonly toasts = inject(Toasts);
  private readonly legacyImport = inject(LegacyImport);
  readonly imgUrl = imgUrl;
  readonly formatPrice = formatPrice;

  readonly binders = signal<BinderSummary[] | null>(null);

  constructor() {
    this.load();
  }

  async load() {
    this.binders.set(await this.api.get<BinderSummary[]>('/me/binders'));
  }

  async create() {
    const name = prompt('Nom du nouveau classeur ?', 'Mon classeur')?.trim();
    if (!name) return;
    const binder = await this.api.post<Binder>('/me/binders', { name });
    this.router.navigate(['/classeurs', binder.id]);
  }

  async remove(binder: BinderSummary) {
    if (!confirm(`Supprimer le classeur "${binder.name}" et ses ${binder.cardCount} cartes ?`)) return;
    await this.api.delete('/me/binders/' + binder.id);
    this.toasts.success('Classeur supprimé');
    this.load();
  }

  // fichier YGOToolsBinders.json exporté par l'ancien site
  async importFile(input: HTMLInputElement) {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    try {
      const summary = await this.legacyImport.importFile(file);
      this.toasts.success(`${summary.binders} classeur(s) importé(s)`);
      this.load();
    } catch (error) {
      if (error instanceof Error && !('status' in error)) this.toasts.error(error.message);
    }
  }
}
