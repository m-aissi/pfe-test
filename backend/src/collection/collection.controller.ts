import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength,
} from 'class-validator';
import { AdminGuard, AuthGuard, OptionalAuthGuard, UserId } from '../auth/auth.guard';
import { parseIds } from '../cards/cards.controller';
import { ArchetypesService } from './archetypes.service';
import { customKey, siteKey } from './collection.schema';
import { CollectionService } from './collection.service';
import { CustomArchetypesService } from './custom-archetypes.service';
import { ScytheService } from './scythe.service';
import { SiteArchetypesService } from './site-archetypes.service';

const MAX_CARDS = 5000;

class FlagsDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(MAX_CARDS) @IsInt({ each: true })
  cardIds: number[];

  @IsOptional() @IsBoolean()
  owned?: boolean;

  @IsOptional() @IsBoolean()
  wanted?: boolean;
}

class FavoriteDto {
  @IsString() @MaxLength(120)
  key: string;

  @IsBoolean()
  favorite: boolean;
}

class CoverDto {
  @IsString() @MaxLength(120)
  key: string;

  // null : couverture par défaut
  @IsOptional() @IsInt() @Min(0)
  imageId: number | null = null;
}

class CustomArchetypeDto {
  @IsString() @MinLength(1) @MaxLength(60)
  name: string;

  @IsOptional() @IsArray() @ArrayMaxSize(200) @IsString({ each: true })
  archetypes: string[] = [];

  @IsOptional() @IsArray() @ArrayMaxSize(MAX_CARDS) @IsInt({ each: true })
  cardIds: number[] = [];

  @IsOptional() @IsArray() @ArrayMaxSize(MAX_CARDS) @IsInt({ each: true })
  excludedIds: number[] = [];
}

class MergeDto {
  @IsString() @MinLength(1) @MaxLength(60)
  name: string;

  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(200) @IsString({ each: true })
  keys: string[];
}

class QueueQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  limit: number = 24;

  @IsOptional() @IsIn(['0', '1'])
  prioritize?: string;

  @IsOptional() @IsString() @MaxLength(2000)
  exclude?: string;
}

class ValidateDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(200) @IsInt({ each: true })
  seen: number[];

  @IsArray() @ArrayMaxSize(200) @IsInt({ each: true })
  found: number[];
}

class UndoDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(200) @IsInt({ each: true })
  imageIds: number[];
}

// consultable sans compte : la liste et le détail des archétypes officiels
@UseGuards(OptionalAuthGuard)
@Controller('archetypes')
export class ArchetypesController {
  constructor(private readonly archetypes: ArchetypesService) {}

  @Get()
  list(@UserId() userId: string | null) {
    return this.archetypes.list(userId);
  }

  // key en paramètre de requête : certains noms d'archétypes contiennent un "/"
  @Get('detail')
  detail(@Query('key') key: string, @UserId() userId: string | null) {
    return this.archetypes.detail(String(key ?? ''), userId);
  }
}

@UseGuards(AuthGuard)
@Controller('me')
export class CollectionController {
  constructor(
    private readonly collection: CollectionService,
    private readonly archetypes: ArchetypesService,
    private readonly customs: CustomArchetypesService,
    private readonly scythe: ScytheService,
  ) {}

  @Get('collection')
  async get(@UserId() userId: string) {
    const collection = await this.collection.load(userId);
    return { owned: [...collection.owned], wanted: [...collection.wanted], favorites: [...collection.favorites] };
  }

  @Put('collection/cards')
  async setFlags(@UserId() userId: string, @Body() dto: FlagsDto) {
    await this.collection.setFlags(userId, dto.cardIds, { owned: dto.owned, wanted: dto.wanted });
    return { ok: true };
  }

  @Put('collection/favorites')
  async setFavorite(@UserId() userId: string, @Body() dto: FavoriteDto) {
    await this.collection.setFavorite(userId, dto.key, dto.favorite);
    return { ok: true };
  }

  @Put('collection/cover')
  async setCover(@UserId() userId: string, @Body() dto: CoverDto) {
    await this.collection.setCover(userId, dto.key, dto.imageId ?? null);
    return { ok: true };
  }

  @Get('wantlist')
  wantlist(@UserId() userId: string) {
    return this.archetypes.wantlist(userId);
  }

  @Post('custom-archetypes')
  async createCustom(@UserId() userId: string, @Body() dto: CustomArchetypeDto) {
    return { key: customKey((await this.customs.create(userId, dto)).id) };
  }

  @Post('custom-archetypes/merge')
  async mergeCustom(@UserId() userId: string, @Body() dto: MergeDto) {
    return { key: customKey((await this.customs.merge(userId, dto.name, dto.keys)).id) };
  }

  @Put('custom-archetypes/:id')
  async updateCustom(@UserId() userId: string, @Param('id') id: string, @Body() dto: CustomArchetypeDto) {
    return { key: customKey((await this.customs.update(userId, id, dto)).id) };
  }

  @Delete('custom-archetypes/:id')
  async removeCustom(@UserId() userId: string, @Param('id') id: string) {
    await this.customs.remove(userId, id);
    return { ok: true };
  }

  @Get('scythe/queue')
  scytheQueue(@UserId() userId: string, @Query() query: QueueQuery) {
    return this.scythe.queue(userId, query.limit, query.prioritize === '1', parseIds(query.exclude));
  }

  @HttpCode(200)
  @Post('scythe/validate')
  async scytheValidate(@UserId() userId: string, @Body() dto: ValidateDto) {
    await this.scythe.validate(userId, dto.seen, dto.found);
    return { ok: true };
  }

  @HttpCode(200)
  @Post('scythe/undo')
  async scytheUndo(@UserId() userId: string, @Body() dto: UndoDto) {
    await this.scythe.undo(userId, dto.imageIds);
    return { ok: true };
  }
}

// archétypes du site : créés et modifiés par les admins, visibles par tous
@UseGuards(AdminGuard)
@Controller('admin/site-archetypes')
export class AdminArchetypesController {
  constructor(private readonly sites: SiteArchetypesService) {}

  @Post()
  async create(@Body() dto: CustomArchetypeDto) {
    return { key: siteKey((await this.sites.create(dto)).id) };
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: CustomArchetypeDto) {
    return { key: siteKey((await this.sites.update(id, dto)).id) };
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string) {
    await this.sites.remove(id);
  }

  @Post('merge')
  async merge(@UserId() userId: string, @Body() dto: MergeDto) {
    return { key: siteKey((await this.sites.merge(userId, dto.name, dto.keys)).id) };
  }

  // transforme un archétype perso de l'admin en archétype du site
  @Post('publish/:customId')
  async publish(@UserId() userId: string, @Param('customId') customId: string) {
    return { key: siteKey((await this.sites.publish(userId, customId)).id) };
  }
}
