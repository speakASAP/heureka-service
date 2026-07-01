import { Module } from '@nestjs/common';
import { AuthModule, ClientsModule, PrismaModule } from '@heureka/shared';
import { HeurekaOrdersController } from './orders.controller';
import { HeurekaOrderIngestionGuard } from './order-ingestion.guard';
import { HeurekaOperationsModule } from '../operations/operations.module';
import { HeurekaOrdersService } from './orders.service';

@Module({
  imports: [AuthModule, PrismaModule, ClientsModule, HeurekaOperationsModule],
  controllers: [HeurekaOrdersController],
  providers: [HeurekaOrdersService, HeurekaOrderIngestionGuard],
  exports: [HeurekaOrdersService],
})
export class HeurekaOrdersModule {}
