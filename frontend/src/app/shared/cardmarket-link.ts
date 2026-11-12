import { Component, input } from '@angular/core';
import { cardmarketUrl, formatPrice } from '../core/util';

// prix Cardmarket d'une carte, cliquable : ouvre la recherche de la carte sur Cardmarket
@Component({
  selector: 'app-cardmarket-link',
  template: `
    <a [href]="cardmarketUrl(card())" target="_blank" rel="noopener" title="Voir sur Cardmarket"
      class="group flex items-center gap-2.5 rounded-lg bg-white/5 px-3 py-2 text-sm ring-1 ring-white/10 transition hover:bg-white/10 hover:ring-white/20">
      <span class="grid size-7 shrink-0 place-items-center rounded-md bg-[#0d4c8e] text-white"><i class="bi bi-cart3"></i></span>
      <span class="flex-1 text-white/70 group-hover:text-white">Cardmarket</span>
      <span class="font-semibold">{{ formatPrice(card().price) }}</span>
      <i class="bi bi-chevron-right text-xs text-white/40 transition group-hover:translate-x-0.5 group-hover:text-white/80"></i>
    </a>
  `,
})
export class CardmarketLink {
  readonly card = input.required<{ name: string; price: number }>();
  readonly cardmarketUrl = cardmarketUrl;
  readonly formatPrice = formatPrice;
}
