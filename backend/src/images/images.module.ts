import { Module } from '@nestjs/common';
import { CardsModule } from '../cards/cards.module';
import { ImagesController } from './images.controller';
import { ImagesService } from './images.service';

@Module({
  imports: [CardsModule],
  controllers: [ImagesController],
  providers: [ImagesService],
})
export class ImagesModule {}
