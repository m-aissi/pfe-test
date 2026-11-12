import { Component, computed, effect, ElementRef, inject, input, OnDestroy, OnInit, output, signal, viewChild } from '@angular/core';
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

export type SearchSort = 'name' | 'new' | 'random' | 'price' | 'price-desc';

const PAGE_SIZE = 30;
const SORTS: { value: SearchSort; label: string; icon: string }[] = [
  { value: 'name', label: 'A → Z', icon: 'bi-sort-alpha-down' },
  { value: 'new', label: 'Nouveautés', icon: 'bi-stars' },
  { value: 'random', label: 'Au hasard', icon: 'bi-shuffle' },
  { value: 'price', label: 'Moins chères', icon: 'bi-currency-euro' },
  { value: 'price-desc', label: 'Plus chères', icon: 'bi-gem' },
];
const randomSeed = () => 1000 + Math.floor(Math.random() * 1_999_000);
let facetsCache: Promise<Facets> | null = null;

// recherche de cartes avec filtres, partagée par l'éditeur d'archétype et le classeur
@Component({
  selector: 'app-card-search',
  imports: [FormsModule],
  templateUrl: './card-search.html',
})
export class CardSearch implements OnInit, OnDestroy {
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
  // icône de ce bouton rapide
  readonly quickIcon = input('bi-plus-lg');
  // sans recherche ni filtre : liste toutes les cartes par ordre alphabétique (sinon n'affiche rien)
  readonly browseAll = input(false);
  // largeur minimale d'une vignette
  readonly tileSize = input('5.25rem');

  readonly pick = output<SearchItem>();
  // carte survolée à la souris, pour l'afficher en grand
  readonly hover = output<SearchItem>();
  readonly quick = output<SearchItem>();
  readonly dragStart = output<SearchDragStart>();
  readonly dragEnd = output<void>();

  readonly sorts = SORTS;
  readonly sort = signal<SearchSort>('name');
  // archétype exploré (posé depuis l'extérieur, par exemple depuis la vue en grand d'une carte)
  readonly archetype = signal('');
  private seed = randomSeed();
  private readonly sentinel = viewChild<ElementRef<HTMLElement>>('sentinel');
  private readonly scroller = viewChild<ElementRef<HTMLElement>>('scroller');

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
    // ne cherche que dans les noms (par défaut la recherche porte aussi sur le texte des cartes)
    namesOnly: signal(false),
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
    // défilement infini : la page suivante se charge quand le bas de la liste approche
    effect((onCleanup) => {
      const element = this.sentinel()?.nativeElement;
      if (!element) return;
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting) && this.hasMore() && !this.loading()) this.more();
        },
        { root: this.scroller()?.nativeElement, rootMargin: '0px 0px 800px 0px' },
      );
      observer.observe(element);
      onCleanup(() => observer.disconnect());
    });
    facetsCache ??= this.api.get<Facets>('/cards/facets', undefined, { silent: true });
    facetsCache.then((facets) => this.facets.set(facets)).catch(() => (facetsCache = null));
  }

  ngOnInit() {
    if (this.browseAll()) this.search(0);
  }

  ngOnDestroy() {
    clearTimeout(this.timer);
  }

  onChange() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.search(0), 300);
  }

  setSort(sort: SearchSort) {
    // recliquer sur "Au hasard" remélange
    if (sort == 'random') this.seed = randomSeed();
    this.sort.set(sort);
    this.search(0);
  }

  exploreArchetype(name: string) {
    this.archetype.set(name);
    this.query.set('');
    this.search(0);
  }

  clearArchetype() {
    this.archetype.set('');
    this.search(0);
  }

  resetFilters() {
    const { namesOnly, ...textFilters } = this.filters;
    for (const filter of Object.values(textFilters)) filter.set('');
    namesOnly.set(false);
    this.search(0);
  }

  async search(page: number) {
    clearTimeout(this.timer);
    const query = this.query().trim();
    const requestId = ++this.requestId;
    if (!query && this.activeFilters() == 0 && !this.archetype() && !this.browseAll()) {
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
        desc: f.namesOnly() ? undefined : 1,
        type: f.type(),
        race: f.race(),
        attribute: f.attribute(),
        atk: f.atk(),
        def: f.def(),
        level: f.level(),
        link: f.link(),
        scale: f.scale(),
        archetype: this.archetype(),
        sort: this.sort() == 'name' ? undefined : this.sort(),
        seed: this.sort() == 'random' ? this.seed : undefined,
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
    if (this.loading()) return;
    this.search(this.page + 1);
  }

  onDragStart(item: SearchItem, event: DragEvent) {
    // Firefox ne démarre pas un glisser sans données
    event.dataTransfer?.setData('text/plain', item.card.name);
    this.dragStart.emit({ item, event });
  }
}
