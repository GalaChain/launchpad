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
import { asValidUserAlias, randomUniqueKey } from "@gala-chain/api";
import { fixture, users } from "@gala-chain/test";
import BigNumber from "bignumber.js";

import { FinalizeTokenAllocationDto, LaunchpadFeeConfig } from "../../api/types";
import { LaunchpadContract } from "../LaunchpadContract";

describe("finalizeTokenAllocation", () => {
  let feeConfig: LaunchpadFeeConfig;

  beforeEach(() => {
    feeConfig = new LaunchpadFeeConfig(
      asValidUserAlias("client|platformFeeAddress"),
      new BigNumber("0.01"),
      [users.testUser1.identityKey]
    );
  });

  it("should create new token allocation successfully", async () => {
    // Given
    const { ctx, contract } = fixture(LaunchpadContract)
      .registeredUsers(users.testUser1)
      .savedState(feeConfig);

    const finalizeDto = new FinalizeTokenAllocationDto(
      new BigNumber("0.02"),
      new BigNumber("0.03")
    );
    finalizeDto.uniqueKey = randomUniqueKey();
    const signedDto = finalizeDto.signed(users.testUser1.privateKey);

    // When
    const response = await contract.FinalizeTokenAllocation(ctx, signedDto);

    // Then
    expect(response.Status).toBe(1);
    expect(response.Data?.platformFeePercentage.toFixed()).toBe("0.02");
    expect(response.Data?.ownerFeePercentage.toFixed()).toBe("0.03");
  });

  it("should update existing token allocation", async () => {
    // Given - Create existing allocation first
    const { ctx, contract } = fixture(LaunchpadContract)
      .registeredUsers(users.testUser1)
      .savedState(feeConfig);

    const initialDto = new FinalizeTokenAllocationDto(
      new BigNumber("0.01"),
      new BigNumber("0.02")
    );
    initialDto.uniqueKey = randomUniqueKey();
    const signedInitialDto = initialDto.signed(users.testUser1.privateKey);

    await contract.FinalizeTokenAllocation(ctx, signedInitialDto);

    // Update with new values
    const updateDto = new FinalizeTokenAllocationDto(
      new BigNumber("0.05"),
      new BigNumber("0.06")
    );
    updateDto.uniqueKey = randomUniqueKey();
    const signedUpdateDto = updateDto.signed(users.testUser1.privateKey);

    // When
    const response = await contract.FinalizeTokenAllocation(ctx, signedUpdateDto);

    // Then
    expect(response.Status).toBe(1);
    expect(response.Data?.platformFeePercentage.toFixed()).toBe("0.05");
    expect(response.Data?.ownerFeePercentage.toFixed()).toBe("0.06");
  });

  it("should handle zero percentage allocations", async () => {
    // Given
    const { ctx, contract } = fixture(LaunchpadContract)
      .registeredUsers(users.testUser1)
      .savedState(feeConfig);

    const finalizeDto = new FinalizeTokenAllocationDto(
      new BigNumber("0"),
      new BigNumber("0")
    );
    finalizeDto.uniqueKey = randomUniqueKey();
    const signedDto = finalizeDto.signed(users.testUser1.privateKey);

    // When
    const response = await contract.FinalizeTokenAllocation(ctx, signedDto);

    // Then
    expect(response.Status).toBe(1);
    expect(response.Data?.platformFeePercentage.toFixed()).toBe("0");
    expect(response.Data?.ownerFeePercentage.toFixed()).toBe("0");
  });

  it("should handle high percentage allocations", async () => {
    // Given
    const { ctx, contract } = fixture(LaunchpadContract)
      .registeredUsers(users.testUser1)
      .savedState(feeConfig);

    const finalizeDto = new FinalizeTokenAllocationDto(
      new BigNumber("0.1"), // 10%
      new BigNumber("0.15") // 15%
    );
    finalizeDto.uniqueKey = randomUniqueKey();
    const signedDto = finalizeDto.signed(users.testUser1.privateKey);

    // When
    const response = await contract.FinalizeTokenAllocation(ctx, signedDto);

    // Then
    expect(response.Status).toBe(1);
    expect(response.Data?.platformFeePercentage.toFixed()).toBe("0.1");
    expect(response.Data?.ownerFeePercentage.toFixed()).toBe("0.15");
  });
});
