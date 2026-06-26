import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { timingSafeEqual } from 'crypto';

@Injectable()
export class HeurekaOrderIngestionGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const configuredToken = (
      process.env.HEUREKA_INTERNAL_SERVICE_TOKEN ||
      process.env.INTERNAL_SERVICE_TOKEN ||
      process.env.JWT_TOKEN ||
      ''
    ).trim();
    const providedToken = String(request.headers['x-internal-service-token'] || '').trim();
    const serviceName = String(request.headers['x-service-name'] || '').trim();

    if (!configuredToken || serviceName !== 'heureka-service' || !providedToken || !this.safeEqual(providedToken, configuredToken)) {
      throw new UnauthorizedException('Missing or invalid Heureka order ingestion service token');
    }
    return true;
  }

  private safeEqual(a: string, b: string): boolean {
    const left = Buffer.from(a);
    const right = Buffer.from(b);
    return left.length === right.length && timingSafeEqual(left, right);
  }
}
