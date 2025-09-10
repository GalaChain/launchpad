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
  TokenBalance,
  TokenClass,
  TokenClassKey,
  TokenInstance,
  UserAlias,
  asValidUserAlias,
  randomUniqueKey
} from "@gala-chain/api";
import { currency, fixture, users } from "@gala-chain/test";
import BigNumber from "bignumber.js";
import { plainToInstance } from "class-transformer";

import { LaunchpadSale, NativeTokenQuantityDto } from "../../api/types";
import { LaunchpadContract } from "../LaunchpadContract";
import launchpadgala from "../test/launchpadgala";

describe("sellWithNative", () => {
  let currencyClass: TokenClass;
  let currencyInstance: TokenInstance;
  let launchpadGalaClass: TokenClass;
  let launchpadGalaInstance: TokenInstance;
  let launchpadGalaClassKey: TokenClassKey;
  let vaultAddress: UserAlias;
  let sale: LaunchpadSale;
  let salelaunchpadGalaBalance: TokenBalance;
  let saleCurrencyBalance: TokenBalance;
  let userlaunchpadGalaBalance: TokenBalance;
  let userCurrencyBalance: TokenBalance;

  beforeEach(() => {
    currencyClass = currency.tokenClass();
    currencyInstance = currency.tokenInstance();
    launchpadGalaClass = launchpadgala.tokenClass();
    launchpadGalaInstance = launchpadgala.tokenInstance();
    launchpadGalaClassKey = launchpadgala.tokenClassKey();

    vaultAddress = asValidUserAlias(`service|${launchpadGalaClassKey.toStringKey()}$launchpad`);

    // Initialize sale with manual values
    sale = new LaunchpadSale(
      vaultAddress,
      launchpadGalaInstance.instanceKeyObj(),
      undefined,
      users.testUser1.identityKey
    );

    // Create sale balances - sale needs tokens to pay out
    salelaunchpadGalaBalance = plainToInstance(TokenBalance, {
      ...launchpadgala.tokenBalance(),
      owner: vaultAddress,
      quantity: new BigNumber("1000000") // Large amount in vault
    });
    saleCurrencyBalance = plainToInstance(TokenBalance, {
      ...currency.tokenBalance(),
      owner: vaultAddress,
      quantity: new BigNumber("1000000") // Large amount in vault
    });

    // Create user balances - user needs tokens to sell
    userlaunchpadGalaBalance = plainToInstance(TokenBalance, {
      ...launchpadgala.tokenBalance(),
      owner: users.testUser1.identityKey,
      quantity: new BigNumber("10000") // User has tokens to sell
    });
    userCurrencyBalance = plainToInstance(TokenBalance, {
      ...currency.tokenBalance(),
      owner: users.testUser1.identityKey,
      quantity: new BigNumber("1000") // User has some CURRENCY tokens
    });
  });

  it("should sell tokens for native currency successfully", async () => {
    // Given - Sale needs native tokens to pay out, so simulate previous buys
    sale.buyToken(new BigNumber("10000"), new BigNumber("10")); // Users bought tokens, sale now has GALA
    const { ctx, contract } = fixture(LaunchpadContract)
      .registeredUsers(users.testUser1)
      .savedState(
        currencyClass,
        currencyInstance,
        launchpadGalaClass,
        launchpadGalaInstance,
        sale,
        salelaunchpadGalaBalance,
        saleCurrencyBalance,
        userlaunchpadGalaBalance,
        userCurrencyBalance
      );

    const sellDto = new NativeTokenQuantityDto(vaultAddress, new BigNumber("0.1"));
    sellDto.uniqueKey = randomUniqueKey();
    const signedDto = sellDto.signed(users.testUser1.privateKey);

    // When
    const response = await contract.SellWithNative(ctx, signedDto);

    // Then
    expect(response.Status).toBe(1);
    expect(response.Data).toHaveProperty("outputQuantity");
    expect(response.Data).toHaveProperty("inputQuantity", "0.1");
    expect(response.Data).toHaveProperty("isFinalized");
  });

  it("should handle small native token sell amount", async () => {
    // Given
    sale.buyToken(new BigNumber("5000"), new BigNumber("5")); // Users bought tokens, sale now has GALA
    const { ctx, contract } = fixture(LaunchpadContract)
      .registeredUsers(users.testUser1)
      .savedState(
        currencyClass,
        currencyInstance,
        launchpadGalaClass,
        launchpadGalaInstance,
        sale,
        salelaunchpadGalaBalance,
        saleCurrencyBalance,
        userlaunchpadGalaBalance,
        userCurrencyBalance
      );

    const sellDto = new NativeTokenQuantityDto(vaultAddress, new BigNumber("0.001"));
    sellDto.uniqueKey = randomUniqueKey();
    const signedDto = sellDto.signed(users.testUser1.privateKey);

    // When
    const response = await contract.SellWithNative(ctx, signedDto);

    // Then
    expect(response.Status).toBe(1);
    expect(response.Data?.inputQuantity).toBe("0.001");
    expect(new BigNumber(response.Data?.outputQuantity || "0").isFinite()).toBe(true);
  });

  it("should handle sell with expected token parameter", async () => {
    // Given
    sale.buyToken(new BigNumber("8000"), new BigNumber("8")); // Users bought tokens, sale now has GALA
    const { ctx, contract } = fixture(LaunchpadContract)
      .registeredUsers(users.testUser1)
      .savedState(
        currencyClass,
        currencyInstance,
        launchpadGalaClass,
        launchpadGalaInstance,
        sale,
        salelaunchpadGalaBalance,
        saleCurrencyBalance,
        userlaunchpadGalaBalance,
        userCurrencyBalance
      );

    const sellDto = new NativeTokenQuantityDto(vaultAddress, new BigNumber("0.05"));
    sellDto.expectedToken = new BigNumber("100"); // Set expectation for slippage protection
    sellDto.uniqueKey = randomUniqueKey();
    const signedDto = sellDto.signed(users.testUser1.privateKey);

    // When
    const response = await contract.SellWithNative(ctx, signedDto);

    // Then
    expect(response.Status).toBe(1);
    expect(response.Data?.inputQuantity).toBe("0.05");
  });

  it("should handle large native token sell amount", async () => {
    // Given
    sale.buyToken(new BigNumber("20000"), new BigNumber("20")); // Users bought tokens, sale now has GALA
    const { ctx, contract } = fixture(LaunchpadContract)
      .registeredUsers(users.testUser1)
      .savedState(
        currencyClass,
        currencyInstance,
        launchpadGalaClass,
        launchpadGalaInstance,
        sale,
        salelaunchpadGalaBalance,
        saleCurrencyBalance,
        userlaunchpadGalaBalance,
        userCurrencyBalance
      );

    const sellDto = new NativeTokenQuantityDto(vaultAddress, new BigNumber("1"));
    sellDto.uniqueKey = randomUniqueKey();
    const signedDto = sellDto.signed(users.testUser1.privateKey);

    // When
    const response = await contract.SellWithNative(ctx, signedDto);

    // Then
    expect(response.Status).toBe(1);
    expect(response.Data?.inputQuantity).toBe("1");
    expect(new BigNumber(response.Data?.outputQuantity || "0").isPositive()).toBe(true);
  });

  it("should handle edge case with vault balance limits", async () => {
    // Given
    sale.buyToken(new BigNumber("30000"), new BigNumber("1000")); // Users bought tokens, sale has GALA amount
    const { ctx, contract } = fixture(LaunchpadContract)
      .registeredUsers(users.testUser1)
      .savedState(
        currencyClass,
        currencyInstance,
        launchpadGalaClass,
        launchpadGalaInstance,
        sale,
        salelaunchpadGalaBalance,
        saleCurrencyBalance,
        userlaunchpadGalaBalance,
        userCurrencyBalance
      );

    // Try to sell amount that exceeds what's in the vault
    const sellDto = new NativeTokenQuantityDto(vaultAddress, new BigNumber("10"));
    sellDto.uniqueKey = randomUniqueKey();
    const signedDto = sellDto.signed(users.testUser1.privateKey);

    // When
    const response = await contract.SellWithNative(ctx, signedDto);

    // Then
    expect(response.Status).toBe(1);
    expect(response.Data?.inputQuantity).toBeDefined();
  });
});
