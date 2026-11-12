import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CardsIndex } from '../cards/cards.index';
import { Collection, SCYTHE_KEY } from './collection.schema';

export interface UserCollection {
  owned: Set<number>;
  wanted: Set<number>;
  favorites: Set<string>;
  // clé d'archétype -> illustration de couverture choisie
  covers: Map<string, number>;
  // clé d'archétype -> dernière ouverture (ms)
  seen: Map<string, number>;
  // avant cette date (création du compte), aucune carte n'est "nouvelle" ; Infinity sans compte
  since: number;
}

export const EMPTY_COLLECTION: UserCollection = {
  owned: new Set(),
  wanted: new Set(),
  favorites: new Set(),
  covers: new Map(),
  seen: new Map(),
  since: Infinity,
};

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
      covers: new Map((doc?.covers ?? []).filter(cover => this.index.artworkToCard.has(cover.imageId)).map(cover => [cover.key, cover.imageId])),
      seen: new Map((doc?.seen ?? []).map(entry => [entry.key, new Date(entry.at).getTime()])),
      // l'identifiant Mongo du compte contient sa date de création
      since: new Types.ObjectId(userId).getTimestamp().getTime(),
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

  private checkKey(key: string) {
    const valid =
      key == SCYTHE_KEY ||
      (key.startsWith('a:') && this.index.archetypeByName.has(key.slice(2))) ||
      ((key.startsWith('c:') || key.startsWith('s:')) && Types.ObjectId.isValid(key.slice(2)));
    if (!valid) throw new BadRequestException('Archétype inconnu');
  }

  async setFavorite(userId: string, key: string, favorite: boolean) {
    this.checkKey(key);
    await this.update(userId, favorite ? { favorites: key } : {}, favorite ? {} : { favorites: key });
  }

  // imageId null : revient à la couverture par défaut
  async setCover(userId: string, key: string, imageId: number | null) {
    this.checkKey(key);
    if (imageId !== null && !this.index.artworkToCard.has(imageId)) throw new BadRequestException('Illustration inconnue');
    await this.model.updateOne({ userId }, { $pull: { covers: { key } } }, { upsert: true });
    if (imageId !== null) await this.model.updateOne({ userId }, { $push: { covers: { key, imageId } } });
  }

  async markSeen(userId: string, key: string) {
    await this.model.updateOne({ userId }, { $pull: { seen: { key } } }, { upsert: true });
    await this.model.updateOne({ userId }, { $push: { seen: { key, at: new Date() } } });
  }

  // un archétype perso devenu archétype du site garde son favori, sa couverture et son suivi des nouveautés
  async renameKey(userId: string, from: string, to: string) {
    const doc = await this.model.findOne({ userId });
    if (!doc) return;
    doc.favorites = doc.favorites.map(key => (key == from ? to : key));
    for (const list of [doc.covers, doc.seen]) for (const entry of list) if (entry.key == from) entry.key = to;
    doc.markModified('covers');
    doc.markModified('seen');
    await doc.save();
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
