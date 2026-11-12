import { Injectable, signal } from '@angular/core';

export type CardLanguage = 'fr' | 'en';

const LANGUAGE_KEY = 'ygotools-lang';

// préférences d'affichage propres à ce navigateur
@Injectable({ providedIn: 'root' })
export class Prefs {
  // langue des noms de cartes ; la recherche, elle, comprend toujours les deux
  readonly language = signal<CardLanguage>(readLanguage());

  setLanguage(language: CardLanguage) {
    this.language.set(language);
    try {
      localStorage.setItem(LANGUAGE_KEY, language);
    } catch {
      // stockage indisponible (navigation privée) : la préférence vaut pour cette visite
    }
  }

  // nom à afficher : français si on l'a et si c'est la langue choisie, sinon anglais
  cardName(card: { name: string; nameFr?: string }): string {
    return this.language() == 'fr' ? (card.nameFr ?? card.name) : card.name;
  }
}

function readLanguage(): CardLanguage {
  try {
    return localStorage.getItem(LANGUAGE_KEY) == 'en' ? 'en' : 'fr';
  } catch {
    return 'fr';
  }
}
