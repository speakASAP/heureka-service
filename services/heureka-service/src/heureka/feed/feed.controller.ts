import { Controller, Get, Post, Query, Res, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { FeedService } from './feed.service';

@Controller('feed')
export class FeedController {
  constructor(private readonly feedService: FeedService) {}

  @Get()
  async getFeed(@Query('type') type: string = 'heureka_cz', @Res() res: Response) {
    try {
      const result = await this.feedService.generateFeedWithLifecycle(type);
      res.setHeader('Content-Type', 'application/xml; charset=utf-8');
      res.setHeader('X-Heureka-Feed-Status', result.validation.status);
      res.setHeader('X-Heureka-Feed-Generation-Ms', String(result.validation.generationMs));
      res.setHeader('X-Heureka-Feed-Snapshot-Hash', result.validation.snapshotHash);
      res.send(result.xml);
    } catch (error: any) {
      const status = typeof error.getStatus === 'function' ? error.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
      res.status(status).json({ success: false, message: error.response?.message || error.message, validation: error.response?.validation });
    }
  }

  @Get('download')
  async downloadFeed(@Query('type') type: string = 'heureka_cz', @Res() res: Response) {
    try {
      const result = await this.feedService.generateFeedWithLifecycle(type);
      res.setHeader('Content-Type', 'application/xml; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="heureka-${type}.xml"`);
      res.setHeader('X-Heureka-Feed-Status', result.validation.status);
      res.setHeader('X-Heureka-Feed-Generation-Ms', String(result.validation.generationMs));
      res.setHeader('X-Heureka-Feed-Snapshot-Hash', result.validation.snapshotHash);
      res.send(result.xml);
    } catch (error: any) {
      const status = typeof error.getStatus === 'function' ? error.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
      res.status(status).json({ success: false, message: error.response?.message || error.message, validation: error.response?.validation });
    }
  }

  @Post('regenerate')
  async regenerateFeed(@Query('type') type: string = 'heureka_cz') {
    const result = await this.feedService.regenerateFeedWithLifecycle(type);
    return { success: true, message: 'Feed regenerated successfully', feedLength: result.xml.length, validation: result.validation };
  }

  @Get('history')
  async getHistory(@Query('type') type?: string) {
    const history = await this.feedService.getFeedHistory(type);
    return { success: true, data: history };
  }

  @Get('status')
  async getStatus(@Query('type') type: string = 'heureka_cz') {
    const status = await this.feedService.getFeedStatus(type);
    return { success: true, data: status };
  }
}
