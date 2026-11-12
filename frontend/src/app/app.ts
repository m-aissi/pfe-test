import { Component, effect, inject, signal, untracked } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Auth } from './core/auth';
import { LegacyData, LegacyImport } from './core/legacy-import';
import { Prefs } from './core/prefs';
import { Toasts } from './core/toast';

interface NavLink {
  path: string;
  label: string;
  icon: string;
  exact: boolean;
}

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
})
export class App {
  readonly auth = inject(Auth);
  readonly prefs = inject(Prefs);
  readonly toasts = inject(Toasts);
  private readonly legacyImport = inject(LegacyImport);

  readonly links: NavLink[] = [
    { path: '/', label: 'Archétypes', icon: 'bi-grid-3x3-gap-fill', exact: true },
    { path: '/classeurs', label: 'Classeurs', icon: 'bi-journal-album', exact: false },
    { path: '/faux', label: 'Chasse aux faux', icon: 'bi-moon-fill', exact: false },
  ];

  // données de l'ancien site trouvées dans ce navigateur, proposées à l'import une fois connecté
  readonly legacy = signal<LegacyData | null>(null);
  readonly importing = signal(false);

  constructor() {
    effect(() => {
      const user = this.auth.user();
      untracked(() => this.legacy.set(user ? this.legacyImport.detect() : null));
    });
  }

  toggleLanguage() {
    this.prefs.setLanguage(this.prefs.language() == 'fr' ? 'en' : 'fr');
  }

  async importLegacy() {
    this.importing.set(true);
    try {
      const summary = await this.legacyImport.importLocal();
      this.legacy.set(null);
      this.toasts.success(`Import terminé : ${summary.binders} classeur(s), ${summary.scytheFound} faux retrouvées`);
      // l'écran affiché peut dépendre de ce qui vient d'être importé : on repart d'un affichage à jour
      setTimeout(() => location.reload(), 1200);
    } catch {
      this.importing.set(false);
    }
  }

  dismissLegacy() {
    this.legacyImport.markDone();
    this.legacy.set(null);
  }
}
