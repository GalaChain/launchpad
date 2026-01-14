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
  UserAlias,
  asValidUserAlias,
  randomUniqueKey
} from "@gala-chain/api";
import { fixture, users } from "@gala-chain/test";
import BigNumber from "bignumber.js";

import { FetchSaleDto, LaunchpadSale, ReverseBondingCurveConfigurationChainObject } from "../../api/types";
import { LaunchpadContract } from "../LaunchpadContract";
import launchpadgala from "../test/launchpadgala";

describe("fetchSaleDetails", () => {
  let launchpadGalaInstance: TokenInstance;
  let vaultAddress: UserAlias;
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
    const { ctx, contract } = fixture(LaunchpadContract).registeredUsers(users.testUser1).savedState(sale);

    const fetchSaleDto = new FetchSaleDto(vaultAddress);
    fetchSaleDto.uniqueKey = randomUniqueKey();

    const signedDto = fetchSaleDto.signed(users.testUser1.privateKey);

    // When
    const response = await contract.FetchSaleDetails(ctx, signedDto);

    // Then
    expect(response.Status).toBe(1);
    expect(response.Data?.vaultAddress).toBe(vaultAddress);
    expect(response.Data?.saleOwner).toBe(users.testUser1.identityKey);
    expect(response.Data?.sellingToken).toEqual(launchpadGalaInstance.instanceKeyObj());
  });

  it("should include timeUntilLaunch when saleStartTime is set", async () => {
    // Given
    sale.saleStartTime = Math.floor(Date.now() / 1000) + 60;
    const { ctx, contract } = fixture(LaunchpadContract).registeredUsers(users.testUser1).savedState(sale);

    const fetchSaleDto = new FetchSaleDto(vaultAddress);
    fetchSaleDto.uniqueKey = randomUniqueKey();

    const signedDto = fetchSaleDto.signed(users.testUser1.privateKey);

    // When
    const response = await contract.FetchSaleDetails(ctx, signedDto);

    // Then
    const expected = Math.max(0, (sale.saleStartTime - ctx.txUnixTime) * 1000);
    expect(response.Status).toBe(1);
    expect(response.Data?.timeUntilLaunch).toBe(expected);
  });

  it("should handle sale with existing trades", async () => {
    // Given
    sale.buyToken(new BigNumber("100"), new BigNumber("0.01"));
    const { ctx, contract } = fixture(LaunchpadContract).registeredUsers(users.testUser1).savedState(sale);

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
    sale.finalizeSale();
    const { ctx, contract } = fixture(LaunchpadContract).registeredUsers(users.testUser1).savedState(sale);

    const fetchSaleDto = new FetchSaleDto(vaultAddress);
    fetchSaleDto.uniqueKey = randomUniqueKey();

    const signedDto = fetchSaleDto.signed(users.testUser1.privateKey);

    // When
    const response = await contract.FetchSaleDetails(ctx, signedDto);

    // Then
    expect(response.Status).toBe(1);
    expect(response.Data?.saleStatus).toBe("Finished");
  });

  it("should fetch sale with reverse bonding curve configuration", async () => {
    // Given - Create sale with reverse bonding curve
    const tokenInstanceKey = new TokenInstanceKey();
    tokenInstanceKey.collection = "TestCollection";
    tokenInstanceKey.category = "TestCategory";
    tokenInstanceKey.type = "TEST";
    tokenInstanceKey.additionalKey = "test:key";
    tokenInstanceKey.instance = new BigNumber(0);

    const reverseBondingCurveConfig = new ReverseBondingCurveConfigurationChainObject(
      new BigNumber(0.02), // minFeePortion
      new BigNumber(0.05) // maxFeePortion
    );

    const saleWithConfig = new LaunchpadSale(
      vaultAddress,
      tokenInstanceKey,
      reverseBondingCurveConfig,
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
    expect(response.Data?.reverseBondingCurveConfiguration?.maxFeePortion).toEqual(new BigNumber(0.05));
  });
});
