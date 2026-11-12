import { Module } from '@nestjs/common';
import { BindersModule } from '../binders/binders.module';
import { CardsModule } from '../cards/cards.module';
import { CollectionModule } from '../collection/collection.module';
import { AccountController } from './account.controller';
import { ImportService } from './import.service';

// opérations qui touchent toutes les données d'un compte : import de l'ancien site, suppression du compte
@Module({
  imports: [CardsModule, CollectionModule, BindersModule],
  controllers: [AccountController],
  providers: [ImportService],
})
export class AccountModule {}
