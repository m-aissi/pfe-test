import { Body, Controller, ForbiddenException, HttpCode, Post, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ArrayMaxSize, IsArray, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { Response } from 'express';
import { AuthGuard, UserId } from '../auth/auth.guard';
import { AuthService, usernameKey } from '../auth/auth.service';
import { SessionService } from '../auth/session.service';
import { BindersService } from '../binders/binders.service';
import { CollectionService } from '../collection/collection.service';
import { CustomArchetypesService } from '../collection/custom-archetypes.service';
import { ScytheService } from '../collection/scythe.service';
import { ImportInput, ImportService } from './import.service';

// le détail de chaque tableau est vérifié par ImportService
class ImportDto implements ImportInput {
  @IsOptional() @IsArray() @ArrayMaxSize(5000)
  archetypes?: ImportInput['archetypes'];

  @IsOptional() @IsArray() @ArrayMaxSize(100)
  binders?: ImportInput['binders'];

  @IsOptional() @IsObject()
  scythe?: ImportInput['scythe'];
}

class DeleteAccountDto {
  @IsString() @MaxLength(50)
  username: string;
}

@UseGuards(AuthGuard)
@Controller('me')
export class AccountController {
  constructor(
    private readonly importer: ImportService,
    private readonly auth: AuthService,
    private readonly sessions: SessionService,
    private readonly collection: CollectionService,
    private readonly customs: CustomArchetypesService,
    private readonly scythe: ScytheService,
    private readonly binders: BindersService,
  ) {}

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(200)
  @Post('import')
  import(@UserId() userId: string, @Body() dto: ImportDto) {
    return this.importer.import(userId, dto);
  }

  // supprime le compte et tout ce qui lui est rattaché ; il faut retaper son pseudo pour confirmer
  @HttpCode(200)
  @Post('delete')
  async deleteAccount(@UserId() userId: string, @Body() dto: DeleteAccountDto, @Res({ passthrough: true }) res: Response) {
    const user = await this.auth.require(userId);
    if (usernameKey(dto.username) != user.usernameLower) throw new ForbiddenException('Le pseudo ne correspond pas');
    await Promise.all([
      this.collection.deleteAll(userId),
      this.customs.deleteAll(userId),
      this.scythe.deleteAll(userId),
      this.binders.deleteAll(userId),
    ]);
    await this.auth.delete(userId);
    this.sessions.end(res);
    return { ok: true };
  }
}
