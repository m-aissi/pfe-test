import { effect, inject, Injectable, signal, untracked } from '@angular/core';
import { Api } from './api';
import { Auth } from './auth';
import { Toasts } from './toast';

type Flag = 'owned' | 'wanted';

// cartes cochées "possédée" (le timbre) et "voulue" (le cœur) par le compte connecté.
// Une coche vaut pour la carte partout où elle apparaît, quel que soit l'archétype.
@Injectable({ providedIn: 'root' })
export class CollectionStore {
  private readonly api = inject(Api);
  private readonly auth = inject(Auth);
  private readonly toasts = inject(Toasts);

  readonly owned = signal<ReadonlySet<number>>(new Set());
  readonly wanted = signal<ReadonlySet<number>>(new Set());

  constructor() {
    // recharge à chaque connexion, vide à la déconnexion
    effect(() => {
      const user = this.auth.user();
      untracked(() => (user ? void this.load() : this.clear()));
    });
  }

  async load() {
    try {
      const data = await this.api.get<{ owned: number[]; wanted: number[] }>('/me/collection', undefined, { silent: true });
      this.owned.set(new Set(data.owned));
      this.wanted.set(new Set(data.wanted));
    } catch {
      // l'intercepteur de session s'occupe du cas "déconnecté"
    }
  }

  toggleOwned(cardId: number) {
    return this.set('owned', [cardId], !this.owned().has(cardId));
  }

  toggleWanted(cardId: number) {
    return this.set('wanted', [cardId], !this.wanted().has(cardId));
  }

  setWanted(cardIds: number[], value: boolean) {
    return this.set('wanted', cardIds, value);
  }

  // l'affichage change tout de suite, l'enregistrement suit ; s'il échoue on relit l'état réel du serveur
  private async set(flag: Flag, cardIds: number[], value: boolean): Promise<boolean> {
    if (!this.auth.user()) {
      this.toasts.show('Connecte-toi pour enregistrer tes cartes');
      this.auth.goToLogin();
      return false;
    }
    const next = new Set(this[flag]());
    for (const id of cardIds) {
      if (value) next.add(id);
      else next.delete(id);
    }
    this[flag].set(next);
    try {
      await this.api.put('/me/collection/cards', { cardIds, [flag]: value });
      return true;
    } catch {
      await this.load();
      return false;
    }
  }

  private clear() {
    this.owned.set(new Set());
    this.wanted.set(new Set());
  }
}
