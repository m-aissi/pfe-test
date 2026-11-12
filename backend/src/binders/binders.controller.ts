import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { IsArray, IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { AuthGuard, UserId } from '../auth/auth.guard';
import { BindersService } from './binders.service';

class BinderDto {
  @IsString() @MinLength(1) @MaxLength(60)
  name: string;

  @IsOptional() @IsBoolean()
  firstPageAlone?: boolean;

  // le contenu des cases est vérifié une à une par le service
  @IsOptional() @IsArray()
  pages?: unknown[];
}

@UseGuards(AuthGuard)
@Controller('me/binders')
export class BindersController {
  constructor(private readonly binders: BindersService) {}

  @Get()
  list(@UserId() userId: string) {
    return this.binders.list(userId);
  }

  @Post()
  create(@UserId() userId: string, @Body() dto: BinderDto) {
    return this.binders.create(userId, dto);
  }

  @Get(':id')
  get(@UserId() userId: string, @Param('id') id: string) {
    return this.binders.get(userId, id);
  }

  @Put(':id')
  save(@UserId() userId: string, @Param('id') id: string, @Body() dto: BinderDto) {
    return this.binders.save(userId, id, dto);
  }

  @Delete(':id')
  async remove(@UserId() userId: string, @Param('id') id: string) {
    await this.binders.remove(userId, id);
    return { ok: true };
  }
}
