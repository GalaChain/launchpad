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
import { fetchAndValidateSale, fetchLaunchpadFeeAddress, getBondingConstants } from "../utils";
import { calculateTransactionFee } from "./fees";

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
  if (!buyTokenDTO.IsPreMint) {
    const sale = await fetchAndValidateSale(ctx, buyTokenDTO.vaultAddress);
    totalTokensSold = new Decimal(sale.fetchTokensSold());

    // Enforce market cap limit
    if (
      nativeTokens
        .add(new Decimal(sale.nativeTokenQuantity))
        .greaterThan(new Decimal(LaunchpadSale.MARKET_CAP))
    ) {
      nativeTokens = new Decimal(LaunchpadSale.MARKET_CAP).minus(new Decimal(sale.nativeTokenQuantity));
    }
  }

  // Load bonding curve constants
  const basePrice = new Decimal(LaunchpadSale.BASE_PRICE);
  const { exponentFactor, euler, decimals } = getBondingConstants();

  // Apply bonding curve math
  const constant = nativeTokens.mul(exponentFactor).div(basePrice);
  const exponent1 = exponentFactor.mul(totalTokensSold).div(decimals);
  const eResult1 = euler.pow(exponent1);
  const ethScaled = constant.add(eResult1);
  const lnEthScaled = ethScaled.ln().mul(decimals);
  const lnEthScaledBase = lnEthScaled.div(exponentFactor);
  const result = lnEthScaledBase.minus(totalTokensSold);
  let roundedResult = result.toDecimalPlaces(18, Decimal.ROUND_DOWN);

  // Cap total supply to 10 million
  if (roundedResult.add(totalTokensSold).greaterThan(new Decimal("1e+7"))) {
    roundedResult = new Decimal("1e+7").minus(new Decimal(totalTokensSold));
  }

  // Fetch fee configuration and return result
  const launchpadFeeAddressConfiguration = await fetchLaunchpadFeeAddress(ctx);

  return {
    originalQuantity: nativeTokens.toFixed(),
    calculatedQuantity: roundedResult.toFixed(),
    extraFees: {
      reverseBondingCurve: "0",
      transactionFees: calculateTransactionFee(
        BigNumber(nativeTokens.toFixed()),
        launchpadFeeAddressConfiguration?.feeAmount
      )
    }
  };
}
