import { BadGatewayException, Controller, Get, NotFoundException, Param, Res } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Response } from 'express';
import { CardsIndex } from '../cards/cards.index';
import { IMAGE_KINDS, ImagesService } from './images.service';

@SkipThrottle()
@Controller('img')
export class ImagesController {
  constructor(
    private readonly images: ImagesService,
    private readonly index: CardsIndex,
  ) {}

  // /api/img/cards/46986414.jpg, /api/img/small/..., /api/img/cropped/...
  @Get(':kind/:file')
  async get(@Param('kind') kind: string, @Param('file') file: string, @Res() res: Response) {
    const match = /^(\d{1,12})\.jpg$/.exec(file);
    // seules les illustrations connues en base sont relayées : ce n'est pas un proxy ouvert vers ygoprodeck
    if (!IMAGE_KINDS[kind] || !match || !this.index.artworkToCard.has(Number(match[1]))) throw new NotFoundException();

    let path: string | null;
    try {
      path = await this.images.getFile(kind, Number(match[1]));
    } catch {
      throw new BadGatewayException('Image momentanément indisponible');
    }
    if (!path) throw new NotFoundException();
    res.sendFile(path, { maxAge: '365d', immutable: true });
  }
}
