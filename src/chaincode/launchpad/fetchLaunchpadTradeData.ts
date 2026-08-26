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
  ChainError,
  ErrorCode,
  NotFoundError,
  asValidUserAlias,
  createValidChainObject
} from "@gala-chain/api";
import { GalaChainContext, getObjectByKey } from "@gala-chain/chaincode";
import BigNumber from "bignumber.js";

import { LaunchpadTradeData } from "../../api/types";

/**
 * Fetches the trade data a specific token sale (LaunchpadSale) using the sale address.
 *
 * This function retrieves the trade data object from the chain using a composite key derived
 * from the sale address. If the trade data record is not found, a newly initialized chain entry is returned.
 *
 * @param ctx - The context object providing access to the GalaChain environment.
 * @param data - An object containing the sale address:
 *   - `vaultAddress`: The address of the sale to be fetched.
 *
 * @returns A promise that resolves to a `LaunchpadTradeData` object containing details about
 *          the specified token sale.
 *
 */
export async function fetchOrCreateLaunchpadTradeData(
  ctx: GalaChainContext,
  data: { vaultAddress: string }
): Promise<LaunchpadTradeData> {
  const { vaultAddress } = data;

  const key = ctx.stub.createCompositeKey(LaunchpadTradeData.INDEX_KEY, [vaultAddress]);

  const tradeData = await getObjectByKey(ctx, LaunchpadTradeData, key).catch((e) => {
    const error = ChainError.from(e);

    if (!error.matches(ErrorCode.NOT_FOUND)) {
      throw error;
    }

    return createValidChainObject(LaunchpadTradeData, {
      vaultAddress: asValidUserAlias(vaultAddress),
      createdAt: ctx.txUnixTime,
      lastUpdated: ctx.txUnixTime,
      galaVolumeTraded: new BigNumber(0)
    });
  });

  return tradeData;
}
