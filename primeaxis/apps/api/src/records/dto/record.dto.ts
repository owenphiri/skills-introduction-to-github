import { Type } from 'class-transformer';
import {
  IsDate,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

/** One day of data for one flock. Submitting twice for a date updates it. */
export class UpsertDailyRecordDto {
  @IsDate()
  @Type(() => Date)
  date: Date;

  @IsInt() @Min(0) mortality: number;
  @IsOptional() @IsInt() @Min(0) culls?: number;
  @IsNumber() @Min(0) feedKg: number;
  @IsOptional() @IsNumber() @Min(0) waterL?: number;
  @IsOptional() @IsNumber() @Min(0) avgWeightG?: number;   // broilers
  @IsOptional() @IsInt() @Min(0) eggsCollected?: number;   // layers
  @IsOptional() @IsInt() @Min(0) eggsBroken?: number;

  @IsOptional() @IsString() @MaxLength(500) notes?: string;
}

export class SensorReadingDto {
  @IsString() houseId: string;
  @IsOptional() @IsNumber() tempC?: number;
  @IsOptional() @IsNumber() humidityPct?: number;
}
