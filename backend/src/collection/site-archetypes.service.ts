import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { customKey, SiteArchetype, SiteArchetypeDocument, siteKey } from './collection.schema';
import { CollectionService } from './collection.service';
import { CustomArchetypeInput, CustomArchetypesService } from './custom-archetypes.service';

// archétypes du site : lecture pour tous, écriture réservée aux admins (voir AdminGuard)
@Injectable()
export class SiteArchetypesService {
  constructor(
    @InjectModel(SiteArchetype.name) private readonly model: Model<SiteArchetype>,
    private readonly customs: CustomArchetypesService,
    private readonly collection: CollectionService,
  ) {}

  list() {
    return this.model.find().sort({ name: 1 }).lean();
  }

  async require(id: string): Promise<SiteArchetypeDocument> {
    const site = Types.ObjectId.isValid(id) ? await this.model.findById(id) : null;
    if (!site) throw new NotFoundException('Archétype introuvable');
    return site;
  }

  create(input: CustomArchetypeInput) {
    return this.model.create(this.customs.clean(input));
  }

  async update(id: string, input: CustomArchetypeInput) {
    const site = await this.require(id);
    Object.assign(site, this.customs.clean(input));
    return site.save();
  }

  async remove(id: string) {
    await (await this.require(id)).deleteOne();
  }

  // regroupe des archétypes officiels, du site et perso de l'admin en un nouvel archétype du site ;
  // les archétypes du site et perso regroupés sont supprimés (leur contenu passe dans le nouveau)
  async merge(userId: string, name: string, keys: string[]) {
    const archetypes: string[] = [];
    const cardIds: number[] = [];
    const excludedIds: number[] = [];
    const absorbed: { deleteOne(): Promise<unknown> }[] = [];
    for (const key of new Set(keys)) {
      if (key.startsWith('a:')) {
        archetypes.push(key.slice(2));
        continue;
      }
      const group = key.startsWith('s:') ? await this.require(key.slice(2)) : key.startsWith('c:') ? await this.customs.require(userId, key.slice(2)) : null;
      if (!group) throw new BadRequestException('Cet archétype ne peut pas être fusionné');
      archetypes.push(...group.archetypes);
      cardIds.push(...group.cardIds);
      excludedIds.push(...(group.excludedIds ?? []));
      absorbed.push(group);
    }
    const site = await this.create({ name, archetypes, cardIds, excludedIds });
    for (const group of absorbed) await group.deleteOne();
    return site;
  }

  // un archétype perso de l'admin devient un archétype du site (et disparaît de ses archétypes perso)
  async publish(userId: string, customId: string) {
    const custom = await this.customs.require(userId, customId);
    const site = await this.create({ name: custom.name, archetypes: custom.archetypes, cardIds: custom.cardIds, excludedIds: custom.excludedIds });
    await custom.deleteOne();
    await this.collection.renameKey(userId, customKey(custom.id), siteKey(site.id));
    return site;
  }
}
