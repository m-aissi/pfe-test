import { Component, computed, inject, input, OnDestroy, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api, Card, Facets, SearchResult } from '../core/api';
import { Prefs } from '../core/prefs';
import { formatPrice, imgUrl } from '../core/util';

// un résultat : une carte, avec l'illustration à montrer
export interface SearchItem {
  card: Card;
  imageId: number;
}

export interface SearchDragStart {
  item: SearchItem;
  event: DragEvent;
}

const PAGE_SIZE = 30;
let facetsCache: Promise<Facets> | null = null;

// recherche de cartes avec filtres, partagée par l'éditeur d'archétype et le classeur
@Component({
  selector: 'app-card-search',
  imports: [FormsModule],
  templateUrl: './card-search.html',
})
export class CardSearch implements OnDestroy {
  private readonly api = inject(Api);
  readonly prefs = inject(Prefs);
  readonly imgUrl = imgUrl;
  readonly formatPrice = formatPrice;

  // "artworks" : un résultat par illustration (le classeur), "cards" : un résultat par carte
  readonly mode = input<'cards' | 'artworks'>('cards');
  // illustration actuellement sélectionnée (surlignée)
  readonly selectedImageId = input<number | null>(null);
  // cartes déjà ajoutées (cochées)
  readonly markedCardIds = input<ReadonlySet<number>>(new Set());
  readonly draggable = input(false);
  // libellé du bouton rapide affiché sur chaque résultat ; vide = pas de bouton
  readonly quickLabel = input('');

  readonly pick = output<SearchItem>();
  readonly quick = output<SearchItem>();
  readonly dragStart = output<SearchDragStart>();
  readonly dragEnd = output<void>();

  readonly query = signal('');
  readonly showFilters = signal(false);
  readonly filters = {
    type: signal(''),
    race: signal(''),
    attribute: signal(''),
    atk: signal(''),
    def: signal(''),
    level: signal(''),
    link: signal(''),
    scale: signal(''),
    inDesc: signal(false),
  };
  readonly facets = signal<Facets>({ types: [], races: [], attributes: [] });

  readonly cards = signal<Card[]>([]);
  readonly total = signal(0);
  readonly hasMore = signal(false);
  readonly loading = signal(false);
  private page = 0;
  private requestId = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;

  readonly items = computed<SearchItem[]>(() =>
    this.mode() == 'artworks'
      ? this.cards().flatMap((card) => card.images.map((imageId) => ({ card, imageId })))
      : this.cards().map((card) => ({ card, imageId: card.images[0] })),
  );

  readonly activeFilters = computed(
    () =>
      Object.values(this.filters).filter((filter) => {
        // un champ numérique vidé vaut null
        const value: unknown = filter();
        return value !== '' && value !== null && value !== false;
      }).length,
  );

  constructor() {
    facetsCache ??= this.api.get<Facets>('/cards/facets', undefined, { silent: true });
    facetsCache.then((facets) => this.facets.set(facets)).catch(() => (facetsCache = null));
  }

  ngOnDestroy() {
    clearTimeout(this.timer);
  }

  onChange() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.search(0), 300);
  }

  resetFilters() {
    const { inDesc, ...textFilters } = this.filters;
    for (const filter of Object.values(textFilters)) filter.set('');
    inDesc.set(false);
    this.search(0);
  }

  async search(page: number) {
    clearTimeout(this.timer);
    const query = this.query().trim();
    const requestId = ++this.requestId;
    if (!query && this.activeFilters() == 0) {
      this.cards.set([]);
      this.total.set(0);
      this.hasMore.set(false);
      this.loading.set(false);
      return;
    }
    this.loading.set(true);
    const f = this.filters;
    try {
      const result = await this.api.get<SearchResult>('/cards/search', {
        q: query,
        desc: f.inDesc() ? 1 : undefined,
        type: f.type(),
        race: f.race(),
        attribute: f.attribute(),
        atk: f.atk(),
        def: f.def(),
        level: f.level(),
        link: f.link(),
        scale: f.scale(),
        page,
        limit: PAGE_SIZE,
      });
      if (requestId != this.requestId) return;
      this.page = page;
      this.cards.set(page == 0 ? result.items : [...this.cards(), ...result.items]);
      this.total.set(result.total);
      this.hasMore.set(result.hasMore);
    } catch {
      // erreur déjà affichée
    } finally {
      if (requestId == this.requestId) this.loading.set(false);
    }
  }

  more() {
    this.search(this.page + 1);
  }

  onDragStart(item: SearchItem, event: DragEvent) {
    // Firefox ne démarre pas un glisser sans données
    event.dataTransfer?.setData('text/plain', item.card.name);
    this.dragStart.emit({ item, event });
  }
}
