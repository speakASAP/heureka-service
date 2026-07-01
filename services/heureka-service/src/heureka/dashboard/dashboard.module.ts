import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AuthModule, ClientsModule, LoggerModule, PrismaModule } from '@heureka/shared';
import { FeedModule } from '../feed/feed.module';
import { HeurekaOperationsModule } from '../operations/operations.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [AuthModule, ClientsModule, FeedModule, HeurekaOperationsModule, HttpModule, LoggerModule, PrismaModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
