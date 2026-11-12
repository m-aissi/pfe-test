import { Component, computed, HostListener, inject, input, output } from '@angular/core';
import { Card } from '../core/api';
import { Prefs } from '../core/prefs';
import { CardmarketLink } from './cardmarket-link';
import { imgUrl } from '../core/util';

// couleur du bandeau de titre selon le cadre de la carte (une carte Pendule prend la couleur de son type de base)
const FRAME_COLORS: Record<string, string> = {
  normal: '#b8913f',
  effect: '#c0652a',
  ritual: '#3d6cc0',
  fusion: '#7b48a8',
  synchro: '#8d8d8d',
  xyz: '#2d2d2d',
  link: '#1d5ea8',
  token: '#6f6f6f',
  skill: '#2c7fb0',
  spell: '#16897a',
  trap: '#a5367a',
};

// carte en grand par-dessus la page, fond flouté, fiche d'infos à côté (à la façon de YGOmega).
// Le contenu projeté (<ng-content>) s'affiche sous la fiche : boutons d'action propres à chaque écran.
@Component({
  selector: 'app-card-zoom',
  imports: [CardmarketLink],
  template: `
    <div class="fixed inset-0 z-[60] flex cursor-zoom-out overflow-y-auto bg-black/55 backdrop-blur-md" (click)="close.emit()">
      <div class="m-auto flex w-full max-w-6xl cursor-default flex-col items-center gap-4 p-4 pt-14 md:flex-row md:items-start md:justify-center md:gap-8 md:p-8"
        (click)="$event.stopPropagation()">
        <button type="button" class="btn btn-dark fixed top-3 right-3 z-10" (click)="close.emit()" title="Fermer (Échap)"><i class="bi bi-x-lg"></i></button>

        <img [src]="imgUrl('cards', imageId() ?? card().images[0])" [alt]="prefs.cardName(card())"
          class="card-ratio h-[48dvh] w-auto max-w-full shrink-0 rounded-xl shadow-[0_20px_60px_rgb(0_0_0/0.7)] md:h-[min(80dvh,46rem)]">

        <div class="w-full max-w-md overflow-hidden rounded-xl bg-sunken/90 shadow-2xl ring-1 ring-white/10 md:mt-6">
          <div class="flex items-center gap-3 px-4 py-3" [style.background]="'linear-gradient(110deg, ' + frameColor() + ' 0%, ' + frameColor() + 'cc 60%, transparent 140%)'">
            <h2 class="min-w-0 flex-1 text-xl leading-tight font-semibold drop-shadow">{{ prefs.cardName(card()) }}</h2>
            @if (card().attribute) {
              <span class="shrink-0 rounded-full bg-black/35 px-2.5 py-0.5 text-xs font-semibold tracking-wide">{{ card().attribute }}</span>
            }
          </div>

          <div class="flex flex-col gap-3 p-4">
            @if (prefs.language() == 'fr' && card().nameFr) {
              <p class="-mt-1 text-sm text-white/55">{{ card().name }}</p>
            }
            <div class="flex flex-wrap items-center gap-2 text-sm">
              <span class="font-medium">[ {{ typeLine() }} ]</span>
              @for (stat of stats(); track stat.label) {
                <span class="rounded-md bg-white/10 px-2 py-0.5"><span class="text-white/60">{{ stat.label }}</span> {{ stat.value }}</span>
              }
            </div>
            <app-cardmarket-link [card]="card()" />
            <!-- actions avant le texte : visibles sans défiler sur téléphone -->
            <ng-content />
            @if (text(); as t) {
              <p class="border-t border-white/10 pt-3 text-[0.95rem] leading-relaxed whitespace-pre-line text-white/90">{{ t }}</p>
            }
          </div>
        </div>
      </div>
    </div>
  `,
})
export class CardZoom {
  readonly prefs = inject(Prefs);
  readonly imgUrl = imgUrl;

  readonly card = input.required<Card>();
  readonly imageId = input<number | null>(null);
  // texte de la carte quand l'objet carte ne le contient pas (chargé à part)
  readonly description = input<string | null>(null);
  readonly close = output<void>();
  // flèches gauche / droite du clavier, pour passer à la carte voisine
  readonly step = output<number>();

  readonly frameColor = computed(() => FRAME_COLORS[this.card().frameType?.split('_')[0]] ?? FRAME_COLORS['effect']);

  readonly typeLine = computed(() => {
    const card = this.card();
    return [card.race, card.type.replace(/ (Card|Monster)$/, '')].filter(Boolean).join(' / ');
  });

  readonly stats = computed(() => {
    const card = this.card();
    const stats: { label: string; value: string | number }[] = [];
    if (card.level) stats.push({ label: card.frameType?.startsWith('xyz') ? 'Rang' : 'Niv.', value: card.level });
    if (card.linkval) stats.push({ label: 'Link', value: card.linkval });
    if (card.scale !== undefined) stats.push({ label: 'Échelle', value: card.scale });
    if (card.atk !== undefined) stats.push({ label: 'ATK', value: card.atk });
    if (card.def !== undefined) stats.push({ label: 'DEF', value: card.def });
    return stats;
  });

  readonly text = computed(() => {
    const card = this.card();
    const own = this.prefs.language() == 'fr' ? (card.descFr ?? card.desc) : card.desc;
    return own ?? this.description();
  });

  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent) {
    if (event.key == 'Escape') {
      event.stopImmediatePropagation();
      this.close.emit();
    } else if (event.key == 'ArrowLeft' || event.key == 'ArrowRight') {
      event.stopImmediatePropagation();
      this.step.emit(event.key == 'ArrowRight' ? 1 : -1);
    }
  }
}
