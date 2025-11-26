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
import {
  GalaChainContext,
  fetchOrCreateBalance,
  fetchTokenClass,
  putChainObject,
  transferToken
} from "@gala-chain/chaincode";
import BigNumber from "bignumber.js";

import { ExactTokenQuantityDto, LaunchpadSale, TradeResDto } from "../../api/types";
import { SlippageToleranceExceededError } from "../../api/utils/error";
import { fetchAndValidateSale, fetchLaunchpadFeeAddress } from "../utils";
import { callNativeTokenIn } from "./callNativeTokenIn";
import { finalizeSale } from "./finaliseSale";

/**
 * Executes the purchase of an exact amount of tokens in a token sale.
 *
 * This function validates the sale, calculates the required native tokens,
 * and performs the token transfer to complete the purchase. If the purchase
 * consumes all tokens in the sale, the sale is marked as finalized.
 *
 * @param ctx - The context object providing access to the GalaChain environment.
 * @param buyTokenDTO - The data transfer object containing the sale address,
 *                      token amount to buy, and optional expected native token amount.
 *
 * @returns A promise that resolves to a `TradeResDto` containing the updated
 *          balances of the purchased token and the native token for the buyer.
 *
 * @throws DefaultError if the expected native tokens are insufficient to complete the purchase.
 */
export async function buyExactToken(
  ctx: GalaChainContext,
  buyTokenDTO: ExactTokenQuantityDto
): Promise<TradeResDto> {
  let isSaleFinalized = false;

  // Fetch and validate the sale based on the provided vault address
  const sale = await fetchAndValidateSale(ctx, buyTokenDTO.vaultAddress);
  const tokensLeftInVault = new BigNumber(sale.sellingTokenQuantity);

  // Calculate the required amount of native tokens to buy the specified token amount
  const callNativeTokenInResult = await callNativeTokenIn(ctx, buyTokenDTO);
  const transactionFees = callNativeTokenInResult.extraFees.transactionFees;
  const tokensToBuy = new BigNumber(callNativeTokenInResult.originalQuantity);
  const nativeTokensRequired = new BigNumber(callNativeTokenInResult.calculatedQuantity);
  const nativeToken = sale.fetchNativeTokenInstanceKey();
  const memeToken = sale.fetchSellingTokenInstanceKey();

  // If the requested token amount exceeds what's available, finalise the sale
  if (tokensLeftInVault.lte(buyTokenDTO.tokenQuantity)) {
    isSaleFinalized = true;
  }

  // Ensure the expected native token amount is not less than the actual amount required
  if (
    buyTokenDTO.expectedNativeToken &&
    buyTokenDTO.expectedNativeToken.comparedTo(nativeTokensRequired) < 0
  ) {
    throw new SlippageToleranceExceededError(
      `expected ${buyTokenDTO.expectedNativeToken.toString()}, but at least ${nativeTokensRequired.toString()} are required to complete this operation. Increase the expected amount or adjust your slippage tolerance.`
    );
  }

  // Transfer transaction fees
  const launchpadFeeAddressConfiguration = await fetchLaunchpadFeeAddress(ctx);
  if (launchpadFeeAddressConfiguration && transactionFees) {
    const totalRequired = nativeTokensRequired.plus(new BigNumber(transactionFees));

    const buyerBalance = await fetchOrCreateBalance(ctx, ctx.callingUser, sale.nativeToken);
    if (buyerBalance.getQuantityTotal().lt(totalRequired)) {
      throw new ValidationFailedError(
        `Insufficient balance: Total amount required including fee is ${totalRequired}`
      );
    }
    await transferToken(ctx, {
      from: ctx.callingUser,
      to: launchpadFeeAddressConfiguration.feeAddress,
      tokenInstanceKey: nativeToken,
      quantity: new BigNumber(transactionFees),
      allowancesToUse: [],
      authorizedOnBehalf: undefined
    });
  }

  // Transfer native tokens from the buyer to the vault
  await transferToken(ctx, {
    from: ctx.callingUser,
    to: buyTokenDTO.vaultAddress,
    tokenInstanceKey: nativeToken,
    quantity: nativeTokensRequired,
    allowancesToUse: [],
    authorizedOnBehalf: undefined
  });

  // Transfer meme tokens from the vault to the buyer
  await transferToken(ctx, {
    from: buyTokenDTO.vaultAddress,
    to: ctx.callingUser,
    tokenInstanceKey: memeToken,
    quantity: tokensToBuy,
    allowancesToUse: [],
    authorizedOnBehalf: {
      callingOnBehalf: buyTokenDTO.vaultAddress,
      callingUser: ctx.callingUser
    }
  });

  // Update the sale record with the purchased token details
  sale.buyToken(tokensToBuy, nativeTokensRequired);
  await putChainObject(ctx, sale);

  // If the sale is finalized, create a V3 pool and add liquidity
  if (isSaleFinalized) {
    await finalizeSale(ctx, sale);
  }

  // Return the updated balance response
  const token = await fetchTokenClass(ctx, sale.sellingToken);
  return {
    inputQuantity: nativeTokensRequired.toFixed(),
    totalFees: transactionFees,
    outputQuantity: tokensToBuy.toFixed(),
    tokenName: token.name,
    tradeType: "Buy",
    vaultAddress: buyTokenDTO.vaultAddress,
    userAddress: ctx.callingUser,
    isFinalized: isSaleFinalized,
    functionName: "BuyExactToken",
    uniqueKey: buyTokenDTO.uniqueKey,
    totalTokenSold: sale.fetchTokensSold()
  };
}
