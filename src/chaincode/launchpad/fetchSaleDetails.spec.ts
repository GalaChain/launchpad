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
  TokenInstance,
  TokenInstanceKey,
  asValidUserAlias,
  randomUniqueKey
} from "@gala-chain/api";
import { fixture, users } from "@gala-chain/test";
import BigNumber from "bignumber.js";

import { FetchSaleDto, LaunchpadSale } from "../../api/types";
import { LaunchpadContract } from "../LaunchpadContract";
import launchpadgala from "../test/launchpadgala";

describe("fetchSaleDetails", () => {
  let launchpadGalaInstance: TokenInstance;
  let vaultAddress: string;
  let sale: LaunchpadSale;

  beforeEach(() => {
    launchpadGalaInstance = launchpadgala.tokenInstance();
    vaultAddress = asValidUserAlias(`service|${launchpadgala.tokenClassKey().toStringKey()}$launchpad`);

    // Initialize sale
    sale = new LaunchpadSale(
      vaultAddress,
      launchpadGalaInstance.instanceKeyObj(),
      undefined,
      users.testUser1.identityKey
    );
  });

  it("should fetch existing sale details successfully", async () => {
    // Given
    const { ctx, contract } = fixture(LaunchpadContract)
      .registeredUsers(users.testUser1)
      .savedState(sale);

    const fetchSaleDto = new FetchSaleDto(vaultAddress);
    fetchSaleDto.uniqueKey = randomUniqueKey();

    const signedDto = fetchSaleDto.signed(users.testUser1.privateKey);

    // When
    const response = await contract.FetchSaleDetails(ctx, signedDto);

    // Then
    expect(response.Status).toBe(1);
    expect(response.Data?.vaultAddress).toBe(vaultAddress);
    expect(response.Data?.creator).toBe(users.testUser1.identityKey);
    expect(response.Data?.tokenInstanceKey).toEqual(launchpadGalaInstance.instanceKeyObj());
  });

  it("should handle sale with existing trades", async () => {
    // Given
    sale.buyToken(new BigNumber("100"), new BigNumber("0.01"));
    const { ctx, contract } = fixture(LaunchpadContract)
      .registeredUsers(users.testUser1)
      .savedState(sale);

    const fetchSaleDto = new FetchSaleDto(vaultAddress);
    fetchSaleDto.uniqueKey = randomUniqueKey();

    const signedDto = fetchSaleDto.signed(users.testUser1.privateKey);

    // When
    const response = await contract.FetchSaleDetails(ctx, signedDto);

    // Then
    expect(response.Status).toBe(1);
    expect(response.Data?.fetchTokensSold()).toBe("100");
    expect(new BigNumber(response.Data?.nativeTokenQuantity || "0").isPositive()).toBe(true);
  });

  it("should return sale with correct finalization status", async () => {
    // Given - Create finalized sale
    sale.finalize();
    const { ctx, contract } = fixture(LaunchpadContract)
      .registeredUsers(users.testUser1)
      .savedState(sale);

    const fetchSaleDto = new FetchSaleDto(vaultAddress);
    fetchSaleDto.uniqueKey = randomUniqueKey();

    const signedDto = fetchSaleDto.signed(users.testUser1.privateKey);

    // When
    const response = await contract.FetchSaleDetails(ctx, signedDto);

    // Then
    expect(response.Status).toBe(1);
    expect(response.Data?.isFinalized).toBe(true);
  });

  it("should fetch sale with reverse bonding curve configuration", async () => {
    // Given - Create sale with reverse bonding curve
    const tokenInstanceKey = new TokenInstanceKey();
    tokenInstanceKey.collection = "TestCollection";
    tokenInstanceKey.category = "TestCategory";
    tokenInstanceKey.type = "TEST";
    tokenInstanceKey.additionalKey = "test:key";
    tokenInstanceKey.instance = new BigNumber(0);

    const saleWithConfig = new LaunchpadSale(
      vaultAddress,
      tokenInstanceKey,
      { feePercentage: new BigNumber("0.05") },
      users.testUser1.identityKey
    );

    const { ctx, contract } = fixture(LaunchpadContract)
      .registeredUsers(users.testUser1)
      .savedState(saleWithConfig);

    const fetchSaleDto = new FetchSaleDto(vaultAddress);
    fetchSaleDto.uniqueKey = randomUniqueKey();

    const signedDto = fetchSaleDto.signed(users.testUser1.privateKey);

    // When
    const response = await contract.FetchSaleDetails(ctx, signedDto);

    // Then
    expect(response.Status).toBe(1);
    expect(response.Data?.reverseBondingCurveConfiguration).toBeDefined();
    expect(response.Data?.reverseBondingCurveConfiguration?.feePercentage.toFixed()).toBe("0.05");
  });
});
