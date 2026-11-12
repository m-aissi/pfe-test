import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Api, ArchetypeDetail, Card } from '../../core/api';
import { Prefs } from '../../core/prefs';
import { Toasts } from '../../core/toast';
import { formatPrice, imgUrl } from '../../core/util';
import { CardSearch, SearchItem } from '../../shared/card-search';

@Component({
  selector: 'app-archetype-editor',
  imports: [FormsModule, RouterLink, CardSearch],
  templateUrl: './archetype-editor.html',
})
export class ArchetypeEditor {
  private readonly api = inject(Api);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toasts = inject(Toasts);
  readonly prefs = inject(Prefs);
  readonly imgUrl = imgUrl;
  readonly formatPrice = formatPrice;

  // clé de l'archétype modifié, null pour une création
  readonly editKey = signal<string | null>(null);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly name = signal('');
  // archétypes officiels fusionnés dans celui-ci (conservés tels quels à la modification)
  readonly sources = signal<string[]>([]);
  readonly cards = signal<Card[]>([]);
  // sur téléphone : onglet recherche ou onglet sélection
  readonly tab = signal<'search' | 'selection'>('search');

  readonly cardIds = computed(() => new Set(this.cards().map((card) => card.id)));
  readonly totalPrice = computed(() => this.cards().reduce((sum, card) => sum + card.price, 0));

  constructor() {
    const key = this.route.snapshot.queryParamMap.get('key');
    if (key?.startsWith('c:')) this.loadExisting(key);
  }

  private async loadExisting(key: string) {
    this.editKey.set(key);
    this.loading.set(true);
    try {
      const detail = await this.api.get<ArchetypeDetail>('/archetypes/detail', { key });
      this.name.set(detail.name);
      this.sources.set(detail.sources ?? []);
      const own = new Set(detail.cardIds ?? []);
      this.cards.set(detail.cards.filter((card) => own.has(card.id)));
    } finally {
      this.loading.set(false);
    }
  }

  // clic sur un résultat : ajoute la carte, ou la retire si elle y est déjà
  toggle(item: SearchItem) {
    if (this.cardIds().has(item.card.id)) this.removeCard(item.card);
    else this.cards.update((cards) => [...cards, item.card].sort((a, b) => a.name.localeCompare(b.name)));
  }

  removeCard(card: Card) {
    this.cards.update((cards) => cards.filter((item) => item.id != card.id));
  }

  removeSource(source: string) {
    this.sources.update((sources) => sources.filter((item) => item != source));
  }

  async save() {
    const name = this.name().trim();
    if (!name) return this.toasts.error("Donne un nom à l'archétype");
    if (!this.cards().length && !this.sources().length) return this.toasts.error('Ajoute au moins une carte');
    const body = { name, archetypes: this.sources(), cardIds: this.cards().map((card) => card.id) };
    this.saving.set(true);
    try {
      const key = this.editKey();
      const result = key
        ? await this.api.put<{ key: string }>('/me/custom-archetypes/' + key.slice(2), body)
        : await this.api.post<{ key: string }>('/me/custom-archetypes', body);
      this.toasts.success(key ? 'Archétype modifié' : 'Archétype créé');
      this.router.navigate(['/archetype'], { queryParams: { key: result.key } });
    } catch {
      this.saving.set(false);
    }
  }
}
