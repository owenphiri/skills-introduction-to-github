import { Type } from 'class-transformer';
import {
  IsDate,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class UpsertHouseDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name: string;

  @IsInt()
  @Min(1)
  capacity: number;

  @IsOptional() @IsNumber() tempMinC?: number;
  @IsOptional() @IsNumber() tempMaxC?: number;
  @IsOptional() @IsNumber() humidityMaxPct?: number;
}

export class CreateFlockDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name: string;

  @IsString()
  houseId: string;

  @IsIn(['BROILER', 'LAYER', 'BREEDER'])
  type: 'BROILER' | 'LAYER' | 'BREEDER';

  @IsString()
  @MaxLength(80)
  breed: string;

  @IsInt()
  @Min(1)
  birdsPlaced: number;

  @IsDate()
  @Type(() => Date)
  placedAt: Date;

  @IsOptional()
  @IsNumber()
  @Min(0)
  costPerChick?: number;
}

export class UpdateFlockDto {
  @IsOptional() @IsString() @MaxLength(120) name?: string;
  @IsOptional() @IsIn(['ACTIVE', 'SOLD', 'DEPLETED', 'ARCHIVED'])
  status?: 'ACTIVE' | 'SOLD' | 'DEPLETED' | 'ARCHIVED';
}

export class CreateVaccinationDto {
  @IsString()
  @MaxLength(120)
  vaccine: string;

  @IsDate()
  @Type(() => Date)
  dueDate: Date;

  @IsOptional() @IsString() @MaxLength(60) method?: string;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
}
