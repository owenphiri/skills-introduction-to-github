import { Module } from '@nestjs/common';
import { FarmsController } from './farms.controller';
import { FarmsService } from './farms.service';

@Module({
  controllers: [FarmsController],
  providers: [FarmsService],
})
export class FarmsModule {}
