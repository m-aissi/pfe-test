import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CardsIndex } from '../cards/cards.index';
import { CustomArchetype, CustomArchetypeDocument, customKey } from './collection.schema';
import { CollectionService } from './collection.service';

export interface CustomArchetypeInput {
  name: string;
  archetypes: string[];
  cardIds: number[];
  excludedIds?: number[];
}

@Injectable()
export class CustomArchetypesService {
  constructor(
    @InjectModel(CustomArchetype.name) private readonly model: Model<CustomArchetype>,
    private readonly index: CardsIndex,
    private readonly collection: CollectionService,
  ) {}

  list(userId: string) {
    return this.model.find({ userId }).sort({ name: 1 }).lean();
  }

  async require(userId: string, id: string): Promise<CustomArchetypeDocument> {
    const custom = Types.ObjectId.isValid(id) ? await this.model.findOne({ _id: id, userId }) : null;
    if (!custom) throw new NotFoundException('Archétype introuvable');
    return custom;
  }

  // cartes d'un archétype perso : celles des archétypes fusionnés plus celles choisies une à une, triées par nom
  expand(custom: { archetypes: string[]; cardIds: number[]; excludedIds?: number[] }): number[] {
    const ids = new Set<number>(this.index.resolveCardIds(custom.cardIds));
    const excluded = new Set(this.index.resolveCardIds(custom.excludedIds ?? []));
    for (const name of custom.archetypes) {
      for (const id of this.index.archetypeByName.get(name)?.cardIds ?? []) if (!excluded.has(id)) ids.add(id);
    }
    return this.index.sortByName([...ids]);
  }

  async create(userId: string, input: CustomArchetypeInput): Promise<CustomArchetypeDocument> {
    const custom = await this.model.create({ userId, ...this.clean(input) });
    // un archétype qu'on vient de créer remonte en tête de liste
    await this.collection.setFavorite(userId, customKey(custom.id), true);
    return custom;
  }

  async update(userId: string, id: string, input: CustomArchetypeInput): Promise<CustomArchetypeDocument> {
    const custom = await this.require(userId, id);
    Object.assign(custom, this.clean(input));
    return custom.save();
  }

  // supprimer un archétype perso fait réapparaître les archétypes officiels qu'il avait absorbés
  async remove(userId: string, id: string) {
    const custom = await this.require(userId, id);
    await custom.deleteOne();
    await this.collection.removeFavorites(userId, [customKey(custom.id)]);
  }

  // fusionne des archétypes (officiels ou perso) en un nouvel archétype perso ; les perso fusionnés sont supprimés
  async merge(userId: string, name: string, keys: string[]): Promise<CustomArchetypeDocument> {
    const archetypes: string[] = [];
    const cardIds: number[] = [];
    const excludedIds: number[] = [];
    const absorbed: CustomArchetypeDocument[] = [];
    for (const key of new Set(keys)) {
      if (key.startsWith('a:')) {
        archetypes.push(key.slice(2));
      } else if (key.startsWith('c:')) {
        const custom = await this.require(userId, key.slice(2));
        archetypes.push(...custom.archetypes);
        cardIds.push(...custom.cardIds);
        excludedIds.push(...(custom.excludedIds ?? []));
        absorbed.push(custom);
      } else {
        throw new BadRequestException('Cet archétype ne peut pas être fusionné');
      }
    }
    const merged = await this.create(userId, { name, archetypes, cardIds, excludedIds });
    for (const custom of absorbed) await this.remove(userId, custom.id);
    return merged;
  }

  async deleteAll(userId: string) {
    await this.model.deleteMany({ userId });
  }

  clean(input: CustomArchetypeInput): CustomArchetypeInput {
    const name = input.name.trim();
    const archetypes = [...new Set(input.archetypes)].filter(archetype => this.index.archetypeByName.has(archetype));
    const cardIds = this.index.resolveCardIds(input.cardIds);
    const excludedIds = this.index.resolveCardIds(input.excludedIds ?? []);
    if (!name) throw new BadRequestException("Donne un nom à l'archétype");
    if (archetypes.length == 0 && cardIds.length == 0) throw new BadRequestException('Ajoute au moins une carte');
    return { name, archetypes, cardIds, excludedIds };
  }
}
