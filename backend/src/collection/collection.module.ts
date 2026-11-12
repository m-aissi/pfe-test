import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CardsModule } from '../cards/cards.module';
import { ArchetypesService } from './archetypes.service';
import { ArchetypesController, CollectionController } from './collection.controller';
import {
  Collection, CollectionSchema, CustomArchetype, CustomArchetypeSchema, ScytheState, ScytheStateSchema,
} from './collection.schema';
import { CollectionService } from './collection.service';
import { CustomArchetypesService } from './custom-archetypes.service';
import { ScytheService } from './scythe.service';

// tout ce qu'un utilisateur coche sur les cartes : possédées, voulues, archétypes favoris et perso, chasse aux faux
@Module({
  imports: [
    CardsModule,
    MongooseModule.forFeature([
      { name: Collection.name, schema: CollectionSchema },
      { name: CustomArchetype.name, schema: CustomArchetypeSchema },
      { name: ScytheState.name, schema: ScytheStateSchema },
    ]),
  ],
  controllers: [ArchetypesController, CollectionController],
  providers: [CollectionService, CustomArchetypesService, ScytheService, ArchetypesService],
  exports: [CollectionService, CustomArchetypesService, ScytheService],
})
export class CollectionModule {}
