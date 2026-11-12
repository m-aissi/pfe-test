import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, PipelineStage } from 'mongoose';
import { Card } from './card.schema';
import { escapeRegex, normalize } from './normalize';

// carte telle qu'envoyée au front
export interface CardDto {
  id: number;
  name: string;
  nameFr?: string;
  type: string;
  frameType: string;
  race: string;
  attribute?: string;
  atk?: number;
  def?: number;
  level?: number;
  scale?: number;
  linkval?: number;
  archetype?: string;
  images: number[];
  price: number;
  desc?: string;
  descFr?: string;
}

export interface SearchParams {
  q?: string;
  // cherche aussi dans le texte des cartes
  inDesc?: boolean;
  type?: string;
  race?: string;
  attribute?: string;
  // valeurs minimales ; une carte sans la statistique ne correspond pas
  atk?: number;
  def?: number;
  level?: number;
  link?: number;
  scale?: number;
  page: number;
  limit: number;
}

export interface SearchResult {
  items: CardDto[];
  total: number;
  page: number;
  hasMore: boolean;
}

const INTERNAL_FIELDS = { nameSearch: 0, nameFrSearch: 0, syncedAt: 0, tcgDate: 0 };
const LIST_FIELDS = { ...INTERNAL_FIELDS, desc: 0, descFr: 0 };

@Injectable()
export class CardsService {
  constructor(@InjectModel(Card.name) private readonly cardModel: Model<Card>) {}

  private toDto(card: any): CardDto {
    const { _id, ...rest } = card;
    return { id: _id, ...rest };
  }

  async mapByIds(ids: number[], withDesc = false): Promise<Map<number, CardDto>> {
    const docs = await this.cardModel.find({ _id: { $in: ids } }, withDesc ? INTERNAL_FIELDS : LIST_FIELDS).lean();
    return new Map(docs.map(doc => [doc._id, this.toDto(doc)]));
  }

  // cartes dans l'ordre des identifiants demandés, les identifiants inconnus sont ignorés
  async findByIds(ids: number[], withDesc = false): Promise<CardDto[]> {
    const byId = await this.mapByIds(ids, withDesc);
    return ids.map(id => byId.get(id)).filter((card): card is CardDto => !!card);
  }

  async findByArchetype(name: string): Promise<CardDto[]> {
    const docs = await this.cardModel.find({ archetype: name }, LIST_FIELDS).sort({ nameSearch: 1 }).lean();
    return docs.map(doc => this.toDto(doc));
  }

  // recherche par nom français ou anglais, les noms qui commencent par la recherche d'abord
  async search(params: SearchParams): Promise<SearchResult> {
    const match: Record<string, any> = {};
    const query = normalize(params.q ?? '');
    const pattern = escapeRegex(query);
    if (query) {
      match.$or = [{ nameSearch: { $regex: pattern } }, { nameFrSearch: { $regex: pattern } }];
      if (params.inDesc) {
        const raw = escapeRegex((params.q ?? '').trim());
        match.$or.push({ desc: { $regex: raw, $options: 'i' } }, { descFr: { $regex: raw, $options: 'i' } });
      }
    }
    if (params.type) match.type = params.type;
    if (params.race) match.race = params.race;
    if (params.attribute) match.attribute = params.attribute;
    if (params.atk !== undefined) match.atk = { $gte: params.atk };
    if (params.def !== undefined) match.def = { $gte: params.def };
    if (params.level !== undefined) match.level = { $gte: params.level };
    if (params.link !== undefined) match.linkval = { $gte: params.link };
    if (params.scale !== undefined) match.scale = { $gte: params.scale };

    const startsWith = (field: string) => ({ $regexMatch: { input: { $ifNull: [field, ''] }, regex: `^${pattern}` } });
    const pipeline: PipelineStage[] = [
      { $match: match },
      { $addFields: { rank: query ? { $cond: [{ $or: [startsWith('$nameSearch'), startsWith('$nameFrSearch')] }, 0, 1] } : 0 } },
      { $sort: { rank: 1, nameSearch: 1 } },
      {
        $facet: {
          items: [{ $skip: params.page * params.limit }, { $limit: params.limit }, { $project: { ...INTERNAL_FIELDS, rank: 0 } }],
          total: [{ $count: 'count' }],
        },
      },
    ];
    const [result] = await this.cardModel.aggregate(pipeline);
    const total: number = result.total[0]?.count ?? 0;
    return {
      items: result.items.map((doc: any) => this.toDto(doc)),
      total,
      page: params.page,
      hasMore: (params.page + 1) * params.limit < total,
    };
  }
}
