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
import BigNumber from "bignumber.js";

import { NativeTokenQuantityDto, TradeResDto } from "../../api/types";
import { SlippageToleranceExceededError } from "../../api/utils/error";
import { fetchAndValidateSale, fetchLaunchpadFeeAddress } from "../utils";
import { callMemeTokenIn } from "./callMemeTokenIn";
import { payReverseBondingCurveFee } from "./fees";

/**
 * Executes a sale of tokens using native tokens (e.g., GALA) in exchange for the specified token amount.
 *
 * This function handles the process of selling tokens for native tokens in the sale vault, ensuring
 * that the token amount and native token quantity are properly adjusted based on the sale vault's
 * available balance. It also checks if the expected token amount matches the actual amount required.
 *
 * @param ctx - The context object that provides access to the GalaChain environment.
 * @param sellTokenDTO - An object containing the sale details:
 *   - `vaultAddress`: The address of the sale.
 *   - `nativeTokenAmount`: The amount of native tokens to be used in the sale.
 *   - `expectedToken` (optional): The expected amount of tokens to be received in return.
 *
 * @returns A promise that resolves to a `TradeResDto` object containing the updated
 *          balances of the seller's tokens and native tokens.
 *
 * @throws DefaultError if the expected token amount is less than the actual amount required
 *         for the operation.
 */
export async function sellWithNative(
  ctx: GalaChainContext,
  sellTokenDTO: NativeTokenQuantityDto
): Promise<TradeResDto> {
  // Fetch and validate the sale object
  const sale = await fetchAndValidateSale(ctx, sellTokenDTO.vaultAddress);

  const nativeTokensLeftInVault = new BigNumber(sale.nativeTokenQuantity);

  // Cap nativeTokenQuantity to the vault balance if the requested amount exceeds it
  if (nativeTokensLeftInVault.comparedTo(sellTokenDTO.nativeTokenQuantity) < 0) {
    throw new ValidationFailedError("Not enough GALA in sale contract to carry out this operation.");
  }

  // Calculate how many tokens need to be sold to get the requested native amount
  const callMemeTokenInResult = await callMemeTokenIn(ctx, sellTokenDTO);
  const transactionFees = callMemeTokenInResult.extraFees.transactionFees;
  const tokensToSell = new BigNumber(callMemeTokenInResult.calculatedQuantity);

  const nativeToken = sale.fetchNativeTokenInstanceKey();
  const memeToken = sale.fetchSellingTokenInstanceKey();

  // Enforce slippage tolerance
  if (sellTokenDTO.expectedToken && sellTokenDTO.expectedToken.comparedTo(tokensToSell) < 0) {
    throw new SlippageToleranceExceededError(
      "Token amount expected to cost for this operation is less than the the actual amount required."
    );
  }

  // The fee must be paid BEFORE the sale can happen.
  // That means you cannot pay the fee using proceeds from the sale.
  await payReverseBondingCurveFee(
    ctx,
    sale,
    sellTokenDTO.nativeTokenQuantity,
    sellTokenDTO.extraFees?.maxAcceptableReverseBondingCurveFee
  );

  // Transfer launchpad transaction fees if applicable
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

  // Send meme tokens from user to vault
  await transferToken(ctx, {
    from: ctx.callingUser,
    to: sellTokenDTO.vaultAddress,
    tokenInstanceKey: memeToken,
    quantity: tokensToSell,
    allowancesToUse: [],
    authorizedOnBehalf: undefined
  });

  // Send native tokens from vault to user
  await transferToken(ctx, {
    from: sellTokenDTO.vaultAddress,
    to: ctx.callingUser,
    tokenInstanceKey: nativeToken,
    quantity: sellTokenDTO.nativeTokenQuantity,
    allowancesToUse: [],
    authorizedOnBehalf: {
      callingOnBehalf: sellTokenDTO.vaultAddress,
      callingUser: ctx.callingUser
    }
  });

  // Update internal sale tracking
  sale.sellToken(tokensToSell, sellTokenDTO.nativeTokenQuantity);
  await putChainObject(ctx, sale);

  const token = await fetchTokenClass(ctx, sale.sellingToken);
  return {
    inputQuantity: tokensToSell.toFixed(),
    totalFees: new BigNumber(transactionFees)
      .plus(sellTokenDTO.extraFees?.maxAcceptableReverseBondingCurveFee ?? 0)
      .toFixed(),
    outputQuantity: sellTokenDTO.nativeTokenQuantity.toFixed(),
    tokenName: token.name,
    tradeType: "Sell",
    vaultAddress: sellTokenDTO.vaultAddress,
    userAddress: ctx.callingUser,
    isFinalized: false,
    functionName: "SellWithNative",
    uniqueKey: sellTokenDTO.uniqueKey
  };
}
