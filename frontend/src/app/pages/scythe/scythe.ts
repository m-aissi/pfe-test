import { Component, computed, HostListener, inject, signal } from '@angular/core';
import { Api, QueueItem, ScytheQueue } from '../../core/api';
import { Prefs } from '../../core/prefs';
import { imgUrl } from '../../core/util';

const PAGE_SIZE = 24;

interface HistoryEntry {
  items: QueueItem[];
  found: number[];
}

// passe en revue toutes les illustrations du jeu, page par page, pour retenir celles où figure une faux
@Component({
  selector: 'app-scythe',
  templateUrl: './scythe.html',
})
export class Scythe {
  private readonly api = inject(Api);
  readonly prefs = inject(Prefs);
  readonly imgUrl = imgUrl;

  readonly loading = signal(true);
  readonly page = signal<QueueItem[]>([]);
  readonly selected = signal<ReadonlySet<number>>(new Set());
  readonly prioritize = signal(false);
  readonly zoomed = signal<QueueItem | null>(null);
  readonly total = signal(0);
  readonly seenCount = signal(0);
  readonly foundCount = signal(0);
  readonly history = signal<HistoryEntry[]>([]);
  // page suivante déjà chargée (et ses images préchargées) pour enchaîner sans attendre
  private next: Promise<ScytheQueue> | null = null;

  readonly progress = computed(() => (this.total() ? (this.seenCount() / this.total()) * 100 : 0));

  constructor() {
    this.reload();
  }

  async reload() {
    this.loading.set(true);
    try {
      this.show(await this.fetch([]));
    } finally {
      this.loading.set(false);
    }
  }

  toggle(item: QueueItem) {
    const selected = new Set(this.selected());
    if (selected.has(item.imageId)) selected.delete(item.imageId);
    else selected.add(item.imageId);
    this.selected.set(selected);
  }

  zoom(item: QueueItem, event: Event) {
    event.preventDefault();
    event.stopPropagation();
    this.zoomed.set(item);
  }

  async validate() {
    const items = this.page();
    if (!items.length || this.loading()) return;
    const found = items.filter((item) => this.selected().has(item.imageId)).map((item) => item.imageId);
    this.loading.set(true);
    try {
      await this.api.post('/me/scythe/validate', { seen: items.map((item) => item.imageId), found });
      this.history.update((history) => [...history, { items, found }]);
      // la page préchargée a été demandée avant la validation : ses compteurs sont à mettre à jour
      const prefetched = this.next;
      const queue = prefetched
        ? { ...(await prefetched), seenCount: this.seenCount() + items.length, foundCount: this.foundCount() + found.length }
        : await this.fetch([]);
      this.show(queue);
    } finally {
      this.loading.set(false);
    }
  }

  async undo() {
    const last = this.history().at(-1);
    if (!last || this.loading()) return;
    this.loading.set(true);
    try {
      await this.api.post('/me/scythe/undo', { imageIds: last.items.map((item) => item.imageId) });
      this.history.update((history) => history.slice(0, -1));
      const queue = await this.fetch([]);
      this.show({ ...queue, items: last.items }, new Set(last.found));
    } finally {
      this.loading.set(false);
    }
  }

  togglePriority() {
    this.prioritize.update((value) => !value);
    this.next = this.fetch(this.page().map((item) => item.imageId));
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent) {
    if (this.zoomed()) {
      if (event.key == 'Escape' || event.key == 'Enter' || event.key == ' ') {
        event.preventDefault();
        this.zoomed.set(null);
      }
      return;
    }
    if ((event.target as HTMLElement).tagName == 'INPUT') return;
    if (event.key == 'Enter') {
      event.preventDefault();
      this.validate();
    } else if (event.key == 'Backspace') {
      event.preventDefault();
      this.undo();
    }
  }

  private show(queue: ScytheQueue, selected: ReadonlySet<number> = new Set()) {
    this.page.set(queue.items);
    this.selected.set(selected);
    this.total.set(queue.total);
    this.seenCount.set(queue.seenCount);
    this.foundCount.set(queue.foundCount);
    this.next = this.fetch(queue.items.map((item) => item.imageId));
    this.next.then((next) => next.items.forEach((item) => (new Image().src = imgUrl('cropped', item.imageId)))).catch(() => (this.next = null));
  }

  private fetch(exclude: number[]): Promise<ScytheQueue> {
    return this.api.get<ScytheQueue>('/me/scythe/queue', {
      limit: PAGE_SIZE,
      prioritize: this.prioritize() ? 1 : undefined,
      exclude: exclude.join(',') || undefined,
    });
  }
}
