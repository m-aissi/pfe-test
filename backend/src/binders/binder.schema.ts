import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

// une case de classeur : une illustration précise d'une carte
export interface BinderSlot {
  imageId: number;
  cardId: number;
  owned: boolean;
}

@Schema({ collection: 'binders', versionKey: false, timestamps: true })
export class Binder {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  name: string;

  // la page 1 est seule à droite, face à la couverture, comme dans un vrai classeur
  @Prop({ default: true })
  firstPageAlone: boolean;

  // pages de 9 cases, une case vide vaut null
  @Prop({ type: Array, default: [] })
  pages: (BinderSlot | null)[][];
}

export type BinderDocument = HydratedDocument<Binder> & { updatedAt: Date };
export const BinderSchema = SchemaFactory.createForClass(Binder);
