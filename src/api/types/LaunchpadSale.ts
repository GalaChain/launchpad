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
  ChainKey,
  ChainObject,
  IsUserAlias,
  StringEnumProperty,
  TokenInstanceKey,
  UserAlias
} from "@gala-chain/api";
import BigNumber from "bignumber.js";
import { Exclude, Type } from "class-transformer";
import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
  ValidateNested
} from "class-validator";
import { JSONSchema } from "class-validator-jsonschema";

import { ReverseBondingCurveConfigurationChainObject } from "./LaunchpadDtos";

export enum SaleStatus {
  UPCOMING = "Upcoming",
  ONGOING = "Ongoing",
  END = "Finished"
}

@JSONSchema({
  description: "Represents a launchpad sale, defining token quantities, pricing, and sale operations."
})
export class LaunchpadSale extends ChainObject {
  @Exclude()
  static INDEX_KEY = "GCLPS"; //GalaChain LaunchPad Sale

  @ChainKey({ position: 0 })
  @IsUserAlias()
  @IsNotEmpty()
  public vaultAddress: UserAlias;

  @StringEnumProperty(SaleStatus)
  @IsNotEmpty()
  public saleStatus: SaleStatus;

  @IsOptional()
  @IsInt()
  public saleStartTime?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  public timeUntilLaunch?: number;

  @IsNotEmpty()
  @ValidateNested()
  @Type(() => TokenInstanceKey)
  public sellingToken: TokenInstanceKey;

  @IsNotEmpty()
  @ValidateNested()
  @Type(() => TokenInstanceKey)
  public nativeToken: TokenInstanceKey;

  @IsString()
  @IsNotEmpty()
  public sellingTokenQuantity: string;

  @IsString()
  @IsNotEmpty()
  public nativeTokenQuantity: string;

  @IsUserAlias()
  @IsNotEmpty()
  public saleOwner: UserAlias;

  @BigNumberProperty()
  public basePrice: BigNumber;

  @BigNumberProperty()
  public exponentFactor: BigNumber;

  @BigNumberProperty()
  public maxSupply: BigNumber;

  @BigNumberProperty()
  public euler: BigNumber;

  @IsOptional()
  @ValidateNested()
  @Type(() => ReverseBondingCurveConfigurationChainObject)
  public reverseBondingCurveConfiguration?: ReverseBondingCurveConfigurationChainObject;

  /**
   * Optional multiplier used to scale token output (both in bonding curve calculations and initial
   * minting) while preserving the same economics and curve shape.
   */
  @IsOptional()
  @IsNumber()
  @Min(0)
  public adjustableSupplyMultiplier?: number;

  @JSONSchema({
    description:
      "The market cap has been calculated using the bonding curve equations to approximate a specific final price."
  })
  public static MARKET_CAP = "1640985.8441726";

  @JSONSchema({
    description:
      "This base price has been calculated using the bonding curve equations to ensure that a MARKET_CAP amount of " +
      "native tokens will correspond to 10 million native tokens."
  })
  public static BASE_PRICE = "16506671506650";

  @JSONSchema({
    description: "The decimals of the selling token."
  })
  public static SELLING_TOKEN_DECIMALS = 9;

  @JSONSchema({
    description: "The decimals of the native token."
  })
  public static NATIVE_TOKEN_DECIMALS = 8;

  constructor(
    vaultAddress: UserAlias,
    sellingToken: TokenInstanceKey,
    reverseBondingCurveConfiguration: ReverseBondingCurveConfigurationChainObject | undefined,
    saleOwner: UserAlias,
    saleStartTime?: number | undefined,
    adjustableSupplyMultiplier?: number
  ) {
    super();

    this.vaultAddress = vaultAddress;
    this.saleOwner = saleOwner;

    this.sellingToken = sellingToken;

    if (saleStartTime) {
      this.saleStartTime = saleStartTime;
    }

    if (this.saleStartTime !== undefined && this.saleStartTime > 0) {
      this.saleStatus = SaleStatus.UPCOMING;
    } else {
      this.saleStatus = SaleStatus.ONGOING;
    }

    if (adjustableSupplyMultiplier !== undefined) {
      this.adjustableSupplyMultiplier = adjustableSupplyMultiplier;
      this.basePrice = new BigNumber(LaunchpadSale.BASE_PRICE).dividedBy(adjustableSupplyMultiplier);
      this.exponentFactor = new BigNumber("1166069000000");
      this.maxSupply = new BigNumber("1e+7").times(adjustableSupplyMultiplier);
      this.sellingTokenQuantity = new BigNumber("1e+7").times(adjustableSupplyMultiplier).toString();
    } else {
      this.basePrice = new BigNumber(LaunchpadSale.BASE_PRICE);
      this.exponentFactor = new BigNumber("1166069000000");
      this.maxSupply = new BigNumber("1e+7");
      this.sellingTokenQuantity = "1e+7";
    }

    this.euler = new BigNumber("2.7182818284590452353602874713527");

    const nativeTokenInstance = new TokenInstanceKey();
    nativeTokenInstance.collection = "GALA";
    nativeTokenInstance.category = "Unit";
    nativeTokenInstance.type = "none";
    nativeTokenInstance.additionalKey = "none";
    nativeTokenInstance.instance = new BigNumber(0);

    this.nativeToken = nativeTokenInstance;
    this.nativeTokenQuantity = "0";
    this.reverseBondingCurveConfiguration = reverseBondingCurveConfiguration;
  }

  public buyToken(sellingTokenAmount: BigNumber, nativeTokenAmount: BigNumber) {
    const tokenLeftInVault = new BigNumber(this.sellingTokenQuantity);
    const nativeTokensLeftInVault = new BigNumber(this.nativeTokenQuantity);
    this.sellingTokenQuantity = tokenLeftInVault.minus(sellingTokenAmount).toString();
    this.nativeTokenQuantity = nativeTokensLeftInVault.plus(nativeTokenAmount).toString();
  }

  public sellToken(sellingTokenAmount: BigNumber, nativeTokenAmount: BigNumber) {
    const tokenLeftInVault = new BigNumber(this.sellingTokenQuantity);
    const nativeTokensLeftInVault = new BigNumber(this.nativeTokenQuantity);
    this.sellingTokenQuantity = tokenLeftInVault.plus(sellingTokenAmount).toString();
    this.nativeTokenQuantity = nativeTokensLeftInVault.minus(nativeTokenAmount).toString();
  }

  public fetchTokensSold() {
    const tokenLeftInVault = new BigNumber(this.sellingTokenQuantity);
    const tokensSold = new BigNumber(this.maxSupply).minus(tokenLeftInVault);
    return tokensSold.toString();
  }

  // Returns the portion of the max supply that is circulating (that is, not in the vault)
  // This is a value between 0 and 1. If a quarter of the max supply is circulating, this
  // will return 0.25
  public fetchCirculatingSupplyProportional() {
    const tokenLeftInVault = new BigNumber(this.sellingTokenQuantity);
    const graduationProgress = BigNumber(1).minus(tokenLeftInVault.dividedBy(this.maxSupply));
    return graduationProgress;
  }

  public fetchNativeTokensInVault() {
    const nativeTokenInVault = new BigNumber(this.nativeTokenQuantity);
    return nativeTokenInVault.toString();
  }

  public finalizeSale() {
    this.saleStatus = SaleStatus.END;
    this.nativeTokenQuantity = "0";
    this.sellingTokenQuantity = "0";
  }

  public fetchSellingTokenInstanceKey() {
    const tokenInstanceKey = new TokenInstanceKey();
    tokenInstanceKey.collection = this.sellingToken.collection;
    tokenInstanceKey.category = this.sellingToken.category;
    tokenInstanceKey.type = this.sellingToken.type;
    tokenInstanceKey.additionalKey = this.sellingToken.additionalKey;
    tokenInstanceKey.instance = this.sellingToken.instance;

    return tokenInstanceKey;
  }

  public fetchNativeTokenInstanceKey() {
    const tokenInstanceKey = new TokenInstanceKey();
    tokenInstanceKey.collection = this.nativeToken.collection;
    tokenInstanceKey.category = this.nativeToken.category;
    tokenInstanceKey.type = this.nativeToken.type;
    tokenInstanceKey.additionalKey = this.nativeToken.additionalKey;
    tokenInstanceKey.instance = this.nativeToken.instance;

    return tokenInstanceKey;
  }
}
