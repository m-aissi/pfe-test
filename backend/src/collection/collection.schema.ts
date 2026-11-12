import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

// ce qu'un utilisateur a coché : un document par compte
@Schema({ collection: 'collections', versionKey: false })
export class Collection {
  @Prop({ type: Types.ObjectId, required: true, unique: true })
  userId: Types.ObjectId;

  // identifiants des cartes possédées
  @Prop({ type: [Number], default: [] })
  owned: number[];

  // identifiants des cartes voulues (le cœur)
  @Prop({ type: [Number], default: [] })
  wanted: number[];

  // archétypes mis en favori, par clé (voir archetypeKey)
  @Prop({ type: [String], default: [] })
  favorites: string[];

  // couvertures choisies par l'utilisateur ; une liste plutôt qu'un objet car les noms d'archétype peuvent contenir des points
  @Prop({ type: [{ _id: false, key: String, imageId: Number }], default: [] })
  covers: { key: string; imageId: number }[];

  // dernière ouverture de chaque archétype : les cartes arrivées depuis sont "nouvelles"
  @Prop({ type: [{ _id: false, key: String, at: Date }], default: [] })
  seen: { key: string; at: Date }[];
}

export const CollectionSchema = SchemaFactory.createForClass(Collection);

// archétype créé par l'utilisateur : des archétypes officiels fusionnés et/ou des cartes choisies une à une
@Schema({ collection: 'customarchetypes', versionKey: false, timestamps: true })
export class CustomArchetype {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  name: string;

  // archétypes officiels fusionnés dans celui-ci : ils disparaissent de la liste de l'utilisateur,
  // et leurs futures cartes arrivent ici toutes seules
  @Prop({ type: [String], default: [] })
  archetypes: string[];

  @Prop({ type: [Number], default: [] })
  cardIds: number[];

  // cartes des archétypes regroupés qu'on a retirées une à une (les futures cartes de ces archétypes arrivent quand même)
  @Prop({ type: [Number], default: [] })
  excludedIds: number[];
}

export type CustomArchetypeDocument = HydratedDocument<CustomArchetype>;
export const CustomArchetypeSchema = SchemaFactory.createForClass(CustomArchetype);

// archétype du site, défini par un admin et commun à tous les comptes : regroupe des archétypes officiels
// (qui disparaissent alors de la liste de tout le monde) et des cartes ajoutées une à une. Les nouvelles cartes
// des archétypes regroupés y arrivent toutes seules à chaque synchro.
@Schema({ collection: 'sitearchetypes', versionKey: false, timestamps: true })
export class SiteArchetype {
  @Prop({ required: true })
  name: string;

  @Prop({ type: [String], default: [] })
  archetypes: string[];

  @Prop({ type: [Number], default: [] })
  cardIds: number[];

  // cartes des archétypes regroupés qu'on a retirées une à une (les futures cartes de ces archétypes arrivent quand même)
  @Prop({ type: [Number], default: [] })
  excludedIds: number[];
}

export type SiteArchetypeDocument = HydratedDocument<SiteArchetype>;
export const SiteArchetypeSchema = SchemaFactory.createForClass(SiteArchetype);

// avancement de la chasse aux faux : illustrations déjà passées en revue et illustrations retenues
@Schema({ collection: 'scythe', versionKey: false })
export class ScytheState {
  @Prop({ type: Types.ObjectId, required: true, unique: true })
  userId: Types.ObjectId;

  @Prop({ type: [Number], default: [] })
  seen: number[];

  @Prop({ type: [Number], default: [] })
  found: number[];
}

export const ScytheStateSchema = SchemaFactory.createForClass(ScytheState);

// clé d'un archétype dans l'API et dans les favoris : "a:<nom>" officiel, "s:<id>" du site, "c:<id>" perso, "faux" pour la chasse aux faux
export const SCYTHE_KEY = 'faux';
export const SCYTHE_NAME = 'Faux';
export const officialKey = (name: string) => `a:${name}`;
export const customKey = (id: string) => `c:${id}`;
export const siteKey = (id: string) => `s:${id}`;
