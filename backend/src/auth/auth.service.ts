import { ConflictException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as argon2 from 'argon2';
import { Model } from 'mongoose';
import { User, UserDocument } from './user.schema';

export type ProviderField = 'googleId' | 'discordId';

// forme de comparaison d'un pseudo : insensible à la casse, et un "é" tapé en un ou deux caractères compte pareil
export function usernameKey(username: string): string {
  return username.normalize('NFC').toLowerCase();
}

// ce que le front a le droit de savoir d'un compte
export interface PublicUser {
  id: string;
  username: string;
  hasPassword: boolean;
  google: boolean;
  discord: boolean;
}

@Injectable()
export class AuthService {
  constructor(@InjectModel(User.name) private readonly userModel: Model<User>) {}

  toPublic(user: UserDocument): PublicUser {
    return { id: user.id, username: user.username, hasPassword: !!user.passwordHash, google: !!user.googleId, discord: !!user.discordId };
  }

  async isSessionValid(userId: string, tokenVersion: number): Promise<boolean> {
    const user = await this.userModel.findById(userId, { tokenVersion: 1 }).lean();
    return !!user && user.tokenVersion === tokenVersion;
  }

  async require(userId: string): Promise<UserDocument> {
    const user = await this.userModel.findById(userId);
    if (!user) throw new UnauthorizedException('Compte introuvable');
    return user;
  }

  async register(username: string, password: string): Promise<UserDocument> {
    username = username.normalize('NFC');
    await this.assertUsernameFree(username);
    const passwordHash = await argon2.hash(password);
    try {
      return await this.userModel.create({ username, usernameLower: usernameKey(username), passwordHash, lastLoginAt: new Date() });
    } catch (error: any) {
      // deux inscriptions simultanées avec le même pseudo : l'index unique tranche
      if (error?.code == 11000) throw new ConflictException('Ce pseudo est déjà pris');
      throw error;
    }
  }

  async login(username: string, password: string): Promise<UserDocument> {
    const user = await this.userModel.findOne({ usernameLower: usernameKey(username) });
    // même message que le pseudo existe ou non, pour ne pas révéler quels comptes existent
    if (!user?.passwordHash || !(await argon2.verify(user.passwordHash, password))) {
      throw new UnauthorizedException('Pseudo ou mot de passe incorrect');
    }
    user.lastLoginAt = new Date();
    return user.save();
  }

  // un compte Google/Discord sans mot de passe peut en définir un sans fournir l'ancien
  async changePassword(userId: string, currentPassword: string | undefined, newPassword: string): Promise<UserDocument> {
    const user = await this.require(userId);
    if (user.passwordHash && !(currentPassword && (await argon2.verify(user.passwordHash, currentPassword)))) {
      throw new ForbiddenException('Mot de passe actuel incorrect');
    }
    user.passwordHash = await argon2.hash(newPassword);
    user.tokenVersion++;
    return user.save();
  }

  async rename(userId: string, username: string): Promise<UserDocument> {
    username = username.normalize('NFC');
    const user = await this.require(userId);
    if (usernameKey(username) != user.usernameLower) await this.assertUsernameFree(username);
    user.username = username;
    user.usernameLower = usernameKey(username);
    return user.save();
  }

  // connexion Google/Discord : retrouve le compte lié, sinon en crée un
  async loginWithProvider(field: ProviderField, providerId: string, displayName: string): Promise<UserDocument> {
    let user = await this.userModel.findOne({ [field]: providerId });
    if (!user) {
      const username = await this.freeUsername(displayName);
      user = await this.userModel.create({ username, usernameLower: usernameKey(username), [field]: providerId });
    }
    user.lastLoginAt = new Date();
    return user.save();
  }

  // rattache un compte Google/Discord au compte déjà connecté
  async linkProvider(userId: string, field: ProviderField, providerId: string) {
    const owner = await this.userModel.findOne({ [field]: providerId }, { _id: 1 }).lean();
    if (owner && String(owner._id) != userId) throw new ConflictException('Ce compte est déjà lié à un autre pseudo');
    await this.userModel.updateOne({ _id: userId }, { [field]: providerId });
  }

  async delete(userId: string) {
    await this.userModel.deleteOne({ _id: userId });
  }

  private async assertUsernameFree(username: string) {
    if (await this.userModel.exists({ usernameLower: usernameKey(username) })) throw new ConflictException('Ce pseudo est déjà pris');
  }

  // pseudo dérivé du nom du compte Google/Discord, suffixé de chiffres tant qu'il est déjà pris
  private async freeUsername(displayName: string): Promise<string> {
    let base = displayName
      .normalize('NFD')
      .replace(/[^a-zA-Z0-9_-]/g, '')
      .slice(0, 16);
    if (base.length < 3) base = 'duelliste';
    for (let attempt = 0; attempt < 20; attempt++) {
      const username = attempt == 0 ? base : `${base}${1000 + Math.floor(Math.random() * 9000)}`;
      if (!(await this.userModel.exists({ usernameLower: usernameKey(username) }))) return username;
    }
    throw new ConflictException('Impossible de trouver un pseudo libre');
  }
}
