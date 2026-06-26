import { Module } from '@nestjs/common';
import { ClientsModule, PrismaModule } from '@heureka/shared';
import { HeurekaOrdersController } from './orders.controller';
import { HeurekaOrderIngestionGuard } from './order-ingestion.guard';
import { HeurekaOrdersService } from './orders.service';

@Module({
  imports: [PrismaModule, ClientsModule],
  controllers: [HeurekaOrdersController],
  providers: [HeurekaOrdersService, HeurekaOrderIngestionGuard],
  exports: [HeurekaOrdersService],
})
export class HeurekaOrdersModule {}
