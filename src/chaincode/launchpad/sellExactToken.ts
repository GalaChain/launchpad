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
import { ValidationFailedError } from "@gala-chain/api";
import { GalaChainContext, fetchTokenClass, putChainObject, transferToken } from "@gala-chain/chaincode";
import { BigNumber } from "bignumber.js";

import { ExactTokenQuantityDto, TradeResDto } from "../../api/types";
import { SlippageToleranceExceededError } from "../../api/utils/error";
import { fetchAndValidateSale, fetchLaunchpadFeeAddress } from "../utils";
import { callNativeTokenOut } from "./callNativeTokenOut";
import { payReverseBondingCurveFee } from "./fees";

/**
 * Executes the sale of an exact amount of tokens for native tokens (e.g., GALA).
 *
 * This function facilitates selling a specific token amount by transferring the tokens to
 * the sale vault and providing the calculated native tokens in return. It ensures validation
 * of the sale, handles insufficient vault balances, and checks expected vs. actual native tokens.
 *
 * @param ctx - The context object providing access to the GalaChain environment.
 * @param sellTokenDTO - An object containing the sale details:
 *   - `vaultAddress`: The address of the sale.
 *   - `tokenAmount`: The exact amount of tokens to sell.
 *   - `expectedNativeToken` (optional): The expected amount of native tokens in return.
 *
 * @returns A promise that resolves to a `TradeResDto` object containing the updated
 *          balances of the seller's tokens and native tokens.
 *
 * @throws DefaultError if the expected native tokens exceed the actual amount to be provided.
 */
export async function sellExactToken(
  ctx: GalaChainContext,
  sellTokenDTO: ExactTokenQuantityDto
): Promise<TradeResDto> {
  // Fetch and validate the current sale object
  const sale = await fetchAndValidateSale(ctx, sellTokenDTO.vaultAddress);

  // Determine how much native token (e.g., GALA) the user will receive for the exact token quantity
  const callNativeTokenOutResult = await callNativeTokenOut(ctx, sellTokenDTO);
  const tokensBeingSold = new BigNumber(callNativeTokenOutResult.originalQuantity);
  const nativeTokensPayout = new BigNumber(callNativeTokenOutResult.calculatedQuantity);
  const transactionFees = callNativeTokenOutResult.extraFees.transactionFees;

  const nativeTokensLeftInVault = new BigNumber(sale.nativeTokenQuantity);
  const nativeToken = sale.fetchNativeTokenInstanceKey();
  const memeToken = sale.fetchSellingTokenInstanceKey();

  // Abort if the vault doesn't have enough native tokens to pay the user
  if (new BigNumber(sellTokenDTO.tokenQuantity).isGreaterThan(nativeTokensLeftInVault)) {
    throw new ValidationFailedError("Not enough GALA in sale contract to carry out this operation.");
  }

  // Enforce slippage tolerance: expected amount must not be greater than what will actually be received
  if (
    sellTokenDTO.expectedNativeToken &&
    sellTokenDTO.expectedNativeToken.comparedTo(nativeTokensPayout) > 0
  ) {
    throw new SlippageToleranceExceededError(
      `expected ${sellTokenDTO.expectedNativeToken.toString()}, but only ${nativeTokensPayout.toString()} tokens can be provided. Reduce the expected amount or adjust your slippage tolerance.`
    );
  }

  // The fee must be paid BEFORE the sale can happen.
  // That means you cannot pay the fee using proceeds from the sale.
  await payReverseBondingCurveFee(
    ctx,
    sale,
    nativeTokensPayout,
    sellTokenDTO.extraFees?.maxAcceptableReverseBondingCurveFee
  );

  // Transfer launchpad transaction fee if applicable
  const launchpadFeeAddressConfiguration = await fetchLaunchpadFeeAddress(ctx);
  if (launchpadFeeAddressConfiguration && transactionFees) {
    await transferToken(ctx, {
      from: ctx.callingUser,
      to: launchpadFeeAddressConfiguration.feeAddress,
      tokenInstanceKey: nativeToken,
      quantity: new BigNumber(transactionFees),
      allowancesToUse: [],
      authorizedOnBehalf: undefined
    });
  }

  // Transfer meme tokens from user to vault
  await transferToken(ctx, {
    from: ctx.callingUser,
    to: sellTokenDTO.vaultAddress,
    tokenInstanceKey: memeToken,
    quantity: tokensBeingSold,
    allowancesToUse: [],
    authorizedOnBehalf: undefined
  });

  // Transfer native tokens from vault to user
  await transferToken(ctx, {
    from: sellTokenDTO.vaultAddress,
    to: ctx.callingUser,
    tokenInstanceKey: nativeToken,
    quantity: nativeTokensPayout,
    allowancesToUse: [],
    authorizedOnBehalf: {
      callingOnBehalf: sellTokenDTO.vaultAddress,
      callingUser: ctx.callingUser
    }
  });

  // Update sale state with this transaction
  sale.sellToken(tokensBeingSold, nativeTokensPayout);
  await putChainObject(ctx, sale);

  const token = await fetchTokenClass(ctx, sale.sellingToken);
  return {
    inputQuantity: tokensBeingSold.toFixed(),
    totalFees: new BigNumber(transactionFees)
      .plus(sellTokenDTO.extraFees?.maxAcceptableReverseBondingCurveFee ?? 0)
      .toFixed(),
    outputQuantity: nativeTokensPayout.toFixed(),
    tokenName: token.name,
    tradeType: "Sell",
    vaultAddress: sellTokenDTO.vaultAddress,
    userAddress: ctx.callingUser,
    isFinalized: false,
    functionName: "SellExactToken",
    uniqueKey: sellTokenDTO.uniqueKey,
    totalTokenSold: sale.fetchTokensSold()
  };
}
