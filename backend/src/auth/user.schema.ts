import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ collection: 'users', versionKey: false, timestamps: { createdAt: true, updatedAt: false } })
export class User {
  @Prop({ required: true })
  username: string;

  // pseudo en minuscules : deux comptes ne peuvent pas différer seulement par la casse
  @Prop({ required: true, unique: true })
  usernameLower: string;

  // absent pour un compte créé via Google ou Discord qui n'a pas défini de mot de passe
  @Prop()
  passwordHash?: string;

  @Prop({ unique: true, sparse: true })
  googleId?: string;

  @Prop({ unique: true, sparse: true })
  discordId?: string;

  // incrémenté au changement de mot de passe : invalide toutes les sessions ouvertes
  @Prop({ default: 0 })
  tokenVersion: number;

  @Prop()
  lastLoginAt?: Date;

  // gère les archétypes du site, communs à tous les comptes (npm run set-admin)
  @Prop({ default: false })
  admin: boolean;
}

export type UserDocument = HydratedDocument<User>;
export const UserSchema = SchemaFactory.createForClass(User);
