import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CardsIndex } from '../cards/cards.index';
import { Collection, SCYTHE_KEY } from './collection.schema';

export interface UserCollection {
  owned: Set<number>;
  wanted: Set<number>;
  favorites: Set<string>;
}

export const EMPTY_COLLECTION: UserCollection = { owned: new Set(), wanted: new Set(), favorites: new Set() };

@Injectable()
export class CollectionService {
  constructor(
    @InjectModel(Collection.name) private readonly model: Model<Collection>,
    private readonly index: CardsIndex,
  ) {}

  async load(userId: string): Promise<UserCollection> {
    const doc = await this.model.findOne({ userId }).lean();
    return {
      // resolveCardIds : suit les changements d'identifiant de ygoprodeck et écarte les cartes disparues
      owned: new Set(this.index.resolveCardIds(doc?.owned ?? [])),
      wanted: new Set(this.index.resolveCardIds(doc?.wanted ?? [])),
      favorites: new Set(doc?.favorites ?? []),
    };
  }

  // coche ou décoche "possédée" / "voulue" sur une ou plusieurs cartes ; un drapeau absent n'est pas modifié
  async setFlags(userId: string, cardIds: number[], flags: { owned?: boolean; wanted?: boolean }) {
    const ids = this.index.resolveCardIds(cardIds);
    const add: Record<string, any> = {};
    const pull: Record<string, any> = {};
    for (const field of ['owned', 'wanted'] as const) {
      if (flags[field] === true) add[field] = { $each: ids };
      if (flags[field] === false) pull[field] = { $in: ids };
    }
    await this.update(userId, add, pull);
  }

  async setFavorite(userId: string, key: string, favorite: boolean) {
    const valid =
      key == SCYTHE_KEY ||
      (key.startsWith('a:') && this.index.archetypeByName.has(key.slice(2))) ||
      (key.startsWith('c:') && Types.ObjectId.isValid(key.slice(2)));
    if (!valid) throw new BadRequestException('Archétype inconnu');
    await this.update(userId, favorite ? { favorites: key } : {}, favorite ? {} : { favorites: key });
  }

  async removeFavorites(userId: string, keys: string[]) {
    await this.update(userId, {}, { favorites: { $in: keys } });
  }

  async deleteAll(userId: string) {
    await this.model.deleteOne({ userId });
  }

  private async update(userId: string, add: Record<string, any>, pull: Record<string, any>) {
    const update: Record<string, any> = {};
    if (Object.keys(add).length) update.$addToSet = add;
    if (Object.keys(pull).length) update.$pull = pull;
    if (Object.keys(update).length) await this.model.updateOne({ userId }, update, { upsert: true });
  }
}
