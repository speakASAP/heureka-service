import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import * as amqp from 'amqplib';
import { LoggerService, PrismaService } from '../index';

/**
 * RabbitMQ subscriber for stock events from warehouse-microservice
 * Updates local offer stock quantities when stock changes
 */
@Injectable()
export class StockEventsSubscriber implements OnModuleInit, OnModuleDestroy {
  private connection: any = null;
  private channel: amqp.Channel | null = null;
  private readonly exchangeName = 'stock.events';
  private readonly queueName = 'stock.heureka-service';

  constructor(
    private readonly logger: LoggerService,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit() {
    await this.connect();
    await this.subscribe();
  }

  async onModuleDestroy() {
    try {
      if (this.channel) {
        await (this.channel as any).close();
      }
      if (this.connection) {
        await this.connection.close();
      }
    } catch (error: unknown) {
      // Ignore errors during cleanup
    }
  }

  private async connect() {
    try {
      const url = process.env.RABBITMQ_URL || 'amqp://guest:guest@statex_rabbitmq:5672';
      this.logger.log(`Connecting to RabbitMQ: ${url}`, 'StockEventsSubscriber');

      const conn = await amqp.connect(url);
      this.connection = conn;
      const ch = await this.connection.createChannel();
      this.channel = ch as unknown as amqp.Channel;

      // Assert exchange exists
      await this.channel.assertExchange(this.exchangeName, 'topic', { durable: true });

      // Assert queue exists
      await this.channel.assertQueue(this.queueName, { durable: true });

      // Bind queue to exchange with routing key
      await this.channel.bindQueue(this.queueName, this.exchangeName, 'stock.#');

      this.logger.log('Connected to RabbitMQ and subscribed to stock events', 'StockEventsSubscriber');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to connect to RabbitMQ: ${errorMessage}`, errorStack, 'StockEventsSubscriber');
    }
  }

  private async subscribe() {
    if (!this.channel) return;

    try {
      await this.channel.consume(
        this.queueName,
        async (msg) => {
          if (!msg) return;

          try {
            const event = JSON.parse(msg.content.toString());
            await this.handleStockEvent(event);
            this.channel?.ack(msg);
          } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            const errorStack = error instanceof Error ? error.stack : undefined;
            this.logger.error(`Error processing stock event: ${errorMessage}`, errorStack, 'StockEventsSubscriber');
            this.channel?.nack(msg, false, false); // Reject and don't requeue
          }
        },
        { noAck: false }
      );

      this.logger.log('Subscribed to stock events queue', 'StockEventsSubscriber');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to subscribe to stock events: ${errorMessage}`, errorStack, 'StockEventsSubscriber');
    }
  }

  /**
   * Handle stock event from warehouse-microservice
   */
  private async handleStockEvent(event: any) {
    const { type, productId, available } = event;

    this.logger.log(`Received stock event: ${type} for product ${productId}, available: ${available}`, 'StockEventsSubscriber');

    // Update all Allegro offers linked to this product
    // This would typically update the AllegroOffer.stockQuantity field
    // and optionally sync to Allegro API if needed

    switch (type) {
      case 'stock.updated':
        // Update offer stock quantities
        await this.updateOfferStock(productId, available);
        break;
      case 'stock.low':
        // Log warning, optionally send notification
        this.logger.warn(`Low stock alert for product ${productId}: ${available} available`, 'StockEventsSubscriber');
        break;
      case 'stock.out':
        // Mark offers as out of stock, update Allegro API
        await this.handleOutOfStock(productId);
        break;
    }
  }

  /**
   * Update product inclusion in feed based on stock
   * For Heureka, we regenerate the feed when stock changes
   */
  private async updateOfferStock(productId: string, available: number) {
    try {
      // Update HeurekaProduct inclusion status based on stock
      const heurekaProduct = await this.prisma.heurekaProduct.findUnique({
        where: { productId },
      });

      if (heurekaProduct) {
        // Update inclusion status: include if stock > 0
        const shouldInclude = available > 0;
        if (heurekaProduct.isIncluded !== shouldInclude) {
          await this.prisma.heurekaProduct.update({
            where: { id: heurekaProduct.id },
            data: { isIncluded: shouldInclude },
          });

          this.logger.log(
            `Updated Heureka product ${productId} inclusion: ${shouldInclude ? 'included' : 'excluded'} (stock: ${available})`,
            'StockEventsSubscriber'
          );

          // Trigger feed regeneration (async, don't wait)
          // This could be done via a queue or scheduled job
          this.logger.log(`Feed should be regenerated for product ${productId} stock change`, 'StockEventsSubscriber');
        }
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to update Heureka product stock: ${errorMessage}`, errorStack, 'StockEventsSubscriber');
    }
  }

  /**
   * Handle out of stock event
   */
  private async handleOutOfStock(productId: string) {
    try {
      // Exclude product from feed
      await this.updateOfferStock(productId, 0);
      this.logger.warn(`Product ${productId} is out of stock - excluded from feed`, 'StockEventsSubscriber');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to handle out of stock: ${errorMessage}`, errorStack, 'StockEventsSubscriber');
    }
  }
}

