import { Module } from '@nestjs/common';
import { LoggerModule, PrismaModule } from '@heureka/shared';
import { HeurekaOperationEventService } from './operation-event.service';

@Module({
  imports: [LoggerModule, PrismaModule],
  providers: [HeurekaOperationEventService],
  exports: [HeurekaOperationEventService],
})
export class HeurekaOperationsModule {}
