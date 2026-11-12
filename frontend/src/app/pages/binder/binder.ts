import { Component, computed, DestroyRef, ElementRef, HostListener, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Api, Binder, BinderSlot } from '../../core/api';
import { Prefs } from '../../core/prefs';
import { Toasts } from '../../core/toast';
import { copyText, formatPrice, imgUrl, roundPrice } from '../../core/util';
import { CardSearch, SearchDragStart, SearchItem } from '../../shared/card-search';

const SLOTS_PER_PAGE = 9;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 6;
const ZOOM_STEP = 1.25;
const SAVE_DELAY_MS = 600;

// mise en page du screen en pixels, calée sur la résolution native des images (813 x 1185)
const SHOT = { cardW: 813, cardH: 1185, gap: 36, pagePad: 56, pageSpacing: 90, margin: 90, captionH: 120 };

interface SlotRef {
  page: number;
  slot: number;
}

// ce qu'on est en train de glisser : un résultat de recherche, ou le contenu d'une case
interface DragSource {
  item?: SearchItem;
  from?: SlotRef;
}

function emptyPage(): (BinderSlot | null)[] {
  return new Array(SLOTS_PER_PAGE).fill(null);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image introuvable : ' + src));
    img.src = src;
  });
}

@Component({
  selector: 'app-binder',
  imports: [RouterLink, CardSearch],
  templateUrl: './binder.html',
  styleUrl: './binder.css',
})
export class BinderEditor {
  private readonly api = inject(Api);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toasts = inject(Toasts);
  readonly prefs = inject(Prefs);
  readonly imgUrl = imgUrl;
  readonly formatPrice = formatPrice;

  readonly binder = signal<Binder | null>(null);
  readonly notFound = signal(false);
  readonly saveState = signal<'saved' | 'pending' | 'saving' | 'error'>('saved');
  private saveTimer: ReturnType<typeof setTimeout> | undefined;

  // page sur laquelle on se trouve ; la double page affichée est celle qui la contient
  readonly cursor = signal(0);
  // téléphone : une page à la fois
  readonly single = signal(false);
  readonly zoom = signal(1);
  readonly screenshotLoading = signal(false);

  // carte choisie dans la recherche, posée à chaque case touchée
  readonly selectedItem = signal<SearchItem | null>(null);
  // case touchée sans carte choisie : ouvre ses actions (possédée, retirer, déplacer)
  readonly pickedSlot = signal<SlotRef | null>(null);
  readonly moving = signal(false);
  readonly searchOpen = signal(false);
  readonly showSettings = signal(false);
  readonly dragOver = signal<string | null>(null);
  private dragSource: DragSource | null = null;

  private readonly scroll = viewChild<ElementRef<HTMLElement>>('scroll');

  readonly pageCount = computed(() => this.binder()?.pages.length ?? 0);
  private readonly offset = computed(() => (this.binder()?.firstPageAlone ? 1 : 0));

  // double page qui contient la page courante ; null = intérieur de la couverture
  readonly spread = computed<(number | null)[]>(() => {
    const left = Math.floor((this.cursor() + this.offset()) / 2) * 2 - this.offset();
    return [left >= 0 ? left : null, left + 1 < this.pageCount() ? left + 1 : null];
  });

  readonly shown = computed<(number | null)[]>(() => (this.single() ? [this.cursor()] : this.spread()));
  private readonly shownPages = computed(() => this.shown().filter((page): page is number => page !== null));
  readonly canPrevious = computed(() => Math.min(...this.shownPages()) > 0);
  readonly canNext = computed(() => Math.max(...this.shownPages()) < this.pageCount() - 1);

  readonly label = computed(() => {
    const pages = this.shownPages().map((page) => page + 1);
    return `Page${pages.length > 1 ? 's' : ''} ${pages.join('-')} / ${this.pageCount()}`;
  });

  readonly slots = computed(() => (this.binder()?.pages ?? []).flat().filter((slot): slot is BinderSlot => !!slot));
  readonly totalPrice = computed(() => roundPrice(this.slots().reduce((sum, slot) => sum + slot.price, 0)));
  readonly toBuyPrice = computed(() => roundPrice(this.slots().filter((slot) => !slot.owned).reduce((sum, slot) => sum + slot.price, 0)));

  readonly pickedCard = computed(() => {
    const ref = this.pickedSlot();
    return ref ? (this.binder()?.pages[ref.page]?.[ref.slot] ?? null) : null;
  });

  constructor() {
    const media = window.matchMedia('(width < 48rem)');
    this.single.set(media.matches);
    const onMedia = (event: MediaQueryListEvent) => this.single.set(event.matches);
    media.addEventListener('change', onMedia);
    inject(DestroyRef).onDestroy(() => {
      media.removeEventListener('change', onMedia);
      // les dernières modifications partent avant de quitter la page
      if (this.saveState() == 'pending') this.save();
    });
    this.load(this.route.snapshot.paramMap.get('id') ?? '');
  }

  private async load(id: string) {
    try {
      this.binder.set(await this.api.get<Binder>('/me/binders/' + id, undefined, { silent: true }));
    } catch {
      this.notFound.set(true);
    }
  }

  // ---------- enregistrement ----------

  // toute modification passe par ici : nouvel état affiché tout de suite, enregistré peu après
  private update(change: (binder: Binder) => void) {
    const current = this.binder();
    if (!current) return;
    const next: Binder = { ...current, pages: current.pages.map((page) => page.slice()) };
    change(next);
    this.binder.set(next);
    this.saveState.set('pending');
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.save(), SAVE_DELAY_MS);
  }

  private async save() {
    clearTimeout(this.saveTimer);
    const binder = this.binder();
    if (!binder) return;
    this.saveState.set('saving');
    try {
      await this.api.put('/me/binders/' + binder.id, {
        name: binder.name,
        firstPageAlone: binder.firstPageAlone,
        pages: binder.pages.map((page) => page.map((slot) => (slot ? { imageId: slot.imageId, owned: slot.owned } : null))),
      });
      // une modification arrivée pendant l'envoi sera enregistrée par son propre minuteur
      if (this.saveState() == 'saving') this.saveState.set('saved');
    } catch {
      this.saveState.set('error');
    }
  }

  retrySave() {
    this.save();
  }

  // ---------- classeur ----------

  rename() {
    const name = prompt('Nouveau nom du classeur ?', this.binder()?.name)?.trim();
    if (name) this.update((binder) => (binder.name = name.slice(0, 60)));
  }

  async remove() {
    const binder = this.binder();
    if (!binder || !confirm(`Supprimer le classeur "${binder.name}" ?`)) return;
    clearTimeout(this.saveTimer);
    this.saveState.set('saved');
    await this.api.delete('/me/binders/' + binder.id);
    this.toasts.success('Classeur supprimé');
    this.router.navigateByUrl('/classeurs');
  }

  toggleFirstPageAlone() {
    this.update((binder) => (binder.firstPageAlone = !binder.firstPageAlone));
  }

  // une feuille plastique = 2 pages (recto / verso)
  addSheet() {
    this.update((binder) => binder.pages.push(emptyPage(), emptyPage()));
  }

  removeSheet() {
    const pages = this.binder()?.pages ?? [];
    if (pages.length <= 2) return;
    if (pages.slice(-2).flat().some(Boolean) && !confirm('La dernière feuille contient des cartes, la supprimer quand même ?')) return;
    this.update((binder) => binder.pages.splice(-2, 2));
    this.cursor.update((cursor) => Math.min(cursor, this.pageCount() - 1));
  }

  previous() {
    if (this.canPrevious()) this.cursor.set(Math.min(...this.shownPages()) - 1);
  }

  next() {
    if (this.canNext()) this.cursor.set(Math.max(...this.shownPages()) + 1);
  }

  // ---------- placement des cartes ----------

  private toSlot(item: SearchItem, owned = false): BinderSlot {
    return { imageId: item.imageId, cardId: item.card.id, owned, name: item.card.name, nameFr: item.card.nameFr, price: item.card.price };
  }

  selectItem(item: SearchItem) {
    this.pickedSlot.set(null);
    this.selectedItem.set(this.selectedItem()?.imageId == item.imageId ? null : item);
    // sur téléphone, on referme la recherche pour laisser toucher les cases
    if (this.selectedItem() && this.single()) this.searchOpen.set(false);
  }

  // place la carte dans la première case vide à partir de la page affichée
  autoPlace(item: SearchItem) {
    const pages = this.binder()?.pages ?? [];
    const start = Math.max(Math.min(...this.shownPages()), 0);
    for (let page = start; page < pages.length; page++) {
      const slot = pages[page].indexOf(null);
      if (slot >= 0) {
        this.update((binder) => (binder.pages[page][slot] = this.toSlot(item)));
        this.cursor.set(page);
        return;
      }
    }
    this.toasts.show('Plus de case libre après cette page, ajoute une feuille');
  }

  onSlotClick(page: number, slot: number) {
    const item = this.selectedItem();
    const picked = this.pickedSlot();
    if (item) {
      this.update((binder) => (binder.pages[page][slot] = this.toSlot(item)));
    } else if (picked && this.moving()) {
      this.swap(picked, { page, slot });
      this.pickedSlot.set(null);
      this.moving.set(false);
    } else if (this.binder()?.pages[page][slot]) {
      this.pickedSlot.set(picked?.page == page && picked.slot == slot ? null : { page, slot });
      this.moving.set(false);
    } else {
      this.pickedSlot.set(null);
    }
  }

  isPicked(page: number, slot: number): boolean {
    const picked = this.pickedSlot();
    return !!picked && picked.page == page && picked.slot == slot;
  }

  toggleOwned(page: number, slot: number) {
    this.update((binder) => {
      const current = binder.pages[page][slot];
      if (current) binder.pages[page][slot] = { ...current, owned: !current.owned };
    });
  }

  removeCard(page: number, slot: number) {
    this.update((binder) => (binder.pages[page][slot] = null));
    if (this.isPicked(page, slot)) this.pickedSlot.set(null);
  }

  private swap(from: SlotRef, to: SlotRef) {
    this.update((binder) => {
      const moved = binder.pages[from.page][from.slot];
      binder.pages[from.page][from.slot] = binder.pages[to.page][to.slot];
      binder.pages[to.page][to.slot] = moved;
    });
  }

  clearSelection() {
    this.selectedItem.set(null);
    this.pickedSlot.set(null);
    this.moving.set(false);
  }

  // ---------- glisser-déposer (souris) ----------

  onSearchDragStart(start: SearchDragStart) {
    this.dragSource = { item: start.item };
  }

  onSlotDragStart(event: DragEvent, page: number, slot: number) {
    event.dataTransfer?.setData('text/plain', 'slot');
    this.dragSource = { from: { page, slot } };
  }

  onDragOver(event: DragEvent, key: string) {
    event.preventDefault();
    this.dragOver.set(key);
  }

  onDragEnd() {
    this.dragSource = null;
    this.dragOver.set(null);
  }

  // depuis la recherche on pose une copie, depuis une autre case on échange les deux
  onDrop(event: DragEvent, page: number, slot: number) {
    event.preventDefault();
    const source = this.dragSource;
    this.onDragEnd();
    if (source?.from) this.swap(source.from, { page, slot });
    else if (source?.item) this.update((binder) => (binder.pages[page][slot] = this.toSlot(source.item!)));
  }

  // une case glissée vers la recherche est retirée du classeur
  onDropOnSearch(event: DragEvent) {
    event.preventDefault();
    const source = this.dragSource;
    this.onDragEnd();
    if (source?.from) this.removeCard(source.from.page, source.from.slot);
  }

  // ---------- zoom ----------

  readonly zoomPercent = computed(() => Math.round(this.zoom() * 100));

  // zoome en gardant fixe le point (x, y) de la zone de défilement
  setZoom(zoom: number, x?: number, y?: number) {
    const element = this.scroll()?.nativeElement;
    const newZoom = Math.min(Math.max(zoom, MIN_ZOOM), MAX_ZOOM);
    if (!element) return this.zoom.set(newZoom);
    const ratio = newZoom / this.zoom();
    const originX = x ?? element.clientWidth / 2;
    const originY = y ?? element.clientHeight / 2;
    const left = (element.scrollLeft + originX) * ratio - originX;
    const top = (element.scrollTop + originY) * ratio - originY;
    this.zoom.set(newZoom);
    requestAnimationFrame(() => element.scrollTo(left, top));
  }

  zoomIn() {
    this.setZoom(this.zoom() * ZOOM_STEP);
  }

  zoomOut() {
    this.setZoom(this.zoom() / ZOOM_STEP);
  }

  // Ctrl + molette (ou pincement sur trackpad) zoome le classeur plutôt que la page
  onWheel(event: WheelEvent) {
    if (!event.ctrlKey) return;
    event.preventDefault();
    const element = this.scroll()?.nativeElement;
    if (!element) return;
    const delta = event.deltaMode == 1 ? event.deltaY * 33 : event.deltaY;
    const rect = element.getBoundingClientRect();
    const x = Math.min(Math.max(event.clientX - rect.left, 0), rect.width);
    const y = Math.min(Math.max(event.clientY - rect.top, 0), rect.height);
    this.setZoom(this.zoom() * Math.exp(-Math.max(Math.min(delta, 100), -100) * 0.002), x, y);
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent) {
    if (event.ctrlKey || event.metaKey) {
      // event.code pour le 0, qui donne "à" sur un clavier AZERTY
      const action =
        event.key == '+' || event.key == '=' ? () => this.zoomIn()
        : event.key == '-' ? () => this.zoomOut()
        : event.code == 'Digit0' || event.code == 'Numpad0' ? () => this.setZoom(1)
        : null;
      if (action) {
        event.preventDefault();
        action();
      }
      return;
    }
    if (event.key == 'Escape') {
      if (this.searchOpen()) this.searchOpen.set(false);
      else this.clearSelection();
      return;
    }
    const tag = (event.target as HTMLElement).tagName;
    if (tag == 'INPUT' || tag == 'SELECT') return;
    if (event.key == 'ArrowLeft') this.previous();
    if (event.key == 'ArrowRight') this.next();
  }

  // ---------- export ----------

  // cartes à acheter au format wantlist Cardmarket : "quantité nom anglais"
  async copyWantlist() {
    const counts = new Map<string, number>();
    for (const slot of this.slots()) if (!slot.owned) counts.set(slot.name, (counts.get(slot.name) ?? 0) + 1);
    if (!counts.size) return this.toasts.show('Aucune carte à acheter dans ce classeur');
    const lines = [...counts].map(([name, count]) => `${count} ${name}`);
    const total = [...counts.values()].reduce((sum, count) => sum + count, 0);
    if (await copyText(lines.join('\n'))) this.toasts.success(`${total} cartes copiées (${formatPrice(this.toBuyPrice())})`);
    else this.toasts.error('Copie impossible dans ce navigateur');
  }

  // dessine la double page en pleine résolution et la télécharge en JPEG (toujours en double page, même sur téléphone)
  async screenshot() {
    const binder = this.binder();
    if (!binder) return;
    const pages = this.spread();
    this.screenshotLoading.set(true);
    try {
      const slots = pages.flatMap((page) => (page === null ? [] : binder.pages[page])).filter((slot): slot is BinderSlot => !!slot);
      const images = new Map<number, HTMLImageElement>();
      await Promise.all([...new Set(slots.map((slot) => slot.imageId))].map((id) => loadImage(imgUrl('cards', id)).then((img) => images.set(id, img))));
      const canvas = this.drawSpread(binder, pages, images);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.95));
      if (!blob) throw new Error('Export impossible');
      const numbers = pages.filter((page): page is number => page !== null).map((page) => page + 1);
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${binder.name} - pages ${numbers.join('-')}`.replace(/[\\/:*?"<>|]/g, '-') + '.jpg';
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    } catch (error) {
      console.error(error);
      this.toasts.error("Impossible de générer l'image, réessaie");
    } finally {
      this.screenshotLoading.set(false);
    }
  }

  private drawSpread(binder: Binder, pages: (number | null)[], images: Map<number, HTMLImageElement>): HTMLCanvasElement {
    const pageW = SHOT.pagePad * 2 + SHOT.cardW * 3 + SHOT.gap * 2;
    const pageH = SHOT.pagePad * 2 + SHOT.cardH * 3 + SHOT.gap * 2;
    const canvas = document.createElement('canvas');
    canvas.width = SHOT.margin * 2 + pageW * 2 + SHOT.pageSpacing;
    canvas.height = SHOT.margin + pageH + SHOT.captionH;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#553939';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    pages.forEach((page, side) => {
      const x = SHOT.margin + side * (pageW + SHOT.pageSpacing);
      const y = SHOT.margin;
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
      ctx.shadowBlur = 60;
      ctx.shadowOffsetY = 20;
      ctx.fillStyle = page === null ? '#3a2828' : '#2a1c1c';
      ctx.beginPath();
      ctx.roundRect(x, y, pageW, pageH, 28);
      ctx.fill();
      ctx.restore();
      if (page === null) return;

      binder.pages[page].forEach((slot, index) => {
        const slotX = x + SHOT.pagePad + (index % 3) * (SHOT.cardW + SHOT.gap);
        const slotY = y + SHOT.pagePad + Math.floor(index / 3) * (SHOT.cardH + SHOT.gap);
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(slotX, slotY, SHOT.cardW, SHOT.cardH, 16);
        if (slot) {
          ctx.clip();
          ctx.drawImage(images.get(slot.imageId)!, slotX, slotY, SHOT.cardW, SHOT.cardH);
        } else {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
          ctx.fill();
        }
        ctx.restore();
      });
    });

    const numbers = pages.filter((page): page is number => page !== null).map((page) => page + 1);
    ctx.font = '500 48px Roboto, "Helvetica Neue", sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${binder.name} · Page${numbers.length > 1 ? 's' : ''} ${numbers.join('-')}`, canvas.width - SHOT.margin, canvas.height - SHOT.captionH / 2);
    return canvas;
  }
}
