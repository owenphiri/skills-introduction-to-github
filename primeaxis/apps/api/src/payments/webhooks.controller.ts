import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  Post,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { PaymentsService } from './payments.service';

/**
 * Unauthenticated by design — authenticity comes from each provider's
 * signature, verified against the RAW body (main.ts enables rawBody).
 * A bad signature throws → 400 → the provider retries → ops alarm fires.
 */
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly payments: PaymentsService) {}

  @Post('stripe')
  @HttpCode(200)
  stripe(@Req() req: RawBodyRequest<Request>, @Headers() headers: Record<string, string>) {
    return this.payments.handleWebhook('STRIPE', this.raw(req), headers);
  }

  @Post('paypal')
  @HttpCode(200)
  paypal(@Req() req: RawBodyRequest<Request>, @Headers() headers: Record<string, string>) {
    return this.payments.handleWebhook('PAYPAL', this.raw(req), headers);
  }

  @Post('coinbase')
  @HttpCode(200)
  coinbase(@Req() req: RawBodyRequest<Request>, @Headers() headers: Record<string, string>) {
    return this.payments.handleWebhook('CRYPTO', this.raw(req), headers);
  }

  private raw(req: RawBodyRequest<Request>): Buffer {
    if (!req.rawBody) throw new BadRequestException('Missing raw body');
    return req.rawBody;
  }
}
