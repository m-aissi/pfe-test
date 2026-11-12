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
}

export type CustomArchetypeDocument = HydratedDocument<CustomArchetype>;
export const CustomArchetypeSchema = SchemaFactory.createForClass(CustomArchetype);

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

// clé d'un archétype dans l'API et dans les favoris : "a:<nom>" officiel, "c:<id>" perso, "faux" pour la chasse aux faux
export const SCYTHE_KEY = 'faux';
export const SCYTHE_NAME = 'Faux';
export const officialKey = (name: string) => `a:${name}`;
export const customKey = (id: string) => `c:${id}`;
