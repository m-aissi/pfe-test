import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { CardsIndex, hasCroppedArt } from '../cards/cards.index';
import { CardDto, CardsService } from '../cards/cards.service';
import { roundPrice } from '../cards/normalize';
import { customKey, officialKey, SCYTHE_KEY, SCYTHE_NAME, siteKey } from './collection.schema';
import { CollectionService, EMPTY_COLLECTION, UserCollection } from './collection.service';
import { CustomArchetypesService } from './custom-archetypes.service';
import { ScytheService } from './scythe.service';
import { SiteArchetypesService } from './site-archetypes.service';

// site : archétype regroupé par un admin, commun à tous
export type ArchetypeKind = 'official' | 'site' | 'custom' | 'scythe';

// une tuile de la page d'accueil
export interface ArchetypeEntry {
  key: string;
  kind: ArchetypeKind;
  name: string;
  // illustration de couverture, null si l'archétype est vide
  cover: number | null;
  cardCount: number;
  ownedCount: number;
  totalPrice: number;
  // prix des cartes pas encore possédées
  remainingPrice: number;
  // prix des cartes voulues pas encore possédées
  wantedPrice: number;
  favorite: boolean;
  // cartes arrivées depuis la dernière ouverture de l'archétype
  newCount: number;
}

// carte d'un archétype ; imageId = illustration à afficher (pour "Faux", celle qui a été retenue)
export type ArchetypeCard = CardDto & { imageId: number; isNew?: boolean };

export interface ArchetypeDetail {
  key: string;
  kind: ArchetypeKind;
  name: string;
  cards: ArchetypeCard[];
  // couverture affichée sur l'accueil (choisie par l'utilisateur ou par défaut)
  cover: number | null;
  // définition d'un archétype perso, pour pouvoir le modifier
  sources?: string[];
  cardIds?: number[];
  excludedIds?: number[];
}

const NO_ARCHETYPE = 'Sans archétype';

@Injectable()
export class ArchetypesService {
  constructor(
    private readonly index: CardsIndex,
    private readonly cards: CardsService,
    private readonly collection: CollectionService,
    private readonly customs: CustomArchetypesService,
    private readonly scythe: ScytheService,
    private readonly sites: SiteArchetypesService,
  ) {}

  // tous les archétypes visibles par l'utilisateur (ou les seuls officiels sans compte), favoris en tête
  async list(userId: string | null) {
    const [[collection, customs, found], sites] = await Promise.all([
      userId ? Promise.all([this.collection.load(userId), this.customs.list(userId), this.scythe.found(userId)]) : ([EMPTY_COLLECTION, [], []] as const),
      this.sites.list(),
    ]);

    // un archétype officiel regroupé dans un archétype du site ou perso n'apparaît plus seul
    const merged = new Set([...sites, ...customs].flatMap(group => group.archetypes));
    const archetypes: ArchetypeEntry[] = [];
    for (const archetype of this.index.archetypes) {
      if (merged.has(archetype.name)) continue;
      archetypes.push(this.entry(officialKey(archetype.name), 'official', archetype.name, archetype.cardIds, archetype.cover, collection));
    }
    for (const site of sites) {
      const cardIds = this.customs.expand(site);
      archetypes.push(this.entry(siteKey(String(site._id)), 'site', site.name, cardIds, this.defaultCover(cardIds), collection));
    }
    for (const custom of customs) {
      const cardIds = this.customs.expand(custom);
      archetypes.push(this.entry(customKey(String(custom._id)), 'custom', custom.name, cardIds, this.defaultCover(cardIds), collection));
    }
    if (found.length) {
      archetypes.push(this.entry(SCYTHE_KEY, 'scythe', SCYTHE_NAME, found.map(artwork => artwork.cardId), found[0].imageId, collection));
    }
    archetypes.sort((a, b) => Number(b.favorite) - Number(a.favorite) || a.name.localeCompare(b.name));

    let wantedPrice = 0;
    for (const id of collection.wanted) {
      if (!collection.owned.has(id)) wantedPrice += this.index.cards.get(id)!.price;
    }
    return { archetypes, totals: { owned: collection.owned.size, wantedPrice: roundPrice(wantedPrice) } };
  }

  async detail(key: string, userId: string | null): Promise<ArchetypeDetail> {
    const detail = await this.rawDetail(key, userId);
    if (!userId) return detail;
    const collection = await this.collection.load(userId);
    // les cartes arrivées depuis la dernière visite sont signalées une fois, puis l'archétype est marqué comme vu
    const since = this.newSince(key, collection);
    const cards = detail.cards.map(card => (this.isNew(card.id, since) ? { ...card, isNew: true } : card));
    if (cards.some(card => card.isNew)) await this.collection.markSeen(userId, key);
    return { ...detail, cards, cover: collection.covers.get(key) ?? detail.cover };
  }

  private newSince(key: string, collection: UserCollection): number {
    return collection.seen.get(key) ?? collection.since;
  }

  private isNew(cardId: number, since: number): boolean {
    return (this.index.cards.get(cardId)?.addedAt ?? 0) > since;
  }

  // première carte qui a une illustration recadrée
  private defaultCover(cardIds: number[]): number | null {
    const images = cardIds.map(id => this.index.cards.get(id)!.images[0]);
    return images.find(hasCroppedArt) ?? images[0] ?? null;
  }

  private async rawDetail(key: string, userId: string | null): Promise<ArchetypeDetail> {
    if (key.startsWith('a:')) {
      const archetype = this.index.archetypeByName.get(key.slice(2));
      if (!archetype) throw new NotFoundException('Archétype introuvable');
      const cards = await this.cards.findByArchetype(archetype.name);
      return { key, kind: 'official', name: archetype.name, cover: archetype.cover, cards: cards.map(card => ({ ...card, imageId: card.images[0] })) };
    }

    if (key.startsWith('s:')) {
      const site = await this.sites.require(key.slice(2));
      const cards = await this.cards.findByIds(this.customs.expand(site));
      return {
        key,
        kind: 'site',
        name: site.name,
        cover: this.defaultCover(cards.map(card => card.id)),
        cards: cards.map(card => ({ ...card, imageId: card.images[0] })),
        sources: site.archetypes,
        cardIds: this.index.resolveCardIds(site.cardIds),
        excludedIds: this.index.resolveCardIds(site.excludedIds ?? []),
      };
    }

    if (!userId) throw new UnauthorizedException('Connexion requise');
    if (key == SCYTHE_KEY) {
      const found = await this.scythe.found(userId);
      const byId = await this.cards.mapByIds(found.map(artwork => artwork.cardId));
      return {
        key,
        kind: 'scythe',
        name: SCYTHE_NAME,
        cover: found[0]?.imageId ?? null,
        cards: found.map(artwork => ({ ...byId.get(artwork.cardId)!, imageId: artwork.imageId })),
      };
    }
    if (key.startsWith('c:')) {
      const custom = await this.customs.require(userId, key.slice(2));
      const cards = await this.cards.findByIds(this.customs.expand(custom));
      return {
        key,
        kind: 'custom',
        name: custom.name,
        cover: this.defaultCover(cards.map(card => card.id)),
        cards: cards.map(card => ({ ...card, imageId: card.images[0] })),
        sources: custom.archetypes,
        cardIds: this.index.resolveCardIds(custom.cardIds),
        excludedIds: this.index.resolveCardIds(custom.excludedIds ?? []),
      };
    }
    throw new NotFoundException('Archétype introuvable');
  }

  // cartes voulues pas encore possédées, regroupées par archétype officiel : la liste de courses
  async wantlist(userId: string) {
    const collection = await this.collection.load(userId);
    const ids = this.index.sortByName([...collection.wanted].filter(id => !collection.owned.has(id)));
    const groups = new Map<string, { archetype: string; cards: { id: number; name: string; nameFr?: string; price: number }[] }>();
    let total = 0;
    for (const id of ids) {
      const card = this.index.cards.get(id)!;
      const archetype = card.archetype ?? NO_ARCHETYPE;
      if (!groups.has(archetype)) groups.set(archetype, { archetype, cards: [] });
      groups.get(archetype)!.cards.push({ id, name: card.name, nameFr: card.nameFr, price: card.price });
      total += card.price;
    }
    const sorted = [...groups.values()].sort(
      (a, b) => Number(a.archetype == NO_ARCHETYPE) - Number(b.archetype == NO_ARCHETYPE) || a.archetype.localeCompare(b.archetype),
    );
    return { groups: sorted, cardCount: ids.length, totalPrice: roundPrice(total) };
  }

  private entry(key: string, kind: ArchetypeKind, name: string, cardIds: number[], cover: number | null, collection: UserCollection): ArchetypeEntry {
    let totalPrice = 0;
    let remainingPrice = 0;
    let wantedPrice = 0;
    let ownedCount = 0;
    let newCount = 0;
    const since = this.newSince(key, collection);
    for (const id of cardIds) {
      if (this.isNew(id, since)) newCount++;
      const price = this.index.cards.get(id)!.price;
      totalPrice += price;
      if (collection.owned.has(id)) {
        ownedCount++;
      } else {
        remainingPrice += price;
        if (collection.wanted.has(id)) wantedPrice += price;
      }
    }
    return {
      key,
      kind,
      name,
      cover: collection.covers.get(key) ?? cover,
      cardCount: cardIds.length,
      ownedCount,
      totalPrice: roundPrice(totalPrice),
      remainingPrice: roundPrice(remainingPrice),
      wantedPrice: roundPrice(wantedPrice),
      favorite: collection.favorites.has(key),
      newCount,
    };
  }
}
