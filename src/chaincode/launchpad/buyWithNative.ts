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
import { GalaChainContext, fetchTokenClass, putChainObject, transferToken } from "@gala-chain/chaincode";
import { BigNumber } from "bignumber.js";

import { ExactTokenQuantityDto, LaunchpadSale, NativeTokenQuantityDto, TradeResDto } from "../../api/types";
import { SlippageToleranceExceededError } from "../../api/utils/error";
import { fetchAndValidateSale, fetchLaunchpadFeeAddress } from "../utils";
import { callMemeTokenOut } from "./callMemeTokenOut";
import { callNativeTokenIn } from "./callNativeTokenIn";
import { finalizeSale } from "./finaliseSale";

/**
 * Executes the purchase of tokens using a specified amount of native tokens.
 *
 * This function validates the sale, calculates the amount of tokens that can
 * be purchased with the provided native tokens, and performs the token transfer
 * to complete the purchase. If the purchase consumes all tokens in the sale,
 * the sale is marked as finalized.
 *
 * @param ctx - The context object providing access to the GalaChain environment.
 * @param buyTokenDTO - The data transfer object containing the sale address,
 *                      native token amount to spend, and optional expected token amount.
 *
 * @returns A promise that resolves to a `TradeResDto` containing the updated
 *          balances of the purchased token and the native token for the buyer.
 *
 * @throws DefaultError if the expected tokens to be received are less than the
 *                      actual amount provided by the operation.
 */
export async function buyWithNative(
  ctx: GalaChainContext,
  buyTokenDTO: NativeTokenQuantityDto
): Promise<TradeResDto> {
  let isSaleFinalized = false;

  // Fetch and validate sale state
  const sale = await fetchAndValidateSale(ctx, buyTokenDTO.vaultAddress);
  const tokensLeftInVault = new BigNumber(sale.sellingTokenQuantity);

  // Calculate how many tokens the user can buy and fee info
  const callMemeTokenOutResult = await callMemeTokenOut(ctx, buyTokenDTO);
  let transactionFees = callMemeTokenOutResult.extraFees.transactionFees;
  let tokensToBuy = new BigNumber(callMemeTokenOutResult.calculatedQuantity);

  const nativeToken = sale.fetchNativeTokenInstanceKey();
  const memeToken = sale.fetchSellingTokenInstanceKey();

  // If vault has fewer tokens than what user wants to buy, cap the purchase
  if (tokensLeftInVault.comparedTo(tokensToBuy) <= 0) {
    tokensToBuy = tokensLeftInVault;
    const nativeTokensrequiredToBuyDto = new ExactTokenQuantityDto(buyTokenDTO.vaultAddress, tokensToBuy);
    const callNativeTokenInResult = await callNativeTokenIn(ctx, nativeTokensrequiredToBuyDto);
    transactionFees = callMemeTokenOutResult.extraFees.transactionFees;
    buyTokenDTO.nativeTokenQuantity = new BigNumber(callNativeTokenInResult.calculatedQuantity);
    isSaleFinalized = true;
  }

  // Finalize sale if market cap is reached
  if (
    buyTokenDTO.nativeTokenQuantity
      .plus(new BigNumber(sale.nativeTokenQuantity))
      .gte(new BigNumber(LaunchpadSale.MARKET_CAP))
  )
    isSaleFinalized = true;

  // Check for slippage condition
  if (buyTokenDTO.expectedToken && buyTokenDTO.expectedToken.comparedTo(tokensToBuy) > 0) {
    throw new SlippageToleranceExceededError(
      "Tokens expected from this operation are more than the the actual amount that will be provided."
    );
  }

  // Transfer transaction fees to launchpad fee address
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

  // Transfer native tokens from buyer to vault
  await transferToken(ctx, {
    from: ctx.callingUser,
    to: buyTokenDTO.vaultAddress,
    tokenInstanceKey: nativeToken,
    quantity: buyTokenDTO.nativeTokenQuantity,
    allowancesToUse: [],
    authorizedOnBehalf: undefined
  });

  // Transfer meme tokens from vault to buyer
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

  // Update sale object with purchase data
  sale.buyToken(tokensToBuy, buyTokenDTO.nativeTokenQuantity);
  await putChainObject(ctx, sale);

  // Finalize sale if it's complete
  if (isSaleFinalized) {
    await finalizeSale(ctx, sale);
  }

  const token = await fetchTokenClass(ctx, sale.sellingToken);
  return {
    inputQuantity: buyTokenDTO.nativeTokenQuantity.toFixed(),
    totalFees: transactionFees,
    outputQuantity: tokensToBuy.toFixed(),
    tokenName: token.name,
    tradeType: "Buy",
    vaultAddress: buyTokenDTO.vaultAddress,
    userAddress: ctx.callingUser,
    isFinalized: isSaleFinalized,
    functionName: "BuyWithNative"
  };
}
