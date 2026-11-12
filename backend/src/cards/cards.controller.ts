import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { CardsSyncService } from './cards-sync.service';
import { CardsIndex } from './cards.index';
import { CardsService, SearchSort } from './cards.service';

class SearchQuery {
  @IsOptional() @IsString() @MaxLength(100)
  q?: string;

  // desc=1 : cherche aussi dans le texte des cartes
  @IsOptional() @IsIn(['0', '1'])
  desc?: string;

  @IsOptional() @IsString() @MaxLength(60)
  type?: string;

  @IsOptional() @IsString() @MaxLength(60)
  race?: string;

  @IsOptional() @IsString() @MaxLength(20)
  attribute?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  atk?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  def?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  level?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  link?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  scale?: number;

  @IsOptional() @IsString() @MaxLength(100)
  archetype?: string;

  @IsOptional() @IsIn(['name', 'new', 'random', 'price', 'price-desc'])
  sort?: SearchSort;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(2_000_000)
  seed?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  page: number = 0;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  limit: number = 30;
}

const MAX_IDS = 300;

// "1,2,3" -> [1, 2, 3], refuse tout ce qui n'est pas une liste d'entiers
export function parseIds(raw: string | undefined, max = MAX_IDS): number[] {
  if (!raw) return [];
  const ids = raw.split(',').map(Number);
  if (ids.length > max || ids.some(id => !Number.isInteger(id) || id < 0)) throw new BadRequestException('Liste d\'identifiants invalide');
  return ids;
}

@Controller('cards')
export class CardsController {
  constructor(
    private readonly cards: CardsService,
    private readonly index: CardsIndex,
    private readonly sync: CardsSyncService,
  ) {}

  @Get('search')
  search(@Query() query: SearchQuery) {
    return this.cards.search({ ...query, inDesc: query.desc === '1' });
  }

  // valeurs possibles des filtres de recherche (types, races, attributs présents en base)
  @Get('facets')
  facets() {
    return this.index.facets;
  }

  @Get('status')
  async status() {
    const meta = await this.sync.status();
    return {
      cardCount: this.index.cards.size,
      artworkCount: this.index.artworks.length,
      archetypeCount: this.index.archetypes.length,
      databaseVersion: meta?.databaseVersion ?? null,
      syncedAt: meta?.syncedAt ?? null,
    };
  }

  @Get()
  byIds(@Query('ids') ids: string, @Query('desc') desc?: string) {
    return this.cards.findByIds(this.index.resolveCardIds(parseIds(ids)), desc === '1');
  }
}
