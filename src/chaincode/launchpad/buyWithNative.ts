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
import { TokenClass } from "@gala-chain/api";
import {
  GalaChainContext,
  fetchTokenClass,
  getObjectByKey,
  putChainObject,
  transferToken
} from "@gala-chain/chaincode";
import BigNumber from "bignumber.js";

import { LaunchpadSale, NativeTokenQuantityDto, TradeResDto } from "../../api/types";
import { SlippageToleranceExceededError } from "../../api/utils/error";
import { fetchAndValidateSale } from "../utils";
import { callMemeTokenOut } from "./callMemeTokenOut";
import { transferTransactionFees } from "./fees";
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

  // Calculate how many tokens the user can buy and fee info
  const callMemeTokenOutResult = await callMemeTokenOut(ctx, buyTokenDTO);
  const transactionFees = new BigNumber(callMemeTokenOutResult.extraFees.transactionFees); // transaction fees
  const nativeTokensRequired = new BigNumber(callMemeTokenOutResult.originalQuantity); // number of native tokens user wants to spend
  let tokensToBuy = new BigNumber(callMemeTokenOutResult.calculatedQuantity); // number of tokens user will be buying

  const nativeToken = sale.fetchNativeTokenInstanceKey();
  const memeToken = sale.fetchSellingTokenInstanceKey();

  // Round tokensToBuy based on decimals property of sellToken TokenClass entry,
  // because otherwise `transferToken()` call below will fail with
  // an INVALID_DECIMALS error.
  const { collection, category, type, additionalKey } = sale.sellingToken;

  const memeTokenClass = await getObjectByKey(
    ctx,
    TokenClass,
    TokenClass.getCompositeKeyFromParts(TokenClass.INDEX_KEY, [collection, category, type, additionalKey])
  );

  tokensToBuy = tokensToBuy.decimalPlaces(memeTokenClass.decimals);

  // If native tokens required exceeds the market cap, the sale can be finalized
  if (
    buyTokenDTO.nativeTokenQuantity
      .plus(new BigNumber(sale.nativeTokenQuantity))
      .isGreaterThanOrEqualTo(new BigNumber(LaunchpadSale.MARKET_CAP))
  ) {
    isSaleFinalized = true;
  }

  // Check for slippage condition
  if (buyTokenDTO.expectedToken && buyTokenDTO.expectedToken.isGreaterThan(tokensToBuy)) {
    throw new SlippageToleranceExceededError(
      `expected ${buyTokenDTO.expectedToken.toString()}, but only ${tokensToBuy.toString()} tokens can be provided. Reduce the expected amount or adjust your slippage tolerance.`
    );
  }

  // Transfer transaction fees to launchpad fee address
  await transferTransactionFees(ctx, sale, transactionFees, nativeToken, nativeTokensRequired);

  // Transfer native tokens from buyer to vault
  await transferToken(ctx, {
    from: ctx.callingUser,
    to: buyTokenDTO.vaultAddress,
    tokenInstanceKey: nativeToken,
    quantity: nativeTokensRequired,
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
  sale.buyToken(tokensToBuy, nativeTokensRequired);
  await putChainObject(ctx, sale);

  // Finalize sale if it's complete
  if (isSaleFinalized) {
    await finalizeSale(ctx, sale);
  }

  const token = await fetchTokenClass(ctx, sale.sellingToken);
  return {
    inputQuantity: nativeTokensRequired.toFixed(),
    totalFees: transactionFees.toFixed(),
    outputQuantity: tokensToBuy.toFixed(),
    tokenName: token.name,
    tradeType: "Buy",
    vaultAddress: buyTokenDTO.vaultAddress,
    userAddress: ctx.callingUser,
    isFinalized: isSaleFinalized,
    functionName: "BuyWithNative",
    uniqueKey: buyTokenDTO.uniqueKey,
    totalTokenSold: sale.fetchTokensSold()
  };
}
