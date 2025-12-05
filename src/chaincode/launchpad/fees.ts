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
import { FeeReceiptStatus, ValidationFailedError } from "@gala-chain/api";
import {
  GalaChainContext,
  fetchOrCreateBalance,
  transferToken,
  txUnixTimeToDateIndexKeys,
  writeChannelPaymentReceipt,
  writeUserPaymentReceipt
} from "@gala-chain/chaincode";
import BigNumber from "bignumber.js";

import { LaunchpadSale } from "../../api/types";
import { SlippageToleranceExceededError } from "../../api/utils/error";
import { fetchLaunchpadFeeAddress } from "../utils";

const REVERSE_BONDING_CURVE_FEE_CODE = "LaunchpadReverseBondingCurveFee";
const NATIVE_TOKEN_DECIMALS = LaunchpadSale.NATIVE_TOKEN_DECIMALS;

export function calculateReverseBondingCurveFee(sale: LaunchpadSale, nativeTokensToReceive: BigNumber) {
  if (
    !sale.reverseBondingCurveConfiguration ||
    sale.reverseBondingCurveConfiguration.maxFeePortion.isZero()
  ) {
    return BigNumber(0);
  }

  const circulatingSupplyProportional = sale.fetchCirculatingSupplyProportional();
  const { minFeePortion, maxFeePortion } = sale.reverseBondingCurveConfiguration;
  const feePortionDiff = maxFeePortion.minus(minFeePortion);
  const portionAboveBaseline = circulatingSupplyProportional.multipliedBy(feePortionDiff);
  const feePortion = minFeePortion.plus(portionAboveBaseline);

  const feeAmount = nativeTokensToReceive
    .multipliedBy(feePortion)
    .decimalPlaces(NATIVE_TOKEN_DECIMALS, BigNumber.ROUND_UP);

  return feeAmount;
}

export async function payReverseBondingCurveFee(
  ctx: GalaChainContext,
  sale: LaunchpadSale,
  nativeTokensToReceive: BigNumber,
  maxAcceptableFee?: BigNumber
) {
  const feeAmount = calculateReverseBondingCurveFee(sale, nativeTokensToReceive);
  const launchpadConfig = await fetchLaunchpadFeeAddress(ctx);

  if (feeAmount.isZero() || !launchpadConfig) {
    return; // No fee or no launchpad config
  }

  if (maxAcceptableFee && feeAmount.isGreaterThan(maxAcceptableFee)) {
    throw new SlippageToleranceExceededError("Fee exceeds maximum acceptable amount");
  }

  const nativeToken = sale.fetchNativeTokenInstanceKey();
  const { year, month, day } = txUnixTimeToDateIndexKeys(ctx.txUnixTime);
  const txId = ctx.stub.getTxID();

  await writeChannelPaymentReceipt(ctx, {
    year,
    month,
    day,
    feeCode: REVERSE_BONDING_CURVE_FEE_CODE,
    paidByUser: ctx.callingUser,
    txId,
    quantity: feeAmount,
    status: FeeReceiptStatus.Settled
  });

  await writeUserPaymentReceipt(ctx, {
    paidByUser: ctx.callingUser,
    year,
    month,
    day,
    feeCode: REVERSE_BONDING_CURVE_FEE_CODE,
    txId,
    quantity: feeAmount,
    status: FeeReceiptStatus.Settled
  });

  await transferToken(ctx, {
    to: launchpadConfig.feeAddress,
    from: ctx.callingUser,
    tokenInstanceKey: nativeToken,
    quantity: feeAmount,
    allowancesToUse: [],
    authorizedOnBehalf: undefined
  });
}

export function calculateTransactionFee(tokensBeingTraded: BigNumber, feeAmount?: number) {
  return tokensBeingTraded.multipliedBy(feeAmount ?? 0).toFixed(NATIVE_TOKEN_DECIMALS, BigNumber.ROUND_UP);
}

/**
 * Transfers transaction fees to the launchpad fee address if applicable.
 * Optionally validates that the user has sufficient balance when nativeTokensRequired is provided.
 *
 * @param ctx - The context object providing access to the GalaChain environment.
 * @param sale - The launchpad sale object.
 * @param transactionFees - The transaction fees amount (as BigNumber or string).
 * @param nativeToken - The native token instance key (returned from sale.fetchNativeTokenInstanceKey()).
 * @param nativeTokensRequired - Optional. If provided, validates user has sufficient balance for fees + required tokens.
 */
export async function transferTransactionFees(
  ctx: GalaChainContext,
  sale: LaunchpadSale,
  transactionFees: BigNumber | string,
  nativeToken: ReturnType<LaunchpadSale["fetchNativeTokenInstanceKey"]>,
  nativeTokensRequired?: BigNumber
): Promise<void> {
  const launchpadFeeAddressConfiguration = await fetchLaunchpadFeeAddress(ctx);
  const transactionFeesBn =
    typeof transactionFees === "string" ? new BigNumber(transactionFees) : transactionFees;

  // Check if transaction fees is greater than 0 and if the launchpad fee address configuration where
  // the fees are sent to is defined
  if (!launchpadFeeAddressConfiguration || !transactionFeesBn.isGreaterThan(0)) {
    return;
  }

  // If nativeTokensRequired is provided, validate user has sufficient balance
  if (nativeTokensRequired) {
    const totalRequired = nativeTokensRequired.plus(transactionFeesBn);
    const buyerBalance = await fetchOrCreateBalance(ctx, ctx.callingUser, sale.nativeToken);

    // Check if the buyer has sufficient balance to pay the transaction fees
    if (buyerBalance.getQuantityTotal().isLessThan(totalRequired)) {
      throw new ValidationFailedError(
        `Insufficient balance: Total amount required including fee is ${totalRequired}`
      );
    }
  }

  // Transfer transaction fees to the launchpad fee address
  await transferToken(ctx, {
    from: ctx.callingUser,
    to: launchpadFeeAddressConfiguration.feeAddress,
    tokenInstanceKey: nativeToken,
    quantity: transactionFeesBn,
    allowancesToUse: [],
    authorizedOnBehalf: undefined
  });
}
