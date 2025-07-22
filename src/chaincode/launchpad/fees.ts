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
import { FeeReceiptStatus } from "@gala-chain/api";
import {
  GalaChainContext,
  getObjectByKey,
  transferToken,
  txUnixTimeToDateIndexKeys,
  writeChannelPaymentReceipt,
  writeUserPaymentReceipt
} from "@gala-chain/chaincode";
import BigNumber from "bignumber.js";

import { LaunchpadFeeConfig, LaunchpadSale } from "../../api/types";
import { SlippageToleranceExceededError } from "../../api/utils/error";

const REVERSE_BONDING_CURVE_FEE_CODE = "LaunchpadReverseBondingCurveFee";
const NATIVE_TOKEN_DECIMALS = 8;

export function calculateReverseBondingCurveFee(sale: LaunchpadSale, nativeTokensToReceive: BigNumber) {
  if (
    !sale.reverseBondingCurveConfiguration ||
    sale.reverseBondingCurveConfiguration.maxFeePortion.isZero()
  ) {
    return new BigNumber(0);
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

  if (feeAmount.isZero()) {
    return; // No fee
  }

  if (maxAcceptableFee && feeAmount.isGreaterThan(maxAcceptableFee)) {
    throw new SlippageToleranceExceededError("Fee exceeds maximum acceptable amount");
  }

  const launchpadConfigKey = ctx.stub.createCompositeKey(LaunchpadFeeConfig.INDEX_KEY, []);
  const launchpadConfig = await getObjectByKey(ctx, LaunchpadFeeConfig, launchpadConfigKey);
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
  return tokensBeingTraded.multipliedBy(feeAmount ?? 0).toFixed(8, BigNumber.ROUND_UP);
}
