import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Api, ArchetypeEntry, ArchetypeList, Wantlist } from '../../core/api';
import { Auth } from '../../core/auth';
import { Prefs } from '../../core/prefs';
import { Toasts } from '../../core/toast';
import { copyText, formatPrice, imgUrl, normalize } from '../../core/util';

const PAGE_SIZE = 60;

@Component({
  selector: 'app-home',
  imports: [FormsModule, RouterLink],
  templateUrl: './home.html',
})
export class Home {
  private readonly api = inject(Api);
  private readonly router = inject(Router);
  private readonly toasts = inject(Toasts);
  private readonly prefs = inject(Prefs);
  readonly auth = inject(Auth);
  readonly imgUrl = imgUrl;
  readonly formatPrice = formatPrice;

  readonly data = signal<ArchetypeList | null>(null);
  readonly filter = signal('');
  // les 667 archétypes ne sont pas affichés d'un coup : on en montre plus en descendant
  readonly shown = signal(PAGE_SIZE);

  readonly filtered = computed(() => {
    const query = normalize(this.filter());
    const archetypes = this.data()?.archetypes ?? [];
    return query ? archetypes.filter((archetype) => normalize(archetype.name).includes(query)) : archetypes;
  });
  readonly visible = computed(() => this.filtered().slice(0, this.shown()));

  constructor() {
    this.load();
  }

  async load() {
    try {
      this.data.set(await this.api.get<ArchetypeList>('/archetypes'));
    } catch {
      // erreur déjà affichée
    }
  }

  onFilter() {
    this.shown.set(PAGE_SIZE);
  }

  showMore() {
    this.shown.update((shown) => shown + PAGE_SIZE);
  }

  open(archetype: ArchetypeEntry) {
    this.router.navigate(['/archetype'], { queryParams: { key: archetype.key } });
  }

  async toggleFavorite(archetype: ArchetypeEntry, event: Event) {
    event.stopPropagation();
    if (!this.auth.user()) {
      this.toasts.show('Connecte-toi pour mettre des archétypes en favori');
      this.auth.goToLogin();
      return;
    }
    const favorite = !archetype.favorite;
    // les favoris passent en tête de liste
    this.data.update((data) => {
      if (!data) return data;
      const archetypes = data.archetypes.map((item) => (item.key == archetype.key ? { ...item, favorite } : item));
      archetypes.sort((a, b) => Number(b.favorite) - Number(a.favorite) || a.name.localeCompare(b.name));
      return { ...data, archetypes };
    });
    try {
      await this.api.put('/me/collection/favorites', { key: archetype.key, favorite });
    } catch {
      this.load();
    }
  }

  // liste des cartes voulues et pas encore possédées, à coller dans une commande
  async copyWantlist() {
    const wantlist = await this.api.get<Wantlist>('/me/wantlist');
    if (!wantlist.cardCount) {
      this.toasts.show('Aucune carte voulue à acheter : coche le cœur sur des cartes');
      return;
    }
    const text = wantlist.groups
      .map((group) => `[${group.archetype}]\n` + group.cards.map((card) => this.prefs.cardName(card)).join('\n'))
      .join('\n\n');
    if (await copyText(text)) {
      this.toasts.success(`${wantlist.cardCount} cartes copiées (${formatPrice(wantlist.totalPrice)})`);
    } else {
      this.toasts.error('Copie impossible dans ce navigateur');
    }
  }
}
