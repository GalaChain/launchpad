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
import { ChainCallDTO, NotFoundError } from "@gala-chain/api";
import { GalaChainContext } from "@gala-chain/chaincode";

import { TransactionFeeResDto } from "../../api/types";
import { fetchLaunchpadFeeAddress } from "../utils";

/**
 * @dev The fetchLaunchpadFeeAmount function retrieves the configured fee amount
 *      for Launchpad transactions. If no fee configuration is found, it throws a NotFoundError.
 * @param ctx GalaChainContext – The execution context providing access to the GalaChain environment.
 * @returns TransactionFeeResDto – An object containing:
 *          - feeAmount – The configured transaction fee amount for Launchpad transactions.
 */
export async function fetchLaunchpadFeeAmount(
  ctx: GalaChainContext,
  dto: ChainCallDTO
): Promise<TransactionFeeResDto> {
  const feeConfig = await fetchLaunchpadFeeAddress(ctx);

  if (!feeConfig) {
    throw new NotFoundError("Platform fee configuration has yet to be defined. Fee amount is not available.");
  }
  return {
    feeAmount: feeConfig.feeAmount
  };
}
