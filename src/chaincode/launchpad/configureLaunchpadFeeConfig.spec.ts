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

import { ConfigureLaunchpadFeeAddressDto } from "../../api/types";
import { LaunchpadContract } from "../LaunchpadContract";

describe("configureLaunchpadFeeAddress", () => {
  it("should create initial fee configuration with valid inputs", async () => {
    // Given
    const { ctx, contract } = fixture(LaunchpadContract).registeredUsers(users.testUser1);

    const configDto = new ConfigureLaunchpadFeeAddressDto(
      asValidUserAlias("client|feeAddress"),
      new BigNumber("0.01"),
      [users.testUser1.identityKey]
    );
    configDto.uniqueKey = randomUniqueKey();
    const signedDto = configDto.signed(users.testUser1.privateKey);

    // When
    const response = await contract.ConfigureLaunchpadFeeAddress(ctx, signedDto);

    // Then
    expect(response.Status).toBe(1);
    expect(response.Data?.feeAddress).toBe("client|feeAddress");
    expect(response.Data?.feeAmount.toFixed()).toBe("0.01");
    expect(response.Data?.authorities).toContain(users.testUser1.identityKey);
  });

  it("should update existing fee configuration", async () => {
    // Given
    const existingConfig = new ConfigureLaunchpadFeeAddressDto(
      asValidUserAlias("client|oldFeeAddress"),
      new BigNumber("0.01"),
      [users.testUser1.identityKey]
    );
    existingConfig.uniqueKey = randomUniqueKey();
    const signedExistingDto = existingConfig.signed(users.testUser1.privateKey);

    const { ctx, contract } = fixture(LaunchpadContract).registeredUsers(users.testUser1);

    // Create initial config
    await contract.ConfigureLaunchpadFeeAddress(ctx, signedExistingDto);

    // Update with new values
    const updateDto = new ConfigureLaunchpadFeeAddressDto(
      asValidUserAlias("client|newFeeAddress"),
      new BigNumber("0.02"),
      [users.testUser1.identityKey, users.testUser2.identityKey]
    );
    updateDto.uniqueKey = randomUniqueKey();
    const signedUpdateDto = updateDto.signed(users.testUser1.privateKey);

    // When
    const response = await contract.ConfigureLaunchpadFeeAddress(ctx, signedUpdateDto);

    // Then
    expect(response.Status).toBe(1);
    expect(response.Data?.feeAddress).toBe("client|newFeeAddress");
    expect(response.Data?.feeAmount.toFixed()).toBe("0.02");
    expect(response.Data?.authorities).toContain(users.testUser2.identityKey);
  });

  it("should update only fee address when other fields are not provided", async () => {
    // Given
    const existingConfig = new ConfigureLaunchpadFeeAddressDto(
      asValidUserAlias("client|oldFeeAddress"),
      new BigNumber("0.01"),
      [users.testUser1.identityKey]
    );
    existingConfig.uniqueKey = randomUniqueKey();
    const signedExistingDto = existingConfig.signed(users.testUser1.privateKey);

    const { ctx, contract } = fixture(LaunchpadContract).registeredUsers(users.testUser1);

    // Create initial config
    await contract.ConfigureLaunchpadFeeAddress(ctx, signedExistingDto);

    // Update only fee address
    const updateDto = new ConfigureLaunchpadFeeAddressDto(asValidUserAlias("client|newOnlyAddress"));
    updateDto.uniqueKey = randomUniqueKey();
    const signedUpdateDto = updateDto.signed(users.testUser1.privateKey);

    // When
    const response = await contract.ConfigureLaunchpadFeeAddress(ctx, signedUpdateDto);

    // Then
    expect(response.Status).toBe(1);
    expect(response.Data?.feeAddress).toBe("client|newOnlyAddress");
    expect(response.Data?.feeAmount.toFixed()).toBe("0.01"); // Should remain the same
  });

  it("should update only fee amount when other fields are not provided", async () => {
    // Given
    const existingConfig = new ConfigureLaunchpadFeeAddressDto(
      asValidUserAlias("client|feeAddress"),
      new BigNumber("0.01"),
      [users.testUser1.identityKey]
    );
    existingConfig.uniqueKey = randomUniqueKey();
    const signedExistingDto = existingConfig.signed(users.testUser1.privateKey);

    const { ctx, contract } = fixture(LaunchpadContract).registeredUsers(users.testUser1);

    // Create initial config
    await contract.ConfigureLaunchpadFeeAddress(ctx, signedExistingDto);

    // Update only fee amount
    const updateDto = new ConfigureLaunchpadFeeAddressDto(undefined, new BigNumber("0.05"));
    updateDto.uniqueKey = randomUniqueKey();
    const signedUpdateDto = updateDto.signed(users.testUser1.privateKey);

    // When
    const response = await contract.ConfigureLaunchpadFeeAddress(ctx, signedUpdateDto);

    // Then
    expect(response.Status).toBe(1);
    expect(response.Data?.feeAddress).toBe("client|feeAddress"); // Should remain the same
    expect(response.Data?.feeAmount.toFixed()).toBe("0.05");
  });

  it("should handle zero fee amount configuration", async () => {
    // Given
    const { ctx, contract } = fixture(LaunchpadContract).registeredUsers(users.testUser1);

    const configDto = new ConfigureLaunchpadFeeAddressDto(
      asValidUserAlias("client|feeAddress"),
      new BigNumber("0"),
      [users.testUser1.identityKey]
    );
    configDto.uniqueKey = randomUniqueKey();
    const signedDto = configDto.signed(users.testUser1.privateKey);

    // When
    const response = await contract.ConfigureLaunchpadFeeAddress(ctx, signedDto);

    // Then
    expect(response.Status).toBe(1);
    expect(response.Data?.feeAmount.toFixed()).toBe("0");
  });

  it("should handle multiple authorities in configuration", async () => {
    // Given
    const { ctx, contract } = fixture(LaunchpadContract)
      .registeredUsers(users.testUser1, users.testUser2, users.testUser3);

    const authorities = [users.testUser1.identityKey, users.testUser2.identityKey, users.testUser3.identityKey];

    const configDto = new ConfigureLaunchpadFeeAddressDto(
      asValidUserAlias("client|feeAddress"),
      new BigNumber("0.01"),
      authorities
    );
    configDto.uniqueKey = randomUniqueKey();
    const signedDto = configDto.signed(users.testUser1.privateKey);

    // When
    const response = await contract.ConfigureLaunchpadFeeAddress(ctx, signedDto);

    // Then
    expect(response.Status).toBe(1);
    expect(response.Data?.authorities).toHaveLength(3);
    expect(response.Data?.authorities).toContain(users.testUser1.identityKey);
    expect(response.Data?.authorities).toContain(users.testUser2.identityKey);
    expect(response.Data?.authorities).toContain(users.testUser3.identityKey);
  });
});