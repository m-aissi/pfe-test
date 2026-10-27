import { Component, HostListener } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import axios from 'axios';

export const SCYTHE_STORAGE_KEY = 'scytheReview';
export const SCYTHE_ARCHETYPE_NAME = 'Faux';

const PAGE_SIZE = 24;
const PRIORITY_KEYWORDS = ['scythe', 'reaper', 'faucheur', 'faux', 'death', 'grim', 'harvest', 'sickle', 'kama'];

// une entrée = un artwork (les cartes à plusieurs illustrations ont plusieurs entrées)
export interface ScytheCard {
  imageId: number;
  cardId: number;
  cardName: string;
  cardImg: string;
  cardImgSmall: string;
  cardCropped: string;
  cardPrice: number;
}

interface ReviewItem extends ScytheCard {
  order: number;
  isProbable: boolean;
}

export interface ScytheState {
  seen: number[];
  found: ScytheCard[];
}

export function loadScytheState(): ScytheState {
  try {
    const raw = localStorage.getItem(SCYTHE_STORAGE_KEY);
    if (raw) {
      const state = JSON.parse(raw);
      return { seen: state.seen ?? [], found: state.found ?? [] };
    }
  } catch (e) {
    console.error(e);
  }
  return { seen: [], found: [] };
}

export function saveScytheState(state: ScytheState) {
  localStorage.setItem(SCYTHE_STORAGE_KEY, JSON.stringify(state));
}

@Component({
  selector: 'app-scythe-review',
  templateUrl: './scythe-review.component.html',
  styleUrls: ['./scythe-review.component.css']
})
export class ScytheReviewComponent {

  loading : boolean = true;
  state : ScytheState = loadScytheState();
  totalCount : number = 0;

  queue : ReviewItem[] = [];
  page : ReviewItem[] = [];
  selected = new Set<number>();
  history : { items: ReviewItem[], foundIds: number[] }[] = [];

  prioritize : boolean = false;
  zoomed : ReviewItem | null = null;

  constructor(public dialogRef: MatDialogRef<ScytheReviewComponent>) { }

  ngOnInit() {
    axios.get('https://db.ygoprodeck.com/api/v7/cardinfo.php').then(res => {
      const seen = new Set(this.state.seen);
      const all : ReviewItem[] = [];

      for (const card of res.data.data) {
        const text = (card.name + ' ' + card.desc).toLowerCase();
        const isProbable = PRIORITY_KEYWORDS.some(k => text.includes(k));
        for (const img of card.card_images) {
          all.push({
            imageId: img.id,
            cardId: card.id,
            cardName: card.name,
            cardImg: img.image_url,
            cardImgSmall: img.image_url_small,
            cardCropped: img.image_url_cropped,
            cardPrice: card.card_prices[0].cardmarket_price,
            order: all.length,
            isProbable: isProbable
          });
        }
      }

      this.totalCount = all.length;
      this.queue = all.filter(item => !seen.has(item.imageId));
      this.loading = false;
      this.loadPage();
    });
  }

  get seenCount() {
    return this.totalCount - this.queue.length;
  }

  get progress() {
    return this.totalCount == 0 ? 0 : this.seenCount / this.totalCount * 100;
  }

  loadPage() {
    this.page = this.queue.slice(0, PAGE_SIZE);
    // précharge la page suivante pour ne pas attendre les images
    for (const item of this.queue.slice(PAGE_SIZE, PAGE_SIZE * 2)) {
      new Image().src = item.cardCropped;
    }
  }

  toggle(item : ReviewItem) {
    if (this.selected.has(item.imageId)) this.selected.delete(item.imageId);
    else this.selected.add(item.imageId);
  }

  zoom(item : ReviewItem, event : MouseEvent) {
    event.preventDefault();
    this.zoomed = item;
  }

  validatePage() {
    if (this.page.length == 0) return;

    const foundIds = this.page.filter(item => this.selected.has(item.imageId)).map(item => item.imageId);
    for (const item of this.page) {
      this.state.seen.push(item.imageId);
      if (this.selected.has(item.imageId)) {
        const { order, isProbable, ...card } = item;
        this.state.found.push(card);
      }
    }
    saveScytheState(this.state);

    this.history.push({ items: this.page, foundIds: foundIds });
    this.queue = this.queue.slice(this.page.length);
    this.selected.clear();
    this.loadPage();
  }

  undo() {
    const last = this.history.pop();
    if (!last) return;

    const ids = new Set(last.items.map(item => item.imageId));
    this.state.seen = this.state.seen.filter(id => !ids.has(id));
    this.state.found = this.state.found.filter(card => !ids.has(card.imageId));
    saveScytheState(this.state);

    this.queue = [...last.items, ...this.queue];
    this.selected = new Set(last.foundIds);
    this.loadPage();
  }

  togglePriority() {
    this.prioritize = !this.prioritize;
    // seule la page courante garde sa place, le reste est retrié
    const rest = this.queue.slice(this.page.length);
    rest.sort((a, b) => this.prioritize && a.isProbable != b.isProbable ? (a.isProbable ? -1 : 1) : a.order - b.order);
    this.queue = [...this.page, ...rest];
    this.loadPage();
  }

  closeDialog() {
    this.dialogRef.close();
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(event : KeyboardEvent) {
    if (this.zoomed) {
      this.zoomed = null;
      event.preventDefault();
      return;
    }
    if (event.key == 'Enter') {
      event.preventDefault();
      this.validatePage();
    } else if (event.key == 'Backspace') {
      event.preventDefault();
      this.undo();
    }
  }
}
