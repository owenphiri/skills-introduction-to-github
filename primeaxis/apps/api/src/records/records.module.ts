import { Module } from '@nestjs/common';
import { KpiService } from './kpi.service';
import { RecordsController } from './records.controller';
import { RecordsService } from './records.service';

@Module({
  controllers: [RecordsController],
  providers: [RecordsService, KpiService],
  exports: [KpiService],
})
export class RecordsModule {}
