import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Card, CardSchema, Meta, MetaSchema } from './card.schema';
import { CardsSyncService } from './cards-sync.service';
import { CardsController } from './cards.controller';
import { CardsIndex } from './cards.index';
import { CardsService } from './cards.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Card.name, schema: CardSchema },
      { name: Meta.name, schema: MetaSchema },
    ]),
  ],
  controllers: [CardsController],
  providers: [CardsService, CardsIndex, CardsSyncService],
  exports: [CardsService, CardsIndex],
})
export class CardsModule {}
