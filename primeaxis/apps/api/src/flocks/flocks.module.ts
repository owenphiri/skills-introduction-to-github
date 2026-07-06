import { Module } from '@nestjs/common';
import { FlocksController } from './flocks.controller';
import { FlocksService } from './flocks.service';

@Module({
  controllers: [FlocksController],
  providers: [FlocksService],
  exports: [FlocksService],
})
export class FlocksModule {}
