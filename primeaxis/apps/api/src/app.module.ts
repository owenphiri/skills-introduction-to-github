import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { FarmsModule } from './farms/farms.module';
import { FlocksModule } from './flocks/flocks.module';
import { RecordsModule } from './records/records.module';
import { InventoryModule } from './inventory/inventory.module';
import { FinanceModule } from './finance/finance.module';
import { AlertsModule } from './alerts/alerts.module';
import { RealtimeModule } from './realtime/realtime.module';
import { PaymentsModule } from './payments/payments.module';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    // Global rate limit: 100 req/min per IP. Auth endpoints tighten this
    // further with @Throttle({ default: { limit: 10, ttl: 60_000 } }).
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    PrismaModule,
    AuthModule,
    FarmsModule,
    FlocksModule,
    RecordsModule,
    InventoryModule,
    FinanceModule,
    AlertsModule,
    RealtimeModule,
    PaymentsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule {}
