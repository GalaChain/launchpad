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
import { ChainError, ErrorCode, UnauthorizedError, ValidationFailedError } from "@gala-chain/api";
import { GalaChainContext } from "@gala-chain/chaincode";
import { getObjectByKey, putChainObject } from "@gala-chain/chaincode";

import { ConfigureLaunchpadFeeAddressDto, LaunchpadFeeConfig } from "../../api/types";

/**
 * Configures or updates the Launchpad platform fee settings.
 *
 * This function initializes or modifies the fee address, fee amount, and list of authorities
 * responsible for managing Launchpad platform fees. Only users from the designated curator
 * organization or authorized addresses are permitted to make these changes.
 *
 * @param ctx - The context object providing access to the GalaChain environment.
 * @param dto - The data transfer object containing the new fee address, fee amount,
 *              and optional list of new authorities.
 * @returns A promise that resolves to the updated or newly created `LaunchpadFeeConfig` object.
 */
export async function configureLaunchpadFeeAddress(
  ctx: GalaChainContext,
  dto: ConfigureLaunchpadFeeAddressDto
): Promise<LaunchpadFeeConfig> {
  // Validate input: at least one field must be present
  if (!dto.newPlatformFeeAddress && !dto.newAuthorities?.length && dto.newFeeAmount === undefined) {
    throw new ValidationFailedError("None of the input fields are present.");
  }

  const curatorOrgMsp = process.env.CURATOR_ORG_MSP ?? "CuratorOrg";

  const key = ctx.stub.createCompositeKey(LaunchpadFeeConfig.INDEX_KEY, []);

  // Attempt to fetch existing config from the chain
  let platformFeeAddress = await getObjectByKey(ctx, LaunchpadFeeConfig, key).catch((e) => {
    const chainError = ChainError.from(e);
    // Handle case where config doesn't exist yet
    if (chainError.matches(ErrorCode.NOT_FOUND)) {
      return undefined;
    } else {
      throw chainError;
    }
  });

  // Authorization check
  if (ctx.clientIdentity.getMSPID() !== curatorOrgMsp) {
    if (!platformFeeAddress || !platformFeeAddress.authorities.includes(ctx.callingUser)) {
      throw new UnauthorizedError(`CallingUser ${ctx.callingUser} is not authorized to create or update`);
    }
  }

  // If no existing config, this is the initial setup
  if (!platformFeeAddress) {
    // Require both address and fee amount on initial setup
    if (!dto.newPlatformFeeAddress || !dto.newFeeAmount) {
      throw new ValidationFailedError(
        "Must provide a launchpad platform fee address and fee amount in the initial setup of the configuration."
      );
    }
    // Create new configuration
    platformFeeAddress = new LaunchpadFeeConfig(
      dto.newPlatformFeeAddress,
      dto.newFeeAmount,
      dto.newAuthorities ?? [ctx.callingUser]
    );
  } else if (platformFeeAddress && platformFeeAddress.authorities.includes(ctx.callingUser)) {
    // Caller is authorized and updating the existing config
    platformFeeAddress.updateFeeConfig(
      dto.newPlatformFeeAddress ?? platformFeeAddress.feeAddress,
      dto.newFeeAmount ?? platformFeeAddress.feeAmount,
      dto.newAuthorities ?? platformFeeAddress.authorities
    );
  } else {
    throw new UnauthorizedError(`CallingUser ${ctx.callingUser} is not authorized to create or update`);
  }

  await putChainObject(ctx, platformFeeAddress);

  return platformFeeAddress;
}
