import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

// copie locale d'une carte ygoprodeck ; _id = identifiant ygoprodeck de la carte
@Schema({ collection: 'cards', versionKey: false })
export class Card {
  @Prop({ type: Number, required: true })
  _id: number;

  @Prop({ required: true })
  name: string;

  @Prop()
  nameFr?: string;

  // noms normalisés (voir normalize) pour la recherche et le tri
  @Prop({ required: true, index: true })
  nameSearch: string;

  @Prop()
  nameFrSearch?: string;

  @Prop()
  desc: string;

  @Prop()
  descFr?: string;

  @Prop()
  type: string;

  @Prop()
  frameType: string;

  @Prop()
  race: string;

  @Prop()
  attribute?: string;

  @Prop()
  atk?: number;

  @Prop()
  def?: number;

  @Prop()
  level?: number;

  @Prop()
  scale?: number;

  @Prop()
  linkval?: number;

  @Prop({ index: true })
  archetype?: string;

  // identifiants des illustrations, la première est celle par défaut
  @Prop({ type: [Number], required: true })
  images: number[];

  // prix Cardmarket en euros
  @Prop({ required: true })
  price: number;

  @Prop()
  tcgDate?: string;

  @Prop({ required: true })
  syncedAt: Date;
}

export const CardSchema = SchemaFactory.createForClass(Card);

// état de la dernière synchro avec ygoprodeck (un seul document, _id = 'cards')
@Schema({ collection: 'meta', versionKey: false })
export class Meta {
  @Prop({ type: String, required: true })
  _id: string;

  @Prop()
  databaseVersion: string;

  @Prop()
  lastUpdate: string;

  @Prop()
  syncedAt: Date;

  @Prop()
  cardCount: number;
}

export const MetaSchema = SchemaFactory.createForClass(Meta);
