import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Toasts } from './toast';

// ---------- formes des réponses du backend ----------

export interface Card {
  id: number;
  name: string;
  nameFr?: string;
  type: string;
  frameType: string;
  race: string;
  attribute?: string;
  atk?: number;
  def?: number;
  level?: number;
  scale?: number;
  linkval?: number;
  archetype?: string;
  images: number[];
  price: number;
  desc?: string;
  descFr?: string;
}

export interface SearchResult {
  items: Card[];
  total: number;
  page: number;
  hasMore: boolean;
}

export interface Facets {
  types: string[];
  races: string[];
  attributes: string[];
}

export type ArchetypeKind = 'official' | 'custom' | 'scythe';

export interface ArchetypeEntry {
  key: string;
  kind: ArchetypeKind;
  name: string;
  cover: number | null;
  cardCount: number;
  ownedCount: number;
  totalPrice: number;
  remainingPrice: number;
  wantedPrice: number;
  favorite: boolean;
}

export interface ArchetypeList {
  archetypes: ArchetypeEntry[];
  totals: { owned: number; wantedPrice: number };
}

// imageId : illustration à afficher pour la carte dans cet archétype
export type ArchetypeCard = Card & { imageId: number };

export interface ArchetypeDetail {
  key: string;
  kind: ArchetypeKind;
  name: string;
  cards: ArchetypeCard[];
  sources?: string[];
  cardIds?: number[];
}

export interface Wantlist {
  groups: { archetype: string; cards: { id: number; name: string; nameFr?: string; price: number }[] }[];
  cardCount: number;
  totalPrice: number;
}

export interface User {
  id: string;
  username: string;
  hasPassword: boolean;
  google: boolean;
  discord: boolean;
}

export interface BinderSlot {
  imageId: number;
  cardId: number;
  owned: boolean;
  name: string;
  nameFr?: string;
  price: number;
}

export interface Binder {
  id: string;
  name: string;
  firstPageAlone: boolean;
  pages: (BinderSlot | null)[][];
  updatedAt: string;
}

export interface BinderSummary {
  id: string;
  name: string;
  pageCount: number;
  cardCount: number;
  totalPrice: number;
  toBuyPrice: number;
  preview: number[];
  updatedAt: string;
}

export interface QueueItem {
  imageId: number;
  cardId: number;
  name: string;
  nameFr?: string;
  probable: boolean;
}

export interface ScytheQueue {
  total: number;
  seenCount: number;
  foundCount: number;
  items: QueueItem[];
}

export interface ImportSummary {
  owned: number;
  wanted: number;
  favorites: number;
  customArchetypes: number;
  binders: number;
  scytheSeen: number;
  scytheFound: number;
}

// ---------- appels ----------

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export interface RequestOptions {
  // l'appelant affiche lui-même l'erreur (par défaut elle apparaît dans un message en bas de l'écran)
  silent?: boolean;
}

type Params = Record<string, string | number | boolean | undefined | null>;

@Injectable({ providedIn: 'root' })
export class Api {
  private readonly http = inject(HttpClient);
  private readonly toasts = inject(Toasts);

  // appelé quand le backend répond "non connecté" à une route qui demande un compte (session expirée)
  onSessionExpired: (() => void) | null = null;

  get<T>(path: string, params?: Params, options?: RequestOptions): Promise<T> {
    return this.send<T>('GET', path, { params: cleanParams(params) }, options);
  }

  post<T>(path: string, body: unknown = {}, options?: RequestOptions): Promise<T> {
    return this.send<T>('POST', path, { body }, options);
  }

  put<T>(path: string, body: unknown, options?: RequestOptions): Promise<T> {
    return this.send<T>('PUT', path, { body }, options);
  }

  delete<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.send<T>('DELETE', path, {}, options);
  }

  private async send<T>(
    method: string,
    path: string,
    init: { body?: unknown; params?: Record<string, string> },
    options?: RequestOptions,
  ): Promise<T> {
    try {
      return await firstValueFrom(this.http.request<T>(method, '/api' + path, init));
    } catch (error) {
      const status = error instanceof HttpErrorResponse ? error.status : 0;
      const message = errorMessage(error);
      if (status == 401 && path.startsWith('/me')) this.onSessionExpired?.();
      else if (!options?.silent) this.toasts.error(message);
      throw new ApiError(message, status);
    }
  }
}

function cleanParams(params?: Params): Record<string, string> {
  const clean: Record<string, string> = {};
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined && value !== null && value !== '') clean[key] = String(value);
  }
  return clean;
}

function errorMessage(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status == 0) return 'Serveur injoignable, vérifie ta connexion';
    if (error.status == 429) return 'Trop de tentatives, réessaie dans une minute';
    const message = error.error?.message;
    if (Array.isArray(message) && message.length) return String(message[0]);
    if (typeof message == 'string') return message;
  }
  return 'Une erreur est survenue';
}
