import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { FarmAccessGuard } from '../common/guards/farm-access.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import {
  CreateFlockDto,
  CreateVaccinationDto,
  UpdateFlockDto,
  UpsertHouseDto,
} from './dto/flock.dto';
import { FlocksService } from './flocks.service';

@Controller('farms/:farmId')
@UseGuards(JwtAuthGuard, FarmAccessGuard, RolesGuard)
export class FlocksController {
  constructor(private readonly flocks: FlocksService) {}

  // Houses
  @Get('houses')
  listHouses(@Param('farmId') farmId: string) {
    return this.flocks.listHouses(farmId);
  }

  @Post('houses')
  @Roles('OWNER', 'MANAGER')
  createHouse(@Param('farmId') farmId: string, @Body() dto: UpsertHouseDto) {
    return this.flocks.createHouse(farmId, dto);
  }

  @Patch('houses/:houseId')
  @Roles('OWNER', 'MANAGER')
  updateHouse(
    @Param('farmId') farmId: string,
    @Param('houseId') houseId: string,
    @Body() dto: UpsertHouseDto,
  ) {
    return this.flocks.updateHouse(farmId, houseId, dto);
  }

  // Flocks
  @Get('flocks')
  listFlocks(@Param('farmId') farmId: string, @Query('status') status?: string) {
    return this.flocks.listFlocks(farmId, status);
  }

  @Post('flocks')
  @Roles('OWNER', 'MANAGER')
  createFlock(@Param('farmId') farmId: string, @Body() dto: CreateFlockDto) {
    return this.flocks.createFlock(farmId, dto);
  }

  @Get('flocks/:flockId')
  getFlock(@Param('farmId') farmId: string, @Param('flockId') flockId: string) {
    return this.flocks.getFlock(farmId, flockId);
  }

  @Patch('flocks/:flockId')
  @Roles('OWNER', 'MANAGER')
  updateFlock(
    @Param('farmId') farmId: string,
    @Param('flockId') flockId: string,
    @Body() dto: UpdateFlockDto,
  ) {
    return this.flocks.updateFlock(farmId, flockId, dto);
  }

  // Vaccinations
  @Post('flocks/:flockId/vaccinations')
  @Roles('OWNER', 'MANAGER')
  addVaccination(
    @Param('farmId') farmId: string,
    @Param('flockId') flockId: string,
    @Body() dto: CreateVaccinationDto,
  ) {
    return this.flocks.addVaccination(farmId, flockId, dto);
  }

  @Patch('vaccinations/:vaccinationId/given')
  markGiven(
    @Param('farmId') farmId: string,
    @Param('vaccinationId') vaccinationId: string,
  ) {
    return this.flocks.markVaccinationGiven(farmId, vaccinationId);
  }
}
