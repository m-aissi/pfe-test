import { Injectable, signal } from '@angular/core';

export type CardLanguage = 'fr' | 'en';

const LANGUAGE_KEY = 'ygotools-lang';
const ARCHETYPE_SORT_KEY = 'kuriboh-archetype-sort';

// ordre des cartes dans un archétype (les voulues restent devant et les possédées à la fin)
export type ArchetypeSort = 'name' | 'new' | 'price' | 'price-desc';
export interface ArchetypeSortPref {
  sort: ArchetypeSort;
}

// préférences d'affichage propres à ce navigateur
@Injectable({ providedIn: 'root' })
export class Prefs {
  // langue des noms de cartes ; la recherche, elle, comprend toujours les deux
  readonly language = signal<CardLanguage>(readLanguage());

  readonly archetypeSort = signal<ArchetypeSortPref>(readJson<ArchetypeSortPref>(ARCHETYPE_SORT_KEY, { sort: 'name' }));

  setArchetypeSort(pref: ArchetypeSortPref) {
    this.archetypeSort.set(pref);
    try {
      localStorage.setItem(ARCHETYPE_SORT_KEY, JSON.stringify(pref));
    } catch {
      // stockage indisponible : vaut pour cette visite
    }
  }

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

function readJson<T extends object>(key: string, fallback: T): T {
  try {
    return { ...fallback, ...JSON.parse(localStorage.getItem(key) ?? '{}') };
  } catch {
    return fallback;
  }
}

function readLanguage(): CardLanguage {
  try {
    return localStorage.getItem(LANGUAGE_KEY) == 'en' ? 'en' : 'fr';
  } catch {
    return 'fr';
  }
}
