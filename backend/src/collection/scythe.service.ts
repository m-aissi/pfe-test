import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Artwork, CardsIndex } from '../cards/cards.index';
import { SCYTHE_KEY, ScytheState } from './collection.schema';
import { CollectionService } from './collection.service';

export interface QueueItem {
  imageId: number;
  cardId: number;
  name: string;
  nameFr?: string;
  probable: boolean;
}

// chasse aux faux : on passe en revue toutes les illustrations du jeu pour repérer celles où figure une faux
@Injectable()
export class ScytheService {
  constructor(
    @InjectModel(ScytheState.name) private readonly model: Model<ScytheState>,
    private readonly index: CardsIndex,
    private readonly collection: CollectionService,
  ) {}

  // illustrations retenues, triées par nom de carte
  async found(userId: string): Promise<Artwork[]> {
    const state = await this.model.findOne({ userId }, { found: 1 }).lean();
    return this.knownIds(state?.found ?? [])
      .map(imageId => ({ imageId, cardId: this.index.artworkToCard.get(imageId)! }))
      .sort((a, b) => this.index.cards.get(a.cardId)!.rank - this.index.cards.get(b.cardId)!.rank || a.imageId - b.imageId);
  }

  // prochaines illustrations à trier. "exclude" : celles déjà affichées chez le client et pas encore validées
  async queue(userId: string, limit: number, prioritize: boolean, exclude: number[]) {
    const state = await this.model.findOne({ userId }).lean();
    const seen = new Set(state?.seen ?? []);
    const skip = new Set(exclude);
    const probable: QueueItem[] = [];
    const others: QueueItem[] = [];
    let remaining = 0;
    for (const artwork of this.index.artworks) {
      if (seen.has(artwork.imageId)) continue;
      remaining++;
      if (skip.has(artwork.imageId)) continue;
      const card = this.index.cards.get(artwork.cardId)!;
      const bucket = prioritize && card.probable ? probable : others;
      if (bucket.length < limit) {
        bucket.push({ imageId: artwork.imageId, cardId: card.id, name: card.name, nameFr: card.nameFr, probable: card.probable });
      }
    }
    const total = this.index.artworks.length;
    return {
      total,
      seenCount: total - remaining,
      foundCount: this.knownIds(state?.found ?? []).length,
      items: [...probable, ...others].slice(0, limit),
    };
  }

  // enregistre une page triée : toutes ses illustrations sont vues, certaines sont retenues
  async validate(userId: string, seen: number[], found: number[]) {
    await this.add(userId, seen, found.filter(id => seen.includes(id)));
  }

  // annule une page : ses illustrations reviennent dans la file
  async undo(userId: string, imageIds: number[]) {
    await this.model.updateOne({ userId }, { $pull: { seen: { $in: imageIds }, found: { $in: imageIds } } });
  }

  // ajoute des illustrations vues / retenues (validation d'une page, ou import d'un ancien tri)
  async add(userId: string, seen: number[], found: number[]) {
    const seenIds = this.knownIds(seen);
    const foundIds = this.knownIds(found);
    if (seenIds.length == 0 && foundIds.length == 0) return;
    const before = foundIds.length ? await this.model.findOne({ userId }, { found: { $slice: 1 } }).lean() : null;
    await this.model.updateOne(
      { userId },
      { $addToSet: { seen: { $each: [...seenIds, ...foundIds] }, found: { $each: foundIds } } },
      { upsert: true },
    );
    // première faux trouvée : l'archétype "Faux" apparaît en favori, comme sur l'ancien site
    if (foundIds.length && !before?.found?.length) await this.collection.setFavorite(userId, SCYTHE_KEY, true);
  }

  async deleteAll(userId: string) {
    await this.model.deleteOne({ userId });
  }

  private knownIds(imageIds: number[]): number[] {
    return [...new Set(imageIds)].filter(id => this.index.artworkToCard.has(id));
  }
}
