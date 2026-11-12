import { Injectable } from '@nestjs/common';
import { BindersService } from '../binders/binders.service';
import { CardsIndex } from '../cards/cards.index';
import { officialKey, SCYTHE_NAME } from '../collection/collection.schema';
import { CollectionService } from '../collection/collection.service';
import { CustomArchetypesService } from '../collection/custom-archetypes.service';
import { ScytheService } from '../collection/scythe.service';

// données de l'ancien site (fichier YGOToolsProfile.json, classeurs et tri des faux du navigateur),
// déjà remises par le front dans ce format neutre
export interface ImportInput {
  archetypes?: { name?: unknown; favorite?: unknown; cards?: { id?: unknown; owned?: unknown; wanted?: unknown }[] }[];
  binders?: { name?: unknown; firstPageAlone?: unknown; pages?: unknown }[];
  scythe?: { seen?: unknown; found?: unknown };
}

const numbers = (value: unknown): number[] => (Array.isArray(value) ? value.filter((item): item is number => Number.isInteger(item)) : []);

@Injectable()
export class ImportService {
  constructor(
    private readonly index: CardsIndex,
    private readonly collection: CollectionService,
    private readonly customs: CustomArchetypesService,
    private readonly scythe: ScytheService,
    private readonly binders: BindersService,
  ) {}

  // ajoute les anciennes données au compte sans rien écraser ; relancer le même import ne crée pas de doublon
  async import(userId: string, input: ImportInput) {
    const summary = { owned: 0, wanted: 0, favorites: 0, customArchetypes: 0, binders: 0, scytheSeen: 0, scytheFound: 0 };

    if (Array.isArray(input.archetypes)) await this.importProfile(userId, input.archetypes, summary);

    for (const binder of Array.isArray(input.binders) ? input.binders : []) {
      const name = String(binder?.name ?? '').trim() || 'Classeur importé';
      const pages = Array.isArray(binder?.pages) ? binder.pages : [];
      if (await this.binders.exists(userId, name, pages)) continue;
      await this.binders.create(userId, { name, firstPageAlone: binder.firstPageAlone !== false, pages });
      summary.binders++;
    }

    if (input.scythe) {
      const seen = numbers(input.scythe.seen);
      const found = numbers(input.scythe.found);
      await this.scythe.add(userId, seen, found);
      summary.scytheSeen = seen.length;
      summary.scytheFound = found.length;
    }
    return summary;
  }

  private async importProfile(userId: string, archetypes: NonNullable<ImportInput['archetypes']>, summary: Record<string, number>) {
    const owned = new Set<number>();
    const wanted = new Set<number>();
    const profileNames = new Set(archetypes.map(archetype => String(archetype?.name ?? '')));
    const existingCustoms = new Set((await this.customs.list(userId)).map(custom => custom.name));

    for (const archetype of archetypes) {
      const name = String(archetype?.name ?? '').trim();
      const cards = Array.isArray(archetype?.cards) ? archetype.cards : [];
      const cardIds: number[] = [];
      // l'ancien site rangeait possédée / voulue dans chaque archétype : ici c'est une propriété de la carte
      for (const card of cards) {
        const id = typeof card?.id == 'number' ? this.index.resolveCardId(card.id) : undefined;
        if (id === undefined) continue;
        cardIds.push(id);
        if (card.owned) owned.add(id);
        if (card.wanted) wanted.add(id);
      }

      // "Faux" est reconstruit à partir du tri des faux, pas importé comme archétype
      if (!name || name == SCYTHE_NAME) continue;
      if (this.index.archetypeByName.has(name)) {
        if (archetype.favorite) {
          await this.collection.setFavorite(userId, officialKey(name), true);
          summary.favorites++;
        }
        continue;
      }

      // nom inconnu de ygoprodeck : archétype créé ou fusionné sur l'ancien site
      if (existingCustoms.has(name) || cardIds.length == 0) continue;
      const cardSet = new Set(cardIds);
      // un archétype officiel absent du profil et entièrement contenu dans celui-ci y avait été fusionné
      const sources = this.index.archetypes
        .filter(official => !profileNames.has(official.name) && official.cardIds.every(id => cardSet.has(id)))
        .map(official => official.name);
      const covered = new Set(sources.flatMap(source => this.index.archetypeByName.get(source)!.cardIds));
      await this.customs.create(userId, { name: name.slice(0, 60), archetypes: sources, cardIds: cardIds.filter(id => !covered.has(id)) });
      summary.customArchetypes++;
    }

    if (owned.size) await this.collection.setFlags(userId, [...owned], { owned: true });
    if (wanted.size) await this.collection.setFlags(userId, [...wanted], { wanted: true });
    summary.owned = owned.size;
    summary.wanted = wanted.size;
  }
}
