import { Component, computed, effect, HostListener, inject, signal, untracked } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Api, ArchetypeCard, ArchetypeDetail, Card } from '../../core/api';
import { Auth } from '../../core/auth';
import { CollectionStore } from '../../core/collection';
import { ArchetypeSort, Prefs } from '../../core/prefs';
import { Toasts } from '../../core/toast';
import { copyText, formatPrice, imgUrl, roundPrice, typeLine } from '../../core/util';
import { CardZoom } from '../../shared/card-zoom';
import { CardmarketLink } from '../../shared/cardmarket-link';



@Component({
  selector: 'app-archetype',
  imports: [RouterLink, NgTemplateOutlet, CardZoom, CardmarketLink],
  templateUrl: './archetype.html',
})
export class Archetype {
  private readonly api = inject(Api);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toasts = inject(Toasts);
  readonly auth = inject(Auth);
  readonly collection = inject(CollectionStore);
  readonly prefs = inject(Prefs);
  readonly imgUrl = imgUrl;
  readonly formatPrice = formatPrice;
  readonly typeLine = typeLine;

  readonly detail = signal<ArchetypeDetail | null>(null);
  readonly notFound = signal(false);
  readonly selected = signal<ArchetypeCard | null>(null);
  // carte affichée en plein écran (clic sur l'aperçu, ou toucher une carte sur téléphone)
  readonly zoomOpen = signal(false);
  // texte complet des cartes, chargé à la demande
  private readonly descriptions = signal(new Map<number, Card>());


  readonly stats = computed(() => {
    const cards = this.detail()?.cards ?? [];
    const owned = this.collection.owned();
    const wanted = this.collection.wanted();
    const missing = cards.filter((card) => !owned.has(card.id));
    const wantedMissing = missing.filter((card) => wanted.has(card.id));
    return {
      total: cards.length,
      owned: cards.length - missing.length,
      wanted: cards.filter((card) => wanted.has(card.id)).length,
      remainingPrice: roundPrice(missing.reduce((sum, card) => sum + card.price, 0)),
      wantedPrice: roundPrice(wantedMissing.reduce((sum, card) => sum + card.price, 0)),
    };
  });

  // voulues d'abord, possédées à la fin, puis le tri choisi, puis le nom
  readonly sorted = computed(() => {
    const cards = this.detail()?.cards ?? [];
    const owned = this.collection.owned();
    const wanted = this.collection.wanted();
    const { sort } = this.prefs.archetypeSort();
    const group = (card: Card) => (owned.has(card.id) ? 2 : wanted.has(card.id) ? 0 : 1);
    const compare: Record<ArchetypeSort, (a: Card, b: Card) => number> = {
      name: () => 0,
      price: (a, b) => a.price - b.price,
      'price-desc': (a, b) => b.price - a.price,
      new: (a, b) => (b.tcgDate ?? '').localeCompare(a.tcgDate ?? ''),
    };
    return [...cards].sort(
      (a, b) => group(a) - group(b) || (compare[sort] ?? compare.name)(a, b) || this.prefs.cardName(a).localeCompare(this.prefs.cardName(b)),
    );
  });

  readonly visible = this.sorted;

  setSort(sort: ArchetypeSort) {
    this.prefs.setArchetypeSort({ sort });
  }

  // un seul bouton prix : moins chères d'abord, puis plus chères au clic suivant
  togglePrice() {
    this.setSort(this.prefs.archetypeSort().sort == 'price' ? 'price-desc' : 'price');
  }

  readonly selectedDescription = computed(() => {
    const card = this.selected();
    const full = card && this.descriptions().get(card.id);
    if (!full) return null;
    return this.prefs.language() == 'fr' ? (full.descFr ?? full.desc) : full.desc;
  });

  constructor() {
    this.route.queryParamMap.subscribe((params) => this.load(params.get('key') ?? ''));
    // charge le texte de la carte affichée en grand
    effect(() => {
      const card = this.selected();
      if (card) untracked(() => this.loadDescription(card.id));
    });
  }

  async load(key: string) {
    this.detail.set(null);
    this.notFound.set(false);
    this.selected.set(null);
    try {
      const detail = await this.api.get<ArchetypeDetail>('/archetypes/detail', { key }, { silent: true });
      this.detail.set(detail);
      this.selected.set(detail.cards[0] ?? null);
    } catch {
      this.notFound.set(true);
    }
  }

  select(card: ArchetypeCard) {
    this.selected.set(card);
    // sans colonne d'aperçu (téléphone, tablette), la carte s'ouvre directement en grand
    if (window.matchMedia('(width < 64rem)').matches) this.zoomOpen.set(true);
  }

  // carte suivante / précédente dans la liste affichée (flèches du clavier ou de l'aperçu)
  step(delta: number) {
    const cards = this.visible();
    const index = cards.findIndex((card) => card.id == this.selected()?.id);
    const next = cards[(index + delta + cards.length) % cards.length];
    if (next) this.selected.set(next);
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent) {
    // la vue plein écran gère elle-même ses touches
    if (this.zoomOpen() || (event.target as HTMLElement).tagName == 'INPUT') return;
    if (event.key == 'ArrowRight') this.step(1);
    else if (event.key == 'ArrowLeft') this.step(-1);
  }

  async wantAll() {
    const owned = this.collection.owned();
    const ids = this.visible().filter((card) => !owned.has(card.id)).map((card) => card.id);
    if (ids.length && (await this.collection.setWanted(ids, true))) this.toasts.success(`${ids.length} cartes ajoutées aux voulues`);
  }

  async unwantAll() {
    const wanted = this.collection.wanted();
    const ids = this.visible().filter((card) => wanted.has(card.id)).map((card) => card.id);
    if (ids.length && (await this.collection.setWanted(ids, false))) this.toasts.success(`${ids.length} cartes retirées des voulues`);
  }

  // illustration de la tuile sur l'accueil ; recliquer sur la couverture actuelle revient à celle par défaut
  async setCover(card: ArchetypeCard) {
    const detail = this.detail()!;
    const reset = detail.cover == card.imageId;
    await this.api.put('/me/collection/cover', { key: detail.key, imageId: reset ? null : card.imageId });
    // recharge pour connaître la couverture par défaut après une remise à zéro
    const fresh = await this.api.get<ArchetypeDetail>('/archetypes/detail', { key: detail.key }, { silent: true });
    this.detail.update((current) => current && { ...current, cover: fresh.cover });
    this.toasts.success(reset ? 'Couverture par défaut rétablie' : 'Nouvelle couverture');
  }

  async copyList() {
    const owned = this.collection.owned();
    const wanted = this.collection.wanted();
    const cards = (this.detail()?.cards ?? []).filter((card) => wanted.has(card.id) && !owned.has(card.id));
    if (!cards.length) {
      this.toasts.show('Aucune carte voulue à acheter dans cet archétype');
      return;
    }
    const ok = await copyText(cards.map((card) => this.prefs.cardName(card)).join('\n'));
    if (ok) this.toasts.success(`${cards.length} cartes copiées`);
    else this.toasts.error('Copie impossible dans ce navigateur');
  }

  edit() {
    const detail = this.detail()!;
    // un archétype officiel ne se modifie pas : l'éditeur part de lui pour créer un archétype du site (admin) ou perso
    if (detail.kind == 'official') this.router.navigate(['/archetypes/nouveau'], { queryParams: { from: detail.key } });
    else this.router.navigate(['/archetypes/modifier'], { queryParams: { key: detail.key } });
  }

  mergeWithOthers() {
    this.router.navigate(['/archetypes/fusion'], { queryParams: { with: this.detail()!.key } });
  }

  // admin : l'archétype perso devient un archétype du site, mis à jour pour tous les comptes
  async publish() {
    const detail = this.detail()!;
    if (!confirm(`Publier "${detail.name}" pour tous ? Les archétypes officiels qu'il regroupe disparaîtront de la liste de tout le monde, remplacés par celui-ci.`)) return;
    const { key } = await this.api.post<{ key: string }>('/admin/site-archetypes/publish/' + detail.key.slice(2), {});
    this.toasts.success('Archétype publié pour tous');
    this.router.navigate(['/archetype'], { queryParams: { key } });
  }

  private async loadDescription(cardId: number) {
    if (this.descriptions().has(cardId)) return;
    try {
      const [card] = await this.api.get<Card[]>('/cards', { ids: cardId, desc: 1 }, { silent: true });
      if (card) this.descriptions.update((map) => new Map(map).set(cardId, card));
    } catch {
      // l'aperçu reste sans texte
    }
  }
}
