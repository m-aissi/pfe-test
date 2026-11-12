import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CardsModule } from '../cards/cards.module';
import { ArchetypesService } from './archetypes.service';
import { AdminArchetypesController, ArchetypesController, CollectionController } from './collection.controller';
import {
  Collection, CollectionSchema, CustomArchetype, CustomArchetypeSchema, ScytheState, ScytheStateSchema, SiteArchetype, SiteArchetypeSchema,
} from './collection.schema';
import { CollectionService } from './collection.service';
import { CustomArchetypesService } from './custom-archetypes.service';
import { ScytheService } from './scythe.service';
import { SiteArchetypesService } from './site-archetypes.service';

// tout ce qu'un utilisateur coche sur les cartes : possédées, voulues, archétypes favoris et perso, chasse aux faux
@Module({
  imports: [
    CardsModule,
    MongooseModule.forFeature([
      { name: Collection.name, schema: CollectionSchema },
      { name: CustomArchetype.name, schema: CustomArchetypeSchema },
      { name: ScytheState.name, schema: ScytheStateSchema },
      { name: SiteArchetype.name, schema: SiteArchetypeSchema },
    ]),
  ],
  controllers: [ArchetypesController, CollectionController, AdminArchetypesController],
  providers: [CollectionService, CustomArchetypesService, ScytheService, ArchetypesService, SiteArchetypesService],
  exports: [CollectionService, CustomArchetypesService, ScytheService],
})
export class CollectionModule {}
