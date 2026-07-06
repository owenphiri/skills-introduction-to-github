import { Type } from 'class-transformer';
import {
  IsArray,
  IsDate,
  IsEmail,
  IsIn,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

const CATEGORIES = ['FEED', 'VACCINE', 'MEDICATION', 'EQUIPMENT', 'PACKAGING', 'OTHER'] as const;

export class UpsertItemDto {
  @IsString() @MinLength(1) @MaxLength(120) name: string;
  @IsIn(CATEGORIES as unknown as string[]) category: (typeof CATEGORIES)[number];
  @IsString() @MaxLength(30) unit: string;
  @IsOptional() @IsNumber() @Min(0) reorderLevel?: number;
  @IsOptional() @IsNumber() @Min(0) unitCost?: number;
  @IsOptional() @IsDate() @Type(() => Date) expiryDate?: Date;
}

export class MovementDto {
  @IsIn(['PURCHASE', 'USAGE', 'ADJUSTMENT', 'TRANSFER'])
  type: 'PURCHASE' | 'USAGE' | 'ADJUSTMENT' | 'TRANSFER';

  /** Positive number; sign is derived from type (usage subtracts). */
  @IsNumber() @Min(0.001) quantity: number;

  @IsOptional() @IsString() flockId?: string;
  @IsOptional() @IsString() @MaxLength(300) note?: string;
}

export class UpsertSupplierDto {
  @IsString() @MinLength(1) @MaxLength(120) name: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsLatitude() latitude?: number;
  @IsOptional() @IsLongitude() longitude?: number;
}

export class POLineDto {
  @IsString() itemId: string;
  @IsNumber() @Min(0.001) quantity: number;
  @IsNumber() @Min(0) unitCost: number;
}

export class CreatePODto {
  @IsString() supplierId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => POLineDto)
  lines: POLineDto[];
}
