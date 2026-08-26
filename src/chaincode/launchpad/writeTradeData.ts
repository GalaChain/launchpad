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
import { GalaChainContext, putChainObject } from "@gala-chain/chaincode";
import BigNumber from "bignumber.js";

import { LaunchpadTradeData } from "../../api/types";
import { fetchOrCreateLaunchpadTradeData } from "./fetchLaunchpadTradeData";

export interface IWriteTradeData {
  vaultAddress: string;
  galaVolumeTraded: BigNumber;
}

export async function writeTradeData(
  ctx: GalaChainContext,
  data: IWriteTradeData
): Promise<LaunchpadTradeData> {
  const { vaultAddress, galaVolumeTraded } = data;

  const tradeData = await fetchOrCreateLaunchpadTradeData(ctx, { vaultAddress });

  tradeData.galaVolumeTraded = tradeData.galaVolumeTraded.plus(galaVolumeTraded);
  tradeData.lastUpdated = ctx.txUnixTime;

  await putChainObject(ctx, tradeData);

  return tradeData;
}
