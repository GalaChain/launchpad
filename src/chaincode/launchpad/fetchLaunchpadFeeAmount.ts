import { NotFoundError } from "@gala-chain/api";
import { GalaChainContext } from "@gala-chain/chaincode";

import { fetchLaunchpadFeeAddress } from "../utils";

export async function fetchLaunchpadFeeAmount(ctx: GalaChainContext): Promise<number> {
  const feeConfig = await fetchLaunchpadFeeAddress(ctx);

  if (!feeConfig) {
    throw new NotFoundError("Platform fee configuration has yet to be defined. Fee amount is not available.");
  }
  return feeConfig.feeAmount;
}
