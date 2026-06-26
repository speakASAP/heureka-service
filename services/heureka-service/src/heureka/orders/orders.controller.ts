import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { HeurekaOrderIngestionGuard } from './order-ingestion.guard';
import { HeurekaOrdersService } from './orders.service';

@Controller('orders')
export class HeurekaOrdersController {
  constructor(private readonly ordersService: HeurekaOrdersService) {}

  @Post('ingest')
  @UseGuards(HeurekaOrderIngestionGuard)
  async ingestOrder(@Body() body: any) {
    const result = await this.ordersService.ingestOrder(body);
    return { success: true, data: result };
  }

  @Get()
  async listOrders(@Query('forwarded') forwarded?: string) {
    const orders = await this.ordersService.listOrders(forwarded);
    return { success: true, data: orders };
  }

  @Get(':id')
  async getOrder(@Param('id') id: string) {
    const order = await this.ordersService.getOrder(id);
    return { success: true, data: order };
  }
}
