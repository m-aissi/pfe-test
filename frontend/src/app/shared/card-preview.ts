import { Component, computed, inject, input, output } from '@angular/core';
import { Card } from '../core/api';
import { Prefs } from '../core/prefs';
import { CardmarketLink } from './cardmarket-link';
import { formatPrice, imgUrl, typeLine } from '../core/util';

// grande image d'une carte avec ses caractéristiques et son texte (panneau central de l'éditeur d'archétype)
@Component({
  selector: 'app-card-preview',
  imports: [CardmarketLink],
  template: `
    @if (card(); as c) {
      <div class="flex h-full min-h-0 flex-col gap-3 overflow-y-auto">
        <button type="button" class="cursor-zoom-in" (click)="zoom.emit()" title="Voir en grand">
          <img [src]="imgUrl('cards', imageId() ?? c.images[0])" [alt]="prefs.cardName(c)" class="card-ratio mx-auto w-full max-w-80 rounded-md bg-black/30 transition hover:brightness-110">
        </button>
        <div>
          <h2 class="text-lg font-medium">{{ prefs.cardName(c) }}</h2>
          @if (prefs.language() == 'fr' && c.nameFr) {
            <p class="text-sm text-white/55">{{ c.name }}</p>
          }
          <p class="mt-1 text-sm text-white/85">
            [{{ typeLine(c) }}]
            @if (c.attribute) { · {{ c.attribute }} }
            @if (c.level) { · <i class="bi bi-star-fill text-amber-400"></i> {{ c.level }} }
            @if (c.linkval) { · Link {{ c.linkval }} }
            @if (c.scale !== undefined) { · <i class="bi bi-suit-diamond-fill"></i> {{ c.scale }} }
          </p>
          @if (c.atk !== undefined) {
            <p class="text-sm">ATK {{ c.atk }}@if (c.def !== undefined) { / DEF {{ c.def }}}</p>
          }
        </div>
        <app-cardmarket-link [card]="c" />
        @if (description(); as text) {
          <p class="text-sm leading-relaxed whitespace-pre-line text-white/85">{{ text }}</p>
        }
      </div>
    } @else {
      <p class="p-6 text-center text-sm text-white/55">Passe la souris sur une carte pour la voir en grand</p>
    }
  `,
})
export class CardPreview {
  readonly prefs = inject(Prefs);
  readonly imgUrl = imgUrl;
  readonly formatPrice = formatPrice;
  readonly typeLine = typeLine;

  readonly card = input<Card | null>(null);
  // illustration à montrer (par défaut la première)
  readonly imageId = input<number | null>(null);
  // clic sur l'image : l'afficher en plein écran
  readonly zoom = output<void>();

  readonly description = computed(() => {
    const card = this.card();
    if (!card) return null;
    return this.prefs.language() == 'fr' ? (card.descFr ?? card.desc) : card.desc;
  });
}
