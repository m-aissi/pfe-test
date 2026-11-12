import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Card } from './card.schema';
import { roundPrice } from './normalize';

export interface IndexedCard {
  id: number;
  name: string;
  nameFr?: string;
  archetype?: string;
  price: number;
  images: number[];
  // position de la carte dans l'ordre alphabétique, pour trier une liste d'identifiants sans relire les noms
  rank: number;
  // le nom ou le texte de la carte évoque une faux (ordre "probables" de la chasse aux faux)
  probable: boolean;
}

export interface ArchetypeSummary {
  name: string;
  // cartes de l'archétype, triées par nom
  cardIds: number[];
  totalPrice: number;
  // illustration de la première carte, utilisée comme vignette
  cover: number;
}

export interface Artwork {
  imageId: number;
  cardId: number;
}

// ygoprodeck n'a pas d'illustration recadrée pour les cartes en avant-première (identifiants à 9 chiffres)
export const hasCroppedArt = (imageId: number) => imageId < 100_000_000;

const SCYTHE_KEYWORDS = ['scythe', 'reaper', 'faucheur', 'faux', 'death', 'grim', 'harvest', 'sickle', 'kama'];

// vue allégée de toutes les cartes gardée en mémoire : évite un aller-retour Mongo pour les calculs faits à chaque requête
// (stats par archétype, file de la chasse aux faux, validation des identifiants). Reconstruite au démarrage et après chaque synchro.
@Injectable()
export class CardsIndex {
  private readonly logger = new Logger(CardsIndex.name);

  cards = new Map<number, IndexedCard>();
  // toutes les illustrations, dans un ordre stable : nom de la carte puis ordre des illustrations
  artworks: Artwork[] = [];
  artworkToCard = new Map<number, number>();
  archetypes: ArchetypeSummary[] = [];
  archetypeByName = new Map<string, ArchetypeSummary>();
  facets: { types: string[]; races: string[]; attributes: string[] } = { types: [], races: [], attributes: [] };

  constructor(@InjectModel(Card.name) private readonly cardModel: Model<Card>) {}

  async rebuild() {
    const docs = await this.cardModel
      .find({}, { name: 1, nameFr: 1, desc: 1, descFr: 1, archetype: 1, price: 1, images: 1, type: 1, race: 1, attribute: 1 })
      .sort({ nameSearch: 1 })
      .lean();

    const cards = new Map<number, IndexedCard>();
    const artworks: Artwork[] = [];
    const artworkToCard = new Map<number, number>();
    const archetypeByName = new Map<string, ArchetypeSummary>();
    const types = new Set<string>();
    const races = new Set<string>();
    const attributes = new Set<string>();

    for (const doc of docs) {
      const text = `${doc.name} ${doc.desc} ${doc.nameFr ?? ''} ${doc.descFr ?? ''}`.toLowerCase();
      cards.set(doc._id, {
        id: doc._id,
        name: doc.name,
        nameFr: doc.nameFr,
        archetype: doc.archetype,
        price: doc.price,
        images: doc.images,
        rank: cards.size,
        probable: SCYTHE_KEYWORDS.some(keyword => text.includes(keyword)),
      });
      for (const imageId of doc.images) {
        artworks.push({ imageId, cardId: doc._id });
        artworkToCard.set(imageId, doc._id);
      }
      if (doc.archetype) {
        let archetype = archetypeByName.get(doc.archetype);
        if (!archetype) {
          archetype = { name: doc.archetype, cardIds: [], totalPrice: 0, cover: doc.images[0] };
          archetypeByName.set(doc.archetype, archetype);
        }
        // couverture : la première carte qui a une illustration recadrée
        if (!hasCroppedArt(archetype.cover) && hasCroppedArt(doc.images[0])) archetype.cover = doc.images[0];
        archetype.cardIds.push(doc._id);
        archetype.totalPrice += doc.price;
      }
      if (doc.type) types.add(doc.type);
      if (doc.race) races.add(doc.race);
      if (doc.attribute) attributes.add(doc.attribute);
    }

    const archetypes = [...archetypeByName.values()].sort((a, b) => a.name.localeCompare(b.name));
    for (const archetype of archetypes) archetype.totalPrice = roundPrice(archetype.totalPrice);

    this.cards = cards;
    this.artworks = artworks;
    this.artworkToCard = artworkToCard;
    this.archetypes = archetypes;
    this.archetypeByName = archetypeByName;
    this.facets = { types: [...types].sort(), races: [...races].sort(), attributes: [...attributes].sort() };
    this.logger.log(`Index reconstruit : ${cards.size} cartes, ${artworks.length} illustrations, ${archetypes.length} archétypes`);
  }

  // identifiant actuel d'une carte à partir de n'importe lequel de ses identifiants : ygoprodeck change parfois
  // l'identifiant principal d'une carte à plusieurs illustrations, mais chacun reste celui d'une de ses illustrations
  resolveCardId(id: number): number | undefined {
    return this.artworkToCard.get(id);
  }

  // identifiants actuels, sans doublon ni identifiant inconnu
  resolveCardIds(ids: Iterable<number>): number[] {
    const resolved = new Set<number>();
    for (const id of ids) {
      const cardId = this.artworkToCard.get(id);
      if (cardId !== undefined) resolved.add(cardId);
    }
    return [...resolved];
  }

  // trie des identifiants de cartes connus par nom de carte
  sortByName(cardIds: number[]): number[] {
    return cardIds.sort((a, b) => this.cards.get(a)!.rank - this.cards.get(b)!.rank);
  }
}
