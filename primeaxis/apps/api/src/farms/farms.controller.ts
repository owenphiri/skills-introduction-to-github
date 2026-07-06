import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { FarmAccessGuard } from '../common/guards/farm-access.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { InviteMemberDto, UpsertFarmDto } from './dto/farm.dto';
import { FarmsService } from './farms.service';

@Controller('farms')
@UseGuards(JwtAuthGuard, FarmAccessGuard, RolesGuard)
export class FarmsController {
  constructor(private readonly farms: FarmsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.farms.listForUser(user.id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: UpsertFarmDto) {
    return this.farms.create(user.id, dto);
  }

  @Get(':farmId')
  get(@Param('farmId') farmId: string) {
    return this.farms.get(farmId);
  }

  @Patch(':farmId')
  @Roles('OWNER', 'MANAGER')
  update(@Param('farmId') farmId: string, @Body() dto: UpsertFarmDto) {
    return this.farms.update(farmId, dto);
  }

  @Post(':farmId/members')
  @Roles('OWNER')
  invite(@Param('farmId') farmId: string, @Body() dto: InviteMemberDto) {
    return this.farms.invite(farmId, dto);
  }

  @Delete(':farmId/members/:memberId')
  @Roles('OWNER')
  removeMember(
    @Param('farmId') farmId: string,
    @Param('memberId') memberId: string,
  ) {
    return this.farms.removeMember(farmId, memberId);
  }
}
