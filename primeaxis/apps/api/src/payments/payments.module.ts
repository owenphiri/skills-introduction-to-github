import { Module } from '@nestjs/common';
import { CryptoService } from './crypto.service';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PaypalService } from './paypal.service';
import { StripeService } from './stripe.service';
import { WebhooksController } from './webhooks.controller';

@Module({
  controllers: [PaymentsController, WebhooksController],
  providers: [PaymentsService, StripeService, PaypalService, CryptoService],
})
export class PaymentsModule {}
