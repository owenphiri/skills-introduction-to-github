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
  CreatePODto,
  MovementDto,
  UpsertItemDto,
  UpsertSupplierDto,
} from './dto/inventory.dto';
import { InventoryService } from './inventory.service';

@Controller('farms/:farmId/inventory')
@UseGuards(JwtAuthGuard, FarmAccessGuard, RolesGuard)
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get('items')
  listItems(@Param('farmId') farmId: string, @Query('category') category?: string) {
    return this.inventory.listItems(farmId, category);
  }

  @Post('items')
  @Roles('OWNER', 'MANAGER')
  createItem(@Param('farmId') farmId: string, @Body() dto: UpsertItemDto) {
    return this.inventory.createItem(farmId, dto);
  }

  @Patch('items/:itemId')
  @Roles('OWNER', 'MANAGER')
  updateItem(
    @Param('farmId') farmId: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpsertItemDto,
  ) {
    return this.inventory.updateItem(farmId, itemId, dto);
  }

  /** Workers post usage (feed scooped, doses given) from the house floor. */
  @Post('items/:itemId/movements')
  move(
    @Param('farmId') farmId: string,
    @Param('itemId') itemId: string,
    @Body() dto: MovementDto,
  ) {
    return this.inventory.move(farmId, itemId, dto);
  }

  @Get('items/:itemId/movements')
  history(@Param('farmId') farmId: string, @Param('itemId') itemId: string) {
    return this.inventory.itemHistory(farmId, itemId);
  }

  @Get('suppliers')
  listSuppliers(@Param('farmId') farmId: string) {
    return this.inventory.listSuppliers(farmId);
  }

  @Post('suppliers')
  @Roles('OWNER', 'MANAGER')
  createSupplier(@Param('farmId') farmId: string, @Body() dto: UpsertSupplierDto) {
    return this.inventory.createSupplier(farmId, dto);
  }

  @Get('purchase-orders')
  listPOs(@Param('farmId') farmId: string) {
    return this.inventory.listPOs(farmId);
  }

  @Post('purchase-orders')
  @Roles('OWNER', 'MANAGER')
  createPO(@Param('farmId') farmId: string, @Body() dto: CreatePODto) {
    return this.inventory.createPO(farmId, dto);
  }

  @Post('purchase-orders/:poId/receive')
  @Roles('OWNER', 'MANAGER')
  receivePO(@Param('farmId') farmId: string, @Param('poId') poId: string) {
    return this.inventory.receivePO(farmId, poId);
  }
}
