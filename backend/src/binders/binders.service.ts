import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CardsIndex } from '../cards/cards.index';
import { roundPrice } from '../cards/normalize';
import { Binder, BinderDocument, BinderSlot } from './binder.schema';

export const SLOTS_PER_PAGE = 9;
const DEFAULT_PAGES = 20;
const MAX_PAGES = 400;
const MAX_BINDERS = 100;

export interface BinderInput {
  name: string;
  firstPageAlone?: boolean;
  pages?: unknown;
}

@Injectable()
export class BindersService {
  constructor(
    @InjectModel(Binder.name) private readonly model: Model<Binder>,
    private readonly index: CardsIndex,
  ) {}

  // résumé de chaque classeur pour la page de liste
  async list(userId: string) {
    const binders = await this.model.find({ userId }).sort({ createdAt: 1 }).lean<(Binder & { _id: Types.ObjectId; updatedAt: Date })[]>();
    return binders.map(binder => {
      const slots = this.cleanPages(binder.pages).flat().filter((slot): slot is BinderSlot => !!slot);
      const price = (items: BinderSlot[]) => roundPrice(items.reduce((total, slot) => total + this.index.cards.get(slot.cardId)!.price, 0));
      return {
        id: String(binder._id),
        name: binder.name,
        pageCount: binder.pages.length,
        cardCount: slots.length,
        totalPrice: price(slots),
        toBuyPrice: price(slots.filter(slot => !slot.owned)),
        // les premières cartes servent d'aperçu
        preview: slots.slice(0, 9).map(slot => slot.imageId),
        updatedAt: binder.updatedAt,
      };
    });
  }

  async get(userId: string, id: string) {
    return this.hydrate(await this.require(userId, id));
  }

  async create(userId: string, input: BinderInput) {
    if ((await this.model.countDocuments({ userId })) >= MAX_BINDERS) throw new BadRequestException('Nombre maximum de classeurs atteint');
    const pages = input.pages === undefined ? this.emptyPages(DEFAULT_PAGES) : this.cleanPages(input.pages);
    const binder = await this.model.create({ userId, name: this.cleanName(input.name), firstPageAlone: input.firstPageAlone ?? true, pages });
    return this.hydrate(binder as BinderDocument);
  }

  // remplace tout le contenu du classeur : le front envoie son état complet après chaque modification
  async save(userId: string, id: string, input: BinderInput) {
    const binder = await this.require(userId, id);
    binder.name = this.cleanName(input.name);
    if (input.firstPageAlone !== undefined) binder.firstPageAlone = !!input.firstPageAlone;
    if (input.pages !== undefined) binder.pages = this.cleanPages(input.pages);
    await binder.save();
    return { id: binder.id, updatedAt: binder.updatedAt };
  }

  async remove(userId: string, id: string) {
    await (await this.require(userId, id)).deleteOne();
  }

  async deleteAll(userId: string) {
    await this.model.deleteMany({ userId });
  }

  // vrai si l'utilisateur a déjà un classeur de ce nom avec exactement ce contenu (évite les doublons à l'import)
  async exists(userId: string, name: string, pages: unknown): Promise<boolean> {
    const content = JSON.stringify(this.cleanPages(pages));
    const sameName = await this.model.find({ userId, name: this.cleanName(name) }, { pages: 1 }).lean();
    return sameName.some(binder => JSON.stringify(this.cleanPages(binder.pages)) == content);
  }

  private async require(userId: string, id: string): Promise<BinderDocument> {
    const binder = Types.ObjectId.isValid(id) ? await this.model.findOne({ _id: id, userId }) : null;
    if (!binder) throw new NotFoundException('Classeur introuvable');
    return binder as BinderDocument;
  }

  // ajoute à chaque case le nom et le prix actuels de sa carte
  private hydrate(binder: BinderDocument) {
    return {
      id: binder.id as string,
      name: binder.name,
      firstPageAlone: binder.firstPageAlone,
      updatedAt: binder.updatedAt,
      pages: this.cleanPages(binder.pages).map(page =>
        page.map(slot => {
          if (!slot) return null;
          const card = this.index.cards.get(slot.cardId)!;
          return { ...slot, name: card.name, nameFr: card.nameFr, price: card.price };
        }),
      ),
    };
  }

  private cleanName(name: unknown): string {
    const clean = String(name ?? '').trim().slice(0, 60);
    if (!clean) throw new BadRequestException('Donne un nom au classeur');
    return clean;
  }

  private emptyPages(count: number): null[][] {
    return Array.from({ length: count }, () => new Array(SLOTS_PER_PAGE).fill(null));
  }

  // ne garde des données reçues que des pages de 9 cases pointant vers des illustrations connues ;
  // la carte est déduite de l'illustration, jamais prise telle quelle du client
  private cleanPages(pages: unknown): (BinderSlot | null)[][] {
    if (!Array.isArray(pages) || pages.length > MAX_PAGES) throw new BadRequestException('Pages du classeur invalides');
    return pages.map(page => {
      const slots: unknown[] = Array.isArray(page) ? page : [];
      return Array.from({ length: SLOTS_PER_PAGE }, (_, position) => {
        const slot = slots[position] as Partial<BinderSlot> | null | undefined;
        const cardId = slot && typeof slot.imageId == 'number' ? this.index.artworkToCard.get(slot.imageId) : undefined;
        return cardId === undefined ? null : { imageId: slot!.imageId!, cardId, owned: !!slot!.owned };
      });
    });
  }
}
