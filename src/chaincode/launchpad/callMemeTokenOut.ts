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
import { GalaChainContext } from "@gala-chain/chaincode";
import BigNumber from "bignumber.js";
import Decimal from "decimal.js";

import { LaunchpadSale, NativeTokenQuantityDto, TradeCalculationResDto } from "../../api/types";
import {
  fetchAndValidateSale,
  fetchLaunchpadFeeAddress,
  fetchTokenDecimals,
  getBondingConstants
} from "../utils";
import { calculateTransactionFee } from "./fees";

function calculateTokensPurchasable(
  nativeTokens: Decimal,
  totalTokensSold: Decimal,
  nativeTokenDecimals: number,
  sellingTokenDecimals: number,
  adjustableSupplyMultiplier?: number
): [string, string] {
  const basePrice =
    adjustableSupplyMultiplier && adjustableSupplyMultiplier > 0
      ? new Decimal(LaunchpadSale.BASE_PRICE).dividedBy(adjustableSupplyMultiplier)
      : new Decimal(LaunchpadSale.BASE_PRICE);

  const { exponentFactor, euler, decimals } = getBondingConstants(adjustableSupplyMultiplier);

  // Round native tokens, then calculate tokens based on that rounded amount
  const roundedNativeTokens = nativeTokens.toDecimalPlaces(nativeTokenDecimals, Decimal.ROUND_UP);

  // Calculate tokens purchasable:
  // newTokens = (decimals / exponentFactor) *
  // ln(
  //   (nativeTokens * exponentFactor / basePrice) +
  //   e^(exponentFactor * totalTokensSold / decimals)
  // ) -
  // totalTokensSold
  // Where:
  //   constant = nativeTokens * exponentFactor / basePrice
  //   exponent1 = exponentFactor * totalTokensSold / decimals
  //   eResult1 = e^(exponent1) = e^(exponentFactor * totalTokensSold / decimals)
  //   ethScaled = constant + eResult1 = (nativeTokens * exponentFactor / basePrice) + e^(exponentFactor * totalTokensSold / decimals)
  //   lnEthScaled = ln(ethScaled) * decimals
  //   lnEthScaledBase = lnEthScaled / exponentFactor = (decimals / exponentFactor) * ln(ethScaled)
  //   result = lnEthScaledBase - totalTokensSold
  const constant = roundedNativeTokens.mul(exponentFactor).div(basePrice);
  const exponent1 = exponentFactor.mul(totalTokensSold).div(decimals);
  const eResult1 = euler.pow(exponent1);
  const ethScaled = constant.add(eResult1);
  const lnEthScaled = ethScaled.ln().mul(decimals);
  const lnEthScaledBase = lnEthScaled.div(exponentFactor);
  const result = lnEthScaledBase.minus(totalTokensSold);
  let roundedResult = result.toDecimalPlaces(sellingTokenDecimals, Decimal.ROUND_DOWN);

  // Cap total supply
  const supplyCap = adjustableSupplyMultiplier
    ? new BigNumber(1e7).times(adjustableSupplyMultiplier).toString()
    : "1e+7";

  if (roundedResult.add(totalTokensSold).greaterThan(new Decimal(supplyCap))) {
    roundedResult = new Decimal(supplyCap).minus(new Decimal(totalTokensSold));
  }

  return [roundedNativeTokens.toFixed(), roundedResult.toFixed()];
}

/**
 * Calculates the number of tokens that can be purchased using a specified amount
 * of native tokens based on a bonding curve mechanism.
 *
 * This function retrieves the sale details and applies the bonding curve formula
 * to determine the number of tokens the user can buy with the provided native token amount.
 *
 * @param ctx - The context object providing access to the GalaChain environment.
 * @param buyTokenDTO - The data transfer object containing the sale address
 *                      and the amount of native tokens to spend for the purchase.
 *
 * @returns A promise that resolves to a TradeCalculationResDto object containing the calculated
 * quantity of tokens to be received, the original quantity of native tokens used, and extra fees.
 *
 * @throws Error if the calculation results in an invalid state.
 */
export async function callMemeTokenOut(
  ctx: GalaChainContext,
  buyTokenDTO: NativeTokenQuantityDto
): Promise<TradeCalculationResDto> {
  // Convert input amount to Decimal
  let nativeTokens = new Decimal(buyTokenDTO.nativeTokenQuantity.toString());

  // Initialize total tokens sold
  let totalTokensSold = new Decimal(0);

  // Fetch sale details and update parameters if this is not a sale premint calculation
  let sale: LaunchpadSale | undefined;
  if (!buyTokenDTO.IsPreMint) {
    sale = await fetchAndValidateSale(ctx, buyTokenDTO.vaultAddress);
    totalTokensSold = new Decimal(sale.fetchTokensSold());

    // Enforce market cap limit, adjust number of native tokens that will be used in the transaction
    // if total GALA tokens will exceed the market cap
    if (
      nativeTokens
        .add(new Decimal(sale.nativeTokenQuantity))
        .greaterThan(new Decimal(LaunchpadSale.MARKET_CAP))
    ) {
      nativeTokens = new Decimal(LaunchpadSale.MARKET_CAP).minus(new Decimal(sale.nativeTokenQuantity));
    }
  }

  // Get token decimals for rounding
  const { nativeTokenDecimals, sellingTokenDecimals } = sale
    ? await fetchTokenDecimals(ctx, sale)
    : {
        nativeTokenDecimals: LaunchpadSale.NATIVE_TOKEN_DECIMALS,
        sellingTokenDecimals: LaunchpadSale.SELLING_TOKEN_DECIMALS
      };

  // Calculate tokens purchasable using bonding curve math
  const [originalQuantity, calculatedQuantity] = calculateTokensPurchasable(
    nativeTokens,
    totalTokensSold,
    nativeTokenDecimals,
    sellingTokenDecimals,
    sale?.adjustableSupplyMultiplier
  );

  // Fetch fee configuration and return result
  const launchpadFeeAddressConfiguration = await fetchLaunchpadFeeAddress(ctx);

  return {
    originalQuantity: originalQuantity,
    calculatedQuantity: calculatedQuantity,
    extraFees: {
      reverseBondingCurve: "0",
      transactionFees: calculateTransactionFee(
        BigNumber(originalQuantity),
        launchpadFeeAddressConfiguration?.feeAmount
      )
    }
  };
}
