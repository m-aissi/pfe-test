import { Component, computed, effect, HostListener, inject, signal, untracked } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Api, ArchetypeCard, ArchetypeDetail, Card } from '../../core/api';
import { Auth } from '../../core/auth';
import { CollectionStore } from '../../core/collection';
import { Prefs } from '../../core/prefs';
import { Toasts } from '../../core/toast';
import { copyText, formatPrice, imgUrl, roundPrice, typeLine } from '../../core/util';

type Filter = 'all' | 'missing' | 'owned' | 'wanted';

@Component({
  selector: 'app-archetype',
  imports: [RouterLink],
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
  readonly filter = signal<Filter>('all');
  readonly selected = signal<ArchetypeCard | null>(null);
  // sur téléphone, l'aperçu s'ouvre par-dessus la liste
  readonly previewOpen = signal(false);
  // texte complet des cartes, chargé à la demande
  private readonly descriptions = signal(new Map<number, Card>());

  readonly filters: { value: Filter; label: string }[] = [
    { value: 'all', label: 'Toutes' },
    { value: 'missing', label: 'À acheter' },
    { value: 'owned', label: 'Possédées' },
    { value: 'wanted', label: 'Voulues' },
  ];

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

  readonly visible = computed(() => {
    const cards = this.detail()?.cards ?? [];
    const owned = this.collection.owned();
    const wanted = this.collection.wanted();
    switch (this.filter()) {
      case 'missing':
        return cards.filter((card) => !owned.has(card.id));
      case 'owned':
        return cards.filter((card) => owned.has(card.id));
      case 'wanted':
        return cards.filter((card) => wanted.has(card.id));
      default:
        return cards;
    }
  });

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
    if (window.matchMedia('(width < 64rem)').matches) this.previewOpen.set(true);
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
    if ((event.target as HTMLElement).tagName == 'INPUT') return;
    if (event.key == 'ArrowRight') this.step(1);
    else if (event.key == 'ArrowLeft') this.step(-1);
    else if (event.key == 'Escape') this.previewOpen.set(false);
  }

  async wantAll() {
    const owned = this.collection.owned();
    const ids = this.visible().filter((card) => !owned.has(card.id)).map((card) => card.id);
    if (ids.length && (await this.collection.setWanted(ids, true))) this.toasts.success(`${ids.length} cartes ajoutées aux voulues`);
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
    this.router.navigate(['/archetypes/modifier'], { queryParams: { key: this.detail()!.key } });
  }

  async remove() {
    const detail = this.detail()!;
    if (!confirm(`Supprimer l'archétype "${detail.name}" ? Les archétypes officiels qu'il regroupait réapparaîtront.`)) return;
    await this.api.delete('/me/custom-archetypes/' + detail.key.slice(2));
    this.toasts.success('Archétype supprimé');
    this.router.navigateByUrl('/');
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
