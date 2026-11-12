import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CardsModule } from '../cards/cards.module';
import { Binder, BinderSchema } from './binder.schema';
import { BindersController } from './binders.controller';
import { BindersService } from './binders.service';

@Module({
  imports: [CardsModule, MongooseModule.forFeature([{ name: Binder.name, schema: BinderSchema }])],
  controllers: [BindersController],
  providers: [BindersService],
  exports: [BindersService],
})
export class BindersModule {}
