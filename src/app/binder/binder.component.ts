import { Component, ElementRef, HostListener, ViewChild } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import axios from 'axios';

export interface BinderCard {
  cardId: number;
  cardName: string;
  cardNameEn: string;
  cardImg: string;
  cardImgSmall: string;
  cardPrice: number;
  isOwned: boolean;
}

export interface Binder {
  name: string;
  firstPageAlone: boolean;
  pages: (BinderCard | null)[][];
}

// carte en cours de drag : depuis la recherche (page/slot undefined) ou depuis une case du classeur
interface DragSource {
  card: BinderCard;
  page?: number;
  slot?: number;
}

const API_URL = 'https://db.ygoprodeck.com/api/v7/cardinfo.php';
const STORAGE_KEY = 'ygotools-binders';
const SLOTS_PER_PAGE = 9;
const DEFAULT_PAGES = 20;
const SEARCH_PAGE_SIZE = 30;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 6;
const ZOOM_STEP = 1.25;

// ygoprodeck n'envoie pas de header CORS : pour dessiner les cartes dans un canvas exportable,
// les images doivent venir de notre domaine (proxy Caddy en prod, proxy.conf.json avec ng serve)
const YGOPRODECK_IMAGES = 'https://images.ygoprodeck.com/images/';
const IMAGE_PROXY = '/ygo-img/';

// mise en page du screen en pixels, calée sur la résolution native des images ygoprodeck (813x1185)
const SHOT = { cardW: 813, cardH: 1185, gap: 36, pagePad: 56, pageSpacing: 90, margin: 90, captionH: 120 };

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
  templateUrl: './binder.component.html',
  styleUrls: ['./binder.component.css']
})
export class BinderComponent {

  binders: Binder[] = [];
  binderIndex = 0;
  spreadIndex = 0;

  searchValue = '';
  searchLanguage = 'fr';
  searchResults: BinderCard[] = [];
  searchNextOffset: number | null = null;
  searchLoading = false;
  searchError = '';
  private searchTimeout: any;
  private searchRequestId = 0;

  selectedCard: BinderCard | null = null;
  dragOverSlot: string | null = null;
  private dragSource: DragSource | null = null;

  zoom = 1;
  screenshotLoading = false;
  @ViewChild('spreadScroll') spreadScroll!: ElementRef<HTMLElement>;

  constructor(public dialogRef: MatDialogRef<BinderComponent>) {
    this.load();
    this.dialogRef.backdropClick().subscribe(() => this.dialogRef.close());
  }

  get binder(): Binder {
    return this.binders[this.binderIndex];
  }

  // avec "1re page seule", la page 1 est à droite (face à l'intérieur de la couverture)
  private get pageOffset(): number {
    return this.binder.firstPageAlone ? 1 : 0;
  }

  get spreadCount(): number {
    return Math.ceil((this.binder.pages.length + this.pageOffset) / 2);
  }

  get leftPage(): number | null {
    const p = this.spreadIndex * 2 - this.pageOffset;
    return p >= 0 && p < this.binder.pages.length ? p : null;
  }

  get rightPage(): number | null {
    const p = this.spreadIndex * 2 - this.pageOffset + 1;
    return p < this.binder.pages.length ? p : null;
  }

  // numéros (à partir de 1) des pages affichées
  get spreadPageNumbers(): number[] {
    return [this.leftPage, this.rightPage].filter(p => p !== null).map(p => p! + 1);
  }

  get spreadLabel(): string {
    const pages = this.spreadPageNumbers;
    return 'Page' + (pages.length > 1 ? 's ' : ' ') + pages.join('-') + ' / ' + this.binder.pages.length;
  }

  get allCards(): BinderCard[] {
    return this.binder.pages.flat().filter((card): card is BinderCard => card !== null);
  }

  get totalPrice(): number {
    return this.sumPrices(this.allCards);
  }

  get toBuyPrice(): number {
    return this.sumPrices(this.allCards.filter(card => !card.isOwned));
  }

  private sumPrices(cards: BinderCard[]): number {
    return Math.round(cards.reduce((total, card) => total + card.cardPrice, 0) * 100) / 100;
  }

  // ---------- Persistance ----------

  load() {
    try {
      this.binders = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch {
      this.binders = [];
    }
    if (this.binders.length == 0) this.binders.push(this.newBinder('Mon classeur'));
  }

  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.binders));
    } catch {
      alert("Impossible de sauvegarder le classeur dans le navigateur, pense à l'exporter");
    }
  }

  newBinder(name: string): Binder {
    return { name: name, firstPageAlone: true, pages: Array.from({ length: DEFAULT_PAGES }, () => this.emptyPage()) };
  }

  emptyPage(): (BinderCard | null)[] {
    return new Array(SLOTS_PER_PAGE).fill(null);
  }

  // ---------- Gestion des classeurs ----------

  selectBinder(index: number) {
    this.binderIndex = index;
    this.spreadIndex = 0;
  }

  createBinder() {
    const name = prompt('Nom du nouveau classeur ?');
    if (!name) return;
    this.binders.push(this.newBinder(name));
    this.selectBinder(this.binders.length - 1);
    this.save();
  }

  renameBinder() {
    const name = prompt('Nouveau nom du classeur ?', this.binder.name);
    if (!name) return;
    this.binder.name = name;
    this.save();
  }

  deleteBinder() {
    if (!confirm('Supprimer le classeur "' + this.binder.name + '" ?')) return;
    this.binders.splice(this.binderIndex, 1);
    if (this.binders.length == 0) this.binders.push(this.newBinder('Mon classeur'));
    this.selectBinder(0);
    this.save();
  }

  toggleFirstPageAlone() {
    this.binder.firstPageAlone = !this.binder.firstPageAlone;
    this.spreadIndex = Math.min(this.spreadIndex, this.spreadCount - 1);
    this.save();
  }

  // une feuille plastique = 2 pages (recto/verso)
  addSheet() {
    this.binder.pages.push(this.emptyPage(), this.emptyPage());
    this.save();
  }

  removeSheet() {
    if (this.binder.pages.length <= 2) return;
    const lastPages = this.binder.pages.slice(-2);
    if (lastPages.flat().some(card => card !== null) && !confirm('La dernière feuille contient des cartes, la supprimer quand même ?')) return;
    this.binder.pages.splice(-2, 2);
    this.spreadIndex = Math.min(this.spreadIndex, this.spreadCount - 1);
    this.save();
  }

  previousSpread() {
    if (this.spreadIndex > 0) this.spreadIndex--;
  }

  nextSpread() {
    if (this.spreadIndex < this.spreadCount - 1) this.spreadIndex++;
  }

  goToPage(page: number) {
    this.spreadIndex = Math.floor((page + this.pageOffset) / 2);
  }

  // ---------- Recherche ----------

  onSearchInput() {
    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => this.search(0), 350);
  }

  search(offset: number) {
    const query = this.searchValue.trim();
    const requestId = ++this.searchRequestId;
    this.searchError = '';
    if (query.length < 2) {
      this.searchResults = [];
      this.searchNextOffset = null;
      this.searchLoading = false;
      return;
    }

    const params: any = { fname: query, num: SEARCH_PAGE_SIZE, offset: offset };
    if (this.searchLanguage) params.language = this.searchLanguage;
    this.searchLoading = true;

    axios.get(API_URL, { params: params }).then(res => {
      if (requestId != this.searchRequestId) return;
      // une entrée par artwork, pour pouvoir choisir l'illustration qu'on veut voir dans le classeur
      const cards: BinderCard[] = [];
      for (const card of res.data.data) {
        for (const image of card.card_images) {
          cards.push({
            cardId: image.id,
            cardName: card.name,
            cardNameEn: card.name_en || card.name,
            cardImg: image.image_url,
            cardImgSmall: image.image_url_small,
            cardPrice: parseFloat(card.card_prices?.[0]?.cardmarket_price) || 0,
            isOwned: false
          });
        }
      }
      this.searchResults = offset == 0 ? cards : this.searchResults.concat(cards);
      this.searchNextOffset = res.data.meta?.next_page_offset ?? null;
    }).catch(() => {
      if (requestId != this.searchRequestId) return;
      if (offset == 0) this.searchResults = [];
      this.searchNextOffset = null;
      this.searchError = 'Aucune carte trouvée';
    }).finally(() => {
      if (requestId == this.searchRequestId) this.searchLoading = false;
    });
  }

  selectCard(card: BinderCard) {
    this.selectedCard = this.selectedCard === card ? null : card;
  }

  // place la carte dans la première case vide à partir de la double page affichée
  autoPlace(card: BinderCard) {
    const pages = this.binder.pages;
    const start = Math.max(this.spreadIndex * 2 - this.pageOffset, 0);
    for (let p = start; p < pages.length; p++) {
      const slot = pages[p].indexOf(null);
      if (slot >= 0) {
        pages[p][slot] = { ...card };
        this.goToPage(p);
        this.save();
        return;
      }
    }
    alert('Plus de case libre après cette page, ajoute une feuille');
  }

  // ---------- Cases du classeur ----------

  onSlotClick(page: number, slot: number) {
    if (!this.selectedCard) return;
    this.binder.pages[page][slot] = { ...this.selectedCard };
    this.save();
  }

  removeCard(page: number, slot: number) {
    this.binder.pages[page][slot] = null;
    this.save();
  }

  toggleOwned(card: BinderCard) {
    card.isOwned = !card.isOwned;
    this.save();
  }

  onDragStart(event: DragEvent, card: BinderCard, page?: number, slot?: number) {
    this.dragSource = { card: card, page: page, slot: slot };
    // Firefox ne démarre pas le drag sans données
    event.dataTransfer?.setData('text/plain', card.cardName);
  }

  onDragOver(event: DragEvent, key: string) {
    event.preventDefault();
    this.dragOverSlot = key;
  }

  onDragEnd() {
    this.dragSource = null;
    this.dragOverSlot = null;
  }

  // drop sur une case : depuis la recherche on pose une copie, depuis une autre case on échange les deux
  onDrop(event: DragEvent, page: number, slot: number) {
    event.preventDefault();
    const source = this.dragSource;
    this.onDragEnd();
    if (!source) return;
    const pages = this.binder.pages;
    if (source.page !== undefined && source.slot !== undefined) {
      pages[source.page][source.slot] = pages[page][slot];
      pages[page][slot] = source.card;
    } else {
      pages[page][slot] = { ...source.card };
    }
    this.save();
  }

  // drop d'une carte du classeur vers la zone de recherche = on la retire
  onDropOnSearch(event: DragEvent) {
    event.preventDefault();
    const source = this.dragSource;
    this.onDragEnd();
    if (source && source.page !== undefined && source.slot !== undefined) this.removeCard(source.page, source.slot);
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent) {
    const target = event.target as HTMLElement;
    // Ctrl +/-/0 zooment le classeur au lieu de la page (event.code pour le 0, qui donne "à" en AZERTY)
    if (event.ctrlKey || event.metaKey) {
      const zoomAction = event.key == '+' || event.key == '=' ? () => this.zoomIn()
        : event.key == '-' ? () => this.zoomOut()
        : event.code == 'Digit0' || event.code == 'Numpad0' ? () => this.setZoom(1)
        : null;
      if (zoomAction) {
        event.preventDefault();
        zoomAction();
        return;
      }
    }
    if (event.key == 'Escape') {
      if (this.selectedCard) this.selectedCard = null;
      else this.dialogRef.close();
      return;
    }
    if (target.tagName == 'INPUT' || target.tagName == 'SELECT') return;
    if (event.key == 'ArrowLeft') this.previousSpread();
    if (event.key == 'ArrowRight') this.nextSpread();
  }

  // ---------- Zoom ----------

  get zoomPercent(): number {
    return Math.round(this.zoom * 100);
  }

  // zoome en gardant fixe le point (x, y) de la zone de scroll : le curseur pour la molette, le centre pour les boutons
  setZoom(zoom: number, x?: number, y?: number) {
    const el = this.spreadScroll.nativeElement;
    const newZoom = Math.min(Math.max(zoom, MIN_ZOOM), MAX_ZOOM);
    const ratio = newZoom / this.zoom;
    const originX = x ?? el.clientWidth / 2;
    const originY = y ?? el.clientHeight / 2;
    const scrollLeft = (el.scrollLeft + originX) * ratio - originX;
    const scrollTop = (el.scrollTop + originY) * ratio - originY;
    this.zoom = newZoom;
    // le scroll doit être appliqué une fois le DOM agrandi
    requestAnimationFrame(() => el.scrollTo(scrollLeft, scrollTop));
  }

  zoomIn() {
    this.setZoom(this.zoom * ZOOM_STEP);
  }

  zoomOut() {
    this.setZoom(this.zoom / ZOOM_STEP);
  }

  // Ctrl + molette (ou pincement sur trackpad) n'importe où dans le dialog : zoome le classeur plutôt que toute la page,
  // autour du curseur s'il est sur le classeur, sinon autour du point le plus proche
  onWheel(event: WheelEvent) {
    if (!event.ctrlKey) return;
    event.preventDefault();
    const delta = event.deltaMode == 1 ? event.deltaY * 33 : event.deltaY; // Firefox compte en lignes
    const rect = this.spreadScroll.nativeElement.getBoundingClientRect();
    const x = Math.min(Math.max(event.clientX - rect.left, 0), rect.width);
    const y = Math.min(Math.max(event.clientY - rect.top, 0), rect.height);
    this.setZoom(this.zoom * Math.exp(-Math.max(Math.min(delta, 100), -100) * 0.002), x, y);
  }

  // ---------- Screen ----------

  // dessine la double page affichée en pleine résolution et la télécharge en JPEG
  async screenshotSpread() {
    const pages = [this.leftPage, this.rightPage];
    const cards = pages.flatMap(p => p === null ? [] : this.binder.pages[p]).filter((card): card is BinderCard => card !== null);
    this.screenshotLoading = true;
    try {
      const images = new Map<string, HTMLImageElement>();
      const urls = [...new Set(cards.map(card => card.cardImg))];
      await Promise.all(urls.map(url => loadImage(url.replace(YGOPRODECK_IMAGES, IMAGE_PROXY)).then(img => images.set(url, img))));

      const canvas = this.drawSpread(pages, images);
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.95));
      if (!blob) throw new Error('Export du canvas impossible');

      const element = document.createElement('a');
      element.href = URL.createObjectURL(blob);
      element.download = (this.binder.name + ' - pages ' + this.spreadPageNumbers.join('-')).replace(/[\\/:*?"<>|]/g, '-') + '.jpg';
      element.click();
      setTimeout(() => URL.revokeObjectURL(element.href), 1000);
    } catch (error) {
      console.error(error);
      alert("Impossible de générer le screen : les images doivent passer par le proxy " + IMAGE_PROXY + " (config Caddy)");
    } finally {
      this.screenshotLoading = false;
    }
  }

  private drawSpread(pages: (number | null)[], images: Map<string, HTMLImageElement>): HTMLCanvasElement {
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

      // fond de la page (ou de la couverture) avec son ombre, comme dans l'appli
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

      this.binder.pages[page].forEach((card, slot) => {
        const slotX = x + SHOT.pagePad + (slot % 3) * (SHOT.cardW + SHOT.gap);
        const slotY = y + SHOT.pagePad + Math.floor(slot / 3) * (SHOT.cardH + SHOT.gap);
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(slotX, slotY, SHOT.cardW, SHOT.cardH, 16);
        if (card) {
          ctx.clip();
          ctx.drawImage(images.get(card.cardImg)!, slotX, slotY, SHOT.cardW, SHOT.cardH);
        } else {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
          ctx.fill();
        }
        ctx.restore();
      });
    });

    ctx.font = '500 48px Roboto, "Helvetica Neue", sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.binder.name + ' · ' + this.spreadLabel.replace(/ \/ \d+$/, ''), canvas.width - SHOT.margin, canvas.height - SHOT.captionH / 2);
    return canvas;
  }

  // ---------- Export ----------

  // liste "quantité nom" des cartes non possédées, format accepté par la wantlist Cardmarket
  copyWantList() {
    const counts = new Map<string, number>();
    for (const card of this.allCards) {
      if (!card.isOwned) counts.set(card.cardNameEn, (counts.get(card.cardNameEn) || 0) + 1);
    }
    if (counts.size == 0) {
      alert('Aucune carte à acheter dans ce classeur');
      return;
    }
    let text = '';
    let total = 0;
    counts.forEach((count, name) => {
      text += count + ' ' + name + '\n';
      total += count;
    });
    navigator.clipboard.writeText(text);
    alert(total + ' cartes (' + counts.size + ' différentes) copiées dans le presse-papier, ' + this.toBuyPrice + ' €');
  }

  exportBinders() {
    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(JSON.stringify(this.binders)));
    element.setAttribute('download', 'YGOToolsBinders.json');
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  }

  importBinders() {
    const element = document.createElement('input');
    element.setAttribute('type', 'file');
    element.setAttribute('accept', '.json');
    element.onchange = (event: any) => {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        try {
          const imported: Binder[] = JSON.parse(e.target.result);
          if (!Array.isArray(imported) || imported.length == 0 || imported.some(b => !Array.isArray(b.pages))) throw new Error();
          if (!confirm('Remplacer tes ' + this.binders.length + ' classeur(s) par les ' + imported.length + ' du fichier ?')) return;
          this.binders = imported;
          this.selectBinder(0);
          this.save();
        } catch {
          alert("Ce fichier n'est pas un export de classeurs YGO Tools");
        }
      };
      reader.readAsText(event.target.files[0]);
    };
    element.click();
  }
}
