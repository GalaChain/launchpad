/*
 * Copyright (c) Gala Games Inc. All rights reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import {
  BigNumberProperty,
  ChainCallDTO,
  ChainObject,
  IsUserAlias,
  SubmitCallDTO,
  TokenBalance,
  UserAlias
} from "@gala-chain/api";
import BigNumber from "bignumber.js";
import { Type } from "class-transformer";
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested
} from "class-validator";

import { BigNumberIsNotNegative, BigNumberLessThanOrEqualOther, BigNumberMax } from "../validators";
import { IsNonZeroBigNumber } from "../validators";

export class ReverseBondingCurveConfigurationChainObject extends ChainObject {
  @BigNumberProperty()
  @BigNumberIsNotNegative()
  @BigNumberMax("0.5")
  @BigNumberLessThanOrEqualOther("maxFeePortion")
  minFeePortion: BigNumber;

  @BigNumberProperty()
  @BigNumberIsNotNegative()
  @BigNumberMax("0.5")
  maxFeePortion: BigNumber;

  constructor(minFeePortion: BigNumber, maxFeePortion: BigNumber) {
    super();
    this.minFeePortion = minFeePortion;
    this.maxFeePortion = maxFeePortion;
  }
}

export class ReverseBondingCurveConfigurationDto extends ChainCallDTO {
  @BigNumberProperty()
  @BigNumberIsNotNegative()
  @BigNumberMax("0.5")
  @BigNumberLessThanOrEqualOther("maxFeePortion")
  minFeePortion: BigNumber;

  @BigNumberProperty()
  @BigNumberIsNotNegative()
  @BigNumberMax("0.5")
  maxFeePortion: BigNumber;

  toChainObject(): ReverseBondingCurveConfigurationChainObject {
    return new ReverseBondingCurveConfigurationChainObject(this.minFeePortion, this.maxFeePortion);
  }
}

export class CreateTokenSaleDTO extends SubmitCallDTO {
  @IsString()
  @IsNotEmpty()
  public tokenName: string;

  @IsString()
  @IsNotEmpty()
  public tokenSymbol: string;

  @IsString()
  @IsNotEmpty()
  public tokenDescription: string;

  @IsString()
  @IsNotEmpty()
  public tokenCollection: string;

  @IsString()
  @IsNotEmpty()
  public tokenCategory: string;

  @IsString()
  @IsNotEmpty()
  public tokenImage: string;

  @BigNumberProperty()
  public preBuyQuantity: BigNumber;

  @IsString()
  @IsOptional()
  public websiteUrl?: string;

  @IsString()
  @IsOptional()
  public telegramUrl?: string;

  @IsString()
  @IsOptional()
  public twitterUrl?: string;

  @IsOptional()
  @IsInt()
  public saleStartTime?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => ReverseBondingCurveConfigurationDto)
  public reverseBondingCurveConfiguration?: ReverseBondingCurveConfigurationDto;

  constructor(
    tokenName: string,
    tokenSymbol: string,
    tokenDescription: string,
    tokenImage: string,
    preBuyQuantity: BigNumber,
    tokenCollection: string,
    tokenCategory: string,
    reverseBondingCurveConfiguration?: ReverseBondingCurveConfigurationDto,
    saleStartTime?: number
  ) {
    super();
    this.tokenName = tokenName;
    this.tokenSymbol = tokenSymbol;
    this.tokenDescription = tokenDescription;
    this.tokenImage = tokenImage;
    this.preBuyQuantity = preBuyQuantity;
    this.tokenCollection = tokenCollection;
    this.tokenCategory = tokenCategory;
    this.reverseBondingCurveConfiguration = reverseBondingCurveConfiguration;

    if (saleStartTime !== undefined) {
      this.saleStartTime = saleStartTime;
    }
  }
}

export class CreateSaleResDto {
  @IsNotEmpty()
  public image: string;

  @IsNotEmpty()
  public tokenName: string;

  @IsNotEmpty()
  public symbol: string;

  @IsNotEmpty()
  public description: string;

  @IsOptional()
  public websiteUrl?: string;

  @IsOptional()
  public telegramUrl?: string;

  @IsOptional()
  public twitterUrl?: string;

  @IsNotEmpty()
  public initialBuyQuantity: string;

  @IsUserAlias()
  @IsNotEmpty()
  public vaultAddress: UserAlias;

  @IsUserAlias()
  @IsNotEmpty()
  public creatorAddress: UserAlias;

  @IsNotEmpty()
  public collection: string;

  @IsNotEmpty()
  public category: string;

  @IsNotEmpty()
  public type: string;

  @IsNotEmpty()
  public additionalKey: string;

  @IsNotEmpty()
  public functionName: string;

  @IsNotEmpty()
  @IsBoolean()
  public isFinalized: boolean;

  @IsString()
  @IsNotEmpty()
  public tokenStringKey: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ReverseBondingCurveConfigurationDto)
  public reverseBondingCurveConfiguration?: ReverseBondingCurveConfigurationDto;
}

export class TokenExtraFeesDto {
  @BigNumberProperty()
  @IsOptional()
  public maxAcceptableReverseBondingCurveFee?: BigNumber;
}

export class ExactTokenQuantityDto extends SubmitCallDTO {
  @IsUserAlias()
  @IsNotEmpty()
  public vaultAddress: UserAlias;

  @BigNumberProperty()
  @IsNonZeroBigNumber({ message: "tokenQuantity cannot be zero" })
  public tokenQuantity: BigNumber;

  @BigNumberProperty()
  @IsOptional()
  public expectedNativeToken?: BigNumber;

  @ValidateNested()
  @Type(() => TokenExtraFeesDto)
  @IsOptional()
  public extraFees?: TokenExtraFeesDto;

  constructor(vaultAddress: UserAlias, tokenQuantity: BigNumber = new BigNumber(0)) {
    super();
    this.vaultAddress = vaultAddress;
    this.tokenQuantity = tokenQuantity;
  }
}

export class NativeTokenQuantityDto extends SubmitCallDTO {
  @IsUserAlias()
  @IsNotEmpty()
  public vaultAddress: UserAlias;

  @BigNumberProperty()
  @IsNonZeroBigNumber({ message: "nativeTokenQuanity cannot be zero" })
  public nativeTokenQuantity: BigNumber;

  @BigNumberProperty()
  @IsOptional()
  public expectedToken?: BigNumber;

  @ValidateNested()
  @Type(() => TokenExtraFeesDto)
  @IsOptional()
  public extraFees?: TokenExtraFeesDto;

  @IsOptional()
  @IsBoolean()
  public IsPreMint?: boolean;

  constructor(vaultAddress: UserAlias, nativeTokenQuantity: BigNumber = new BigNumber(0)) {
    super();
    this.vaultAddress = vaultAddress;
    this.nativeTokenQuantity = nativeTokenQuantity;
  }
}

export class TradeResDto {
  @IsOptional()
  public tokenBalance?: TokenBalance;

  @IsOptional()
  public nativeTokenBalance?: TokenBalance;

  @IsOptional()
  public tokenQuantity?: string;

  @IsOptional()
  public nativeTokenAmount?: string;

  @IsNotEmpty()
  public inputQuantity: string;

  @IsNotEmpty()
  public totalFees: string;

  @IsNotEmpty()
  public outputQuantity: string;

  @IsNotEmpty()
  public tokenName: string;

  @IsNotEmpty()
  public tradeType: string;

  @IsUserAlias()
  @IsNotEmpty()
  public vaultAddress: UserAlias;

  @IsNotEmpty()
  @IsUserAlias()
  public userAddress: UserAlias;

  @IsNotEmpty()
  @IsBoolean()
  public isFinalized: boolean;

  @IsNotEmpty()
  public functionName: string;

  @IsString()
  public uniqueKey: string;

  @IsString()
  public totalTokenSold: string;
}

export class FetchSaleDto extends ChainCallDTO {
  @IsUserAlias()
  @IsNotEmpty()
  public vaultAddress: UserAlias;
  constructor(vaultAddress: UserAlias) {
    super();
    this.vaultAddress = vaultAddress;
  }
}

export class ConfigureLaunchpadFeeAddressDto extends SubmitCallDTO {
  @IsOptional()
  @IsUserAlias()
  public newPlatformFeeAddress?: UserAlias;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  public newFeeAmount?: number;

  @IsOptional()
  @IsUserAlias({ each: true })
  public newAuthorities?: UserAlias[];
}

export class FinalizeTokenAllocationDto extends SubmitCallDTO {
  @IsNumber()
  @Min(0)
  @Max(1)
  public platformFeePercentage: number;

  @IsNumber()
  @Min(0)
  @Max(1)
  public ownerFeePercentage: number;
}

export class CollectFeeAddressDto extends ChainCallDTO {
  @IsNotEmpty()
  @IsUserAlias()
  public platformFeeCollectAddress: UserAlias;
}

export class TradeCalculationResFeesDto {
  @IsNotEmpty()
  @IsString()
  reverseBondingCurve: string;

  @IsNotEmpty()
  @IsString()
  transactionFees: string;
}

export class TradeCalculationResDto {
  @IsNotEmpty()
  @IsString()
  public originalQuantity: string;

  @IsNotEmpty()
  @IsString()
  public calculatedQuantity: string;

  @ValidateNested({ each: true })
  @Type(() => TradeCalculationResFeesDto)
  public extraFees: TradeCalculationResFeesDto;
}

export class AuthorizeBatchSubmitterDto extends SubmitCallDTO {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  authorities: string[];
}

export class DeauthorizeBatchSubmitterDto extends SubmitCallDTO {
  @IsString()
  authority: string;
}

export class FetchBatchSubmitAuthoritiesDto extends ChainCallDTO {
  // No additional fields needed for fetching all authorities
}

export class BatchSubmitAuthoritiesResDto extends ChainCallDTO {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  authorities: string[];
}

export class TransactionFeeResDto {
  @IsNumber()
  feeAmount: number;
}
