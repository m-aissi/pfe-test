import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Api, ArchetypeDetail, Card } from '../../core/api';
import { Auth } from '../../core/auth';
import { Prefs } from '../../core/prefs';
import { Toasts } from '../../core/toast';
import { formatPrice, imgUrl } from '../../core/util';
import { CardPreview } from '../../shared/card-preview';
import { CardZoom } from '../../shared/card-zoom';
import { CardSearch } from '../../shared/card-search';

const withoutId = (set: ReadonlySet<number>, id: number) => {
  const copy = new Set(set);
  copy.delete(id);
  return copy;
};

@Component({
  selector: 'app-archetype-editor',
  imports: [FormsModule, RouterLink, CardSearch, CardPreview, CardZoom],
  templateUrl: './archetype-editor.html',
})
export class ArchetypeEditor {
  private readonly api = inject(Api);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toasts = inject(Toasts);
  readonly prefs = inject(Prefs);
  readonly auth = inject(Auth);
  readonly imgUrl = imgUrl;
  readonly formatPrice = formatPrice;

  // clé de l'archétype modifié, null pour une création
  readonly editKey = signal<string | null>(null);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly name = signal('');
  // archétypes officiels regroupés dans celui-ci : toutes leurs cartes, y compris les futures, en font partie
  readonly sources = signal<string[]>([]);
  // cartes de chaque archétype regroupé, pour les afficher et les cocher
  readonly sourceCards = signal(new Map<string, Card[]>());
  // cartes des archétypes regroupés retirées une à une
  readonly excluded = signal(new Set<number>());
  // cartes ajoutées une à une
  readonly cards = signal<Card[]>([]);
  // sur téléphone : onglet recherche ou onglet sélection
  readonly tab = signal<'search' | 'selection'>('search');
  // carte affichée en grand dans la colonne du milieu (dernière survolée)
  readonly preview = signal<Card | null>(null);
  // carte affichée en plein écran
  readonly zoomed = signal<Card | null>(null);
  // admin : créer un archétype du site (commun à tous) plutôt qu'un archétype perso
  readonly forEveryone = signal(false);

  // identifiants des cartes venant des archétypes regroupés (exclues comprises)
  private readonly sourceIds = computed(() => new Set([...this.sourceCards().values()].flat().map((card) => card.id)));

  // contenu final de l'archétype : archétypes regroupés (moins les exclues) + cartes ajoutées, par nom
  readonly allCards = computed(() => {
    const byId = new Map<number, Card>();
    const excluded = this.excluded();
    for (const source of this.sources()) {
      for (const card of this.sourceCards().get(source) ?? []) if (!excluded.has(card.id)) byId.set(card.id, card);
    }
    for (const card of this.cards()) byId.set(card.id, card);
    return [...byId.values()].sort((a, b) => this.prefs.cardName(a).localeCompare(this.prefs.cardName(b)));
  });
  readonly cardIds = computed(() => new Set(this.allCards().map((card) => card.id)));
  readonly totalPrice = computed(() => this.allCards().reduce((sum, card) => sum + card.price, 0));

  constructor() {
    const key = this.route.snapshot.queryParamMap.get('key');
    if (key?.startsWith('c:') || key?.startsWith('s:')) this.loadExisting(key);
    // à partir d'un archétype officiel : on le reprend tel quel, l'admin en fait par défaut un archétype du site
    const from = this.route.snapshot.queryParamMap.get('from');
    if (from?.startsWith('a:')) {
      this.name.set(from.slice(2));
      this.forEveryone.set(!!this.auth.user()?.admin);
      this.addSource(from.slice(2), false);
    }
  }

  private async loadExisting(key: string) {
    this.editKey.set(key);
    this.loading.set(true);
    try {
      const detail = await this.api.get<ArchetypeDetail>('/archetypes/detail', { key });
      this.name.set(detail.name);
      this.excluded.set(new Set(detail.excludedIds ?? []));
      const own = new Set(detail.cardIds ?? []);
      this.cards.set(detail.cards.filter((card) => own.has(card.id)));
      await Promise.all((detail.sources ?? []).map((source) => this.addSource(source, false)));
    } finally {
      this.loading.set(false);
    }
  }

  toggle(card: Card) {
    if (this.cardIds().has(card.id)) this.removeCard(card);
    else this.addCard(card);
  }

  addCard(card: Card) {
    // carte d'un archétype regroupé qu'on avait retirée : on la réintègre simplement
    if (this.sourceIds().has(card.id)) this.excluded.update((set) => withoutId(set, card.id));
    else this.cards.update((cards) => [...cards, card]);
  }

  removeCard(card: Card) {
    this.cards.update((cards) => cards.filter((item) => item.id != card.id));
    if (this.sourceIds().has(card.id)) this.excluded.update((set) => new Set(set).add(card.id));
  }

  // regroupe tout un archétype officiel (ses futures cartes arriveront toutes seules)
  async addSource(source: string, notify = true) {
    if (!this.sources().includes(source)) this.sources.update((sources) => [...sources, source]);
    try {
      const detail = await this.api.get<ArchetypeDetail>('/archetypes/detail', { key: 'a:' + source }, { silent: true });
      this.sourceCards.update((map) => new Map(map).set(source, detail.cards));
      if (notify) this.toasts.success(`${detail.cards.length} cartes de ${source} ajoutées`);
    } catch {
      // archétype disparu de ygoprodeck : il sera écarté à l'enregistrement
    }
  }

  removeSource(source: string) {
    this.sources.update((sources) => sources.filter((item) => item != source));
  }

  // supprimer un archétype fait réapparaître les archétypes officiels qu'il regroupait
  async remove() {
    const key = this.editKey();
    if (!key || !confirm(`Supprimer l'archétype "${this.name()}" ? Les archétypes officiels qu'il regroupait réapparaîtront.`)) return;
    await this.api.delete((key.startsWith('s:') ? '/admin/site-archetypes/' : '/me/custom-archetypes/') + key.slice(2));
    this.toasts.success('Archétype supprimé');
    this.router.navigateByUrl('/');
  }

  async save() {
    const name = this.name().trim();
    if (!name) return this.toasts.error("Donne un nom à l'archétype");
    if (!this.allCards().length) return this.toasts.error('Ajoute au moins une carte');
    // une exclusion ne sert que pour une carte d'un archétype encore regroupé
    const sourceIds = new Set(this.sources().flatMap((source) => (this.sourceCards().get(source) ?? []).map((card) => card.id)));
    const body = {
      name,
      archetypes: this.sources(),
      cardIds: this.cards().map((card) => card.id),
      excludedIds: [...this.excluded()].filter((id) => sourceIds.has(id)),
    };
    this.saving.set(true);
    try {
      const key = this.editKey();
      const base = key?.startsWith('s:') || (!key && this.forEveryone()) ? '/admin/site-archetypes' : '/me/custom-archetypes';
      const result = key ? await this.api.put<{ key: string }>(base + '/' + key.slice(2), body) : await this.api.post<{ key: string }>(base, body);
      this.toasts.success(key ? 'Archétype modifié' : 'Archétype créé');
      this.router.navigate(['/archetype'], { queryParams: { key: result.key } });
    } catch {
      this.saving.set(false);
    }
  }
}
