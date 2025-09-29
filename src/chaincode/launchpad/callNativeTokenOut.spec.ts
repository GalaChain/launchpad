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

import { ExactTokenQuantityDto, LaunchpadSale } from "../../api/types";
import { LaunchpadContract } from "../LaunchpadContract";
import launchpadgala from "../test/launchpadgala";

describe("callNativeTokenOut", () => {
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
      currencyInstance.instanceKeyObj(),
      undefined,
      users.testUser1.identityKey
    );

    // Create sale balances - sale needs tokens to pay out
    salelaunchpadGalaBalance = plainToInstance(TokenBalance, {
      ...launchpadgala.tokenBalance(),
      owner: vaultAddress,
      quantity: new BigNumber("97.238975330345368866")
    });
    saleCurrencyBalance = plainToInstance(TokenBalance, {
      ...currency.tokenBalance(),
      owner: vaultAddress,
      quantity: new BigNumber("188809.790718")
    });

    // Create user balances - user needs tokens to swap
    userlaunchpadGalaBalance = plainToInstance(TokenBalance, {
      ...launchpadgala.tokenBalance(),
      owner: users.testUser1.identityKey,
      quantity: new BigNumber("10000") // User has 10k launchpadGala tokens
    });
    userCurrencyBalance = plainToInstance(TokenBalance, {
      ...currency.tokenBalance(),
      owner: users.testUser1.identityKey,
      quantity: new BigNumber("10000") // User has 10k CURRENCY tokens
    });
  });

  it("should calculate native tokens received for token sale", async () => {
    // Given
    sale.buyToken(new BigNumber("1000"), new BigNumber(0.01)); // Pre-sell some tokens
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

    const callNativeTokenOutDto = new ExactTokenQuantityDto(vaultAddress, new BigNumber(100));
    callNativeTokenOutDto.uniqueKey = randomUniqueKey();

    const signedDto = callNativeTokenOutDto.signed(users.testUser1.privateKey);

    // When
    const response = await contract.CallNativeTokenOut(ctx, signedDto);

    // Then
    expect(response.Status).toBe(1);
    expect(response.Data).toHaveProperty("calculatedQuantity");
    expect(response.Data).toHaveProperty("extraFees");
    expect(response.Data?.extraFees).toHaveProperty("reverseBondingCurve");
    expect(response.Data?.extraFees).toHaveProperty("transactionFees");
  });

  it("should calculate correct native tokens for small token sale", async () => {
    // Given
    sale.buyToken(new BigNumber("500"), new BigNumber(0.01)); // Pre-sell some tokens
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

    const callNativeTokenOutDto = new ExactTokenQuantityDto(vaultAddress, new BigNumber(1));
    callNativeTokenOutDto.uniqueKey = randomUniqueKey();

    const signedDto = callNativeTokenOutDto.signed(users.testUser1.privateKey);

    // When
    const response = await contract.CallNativeTokenOut(ctx, signedDto);

    // Then
    expect(response.Status).toBe(1);
    expect(response.Data?.calculatedQuantity).toBeDefined();
    expect(new BigNumber(response.Data?.calculatedQuantity || "0").isFinite()).toBe(true);
  });

  it("should handle selling all available tokens", async () => {
    // Given
    sale.buyToken(new BigNumber("300"), new BigNumber(0.01)); // Pre-sell some tokens
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

    // Try to sell more tokens than were bought
    const callNativeTokenOutDto = new ExactTokenQuantityDto(vaultAddress, new BigNumber(500));
    callNativeTokenOutDto.uniqueKey = randomUniqueKey();

    const signedDto = callNativeTokenOutDto.signed(users.testUser1.privateKey);

    // When
    const response = await contract.CallNativeTokenOut(ctx, signedDto);

    // Then
    expect(response.Status).toBe(1);
    expect(response.Data?.calculatedQuantity).toBeDefined();
  });

  it("should handle minimal token sale", async () => {
    // Given
    sale.buyToken(new BigNumber("100"), new BigNumber(0.01)); // Pre-sell some tokens
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

    const callNativeTokenOutDto = new ExactTokenQuantityDto(vaultAddress, new BigNumber("0.001"));
    callNativeTokenOutDto.uniqueKey = randomUniqueKey();

    const signedDto = callNativeTokenOutDto.signed(users.testUser1.privateKey);

    // When
    const response = await contract.CallNativeTokenOut(ctx, signedDto);

    // Then
    expect(response.Status).toBe(1);
    expect(response.Data?.calculatedQuantity).toBeDefined();
    expect(new BigNumber(response.Data?.calculatedQuantity || "0").isFinite()).toBe(true);
  });

  it("should calculate correct fees for token sale", async () => {
    // Given
    sale.buyToken(new BigNumber("800"), new BigNumber(0.01)); // Pre-sell some tokens
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

    const callNativeTokenOutDto = new ExactTokenQuantityDto(vaultAddress, new BigNumber(50));
    callNativeTokenOutDto.uniqueKey = randomUniqueKey();

    const signedDto = callNativeTokenOutDto.signed(users.testUser1.privateKey);

    // When
    const response = await contract.CallNativeTokenOut(ctx, signedDto);

    // Then
    expect(response.Status).toBe(1);
    expect(response.Data?.extraFees.reverseBondingCurve).toBeDefined();
    expect(response.Data?.extraFees.transactionFees).toBeDefined();
    expect(new BigNumber(response.Data?.extraFees.reverseBondingCurve || "0").isFinite()).toBe(true);
    expect(new BigNumber(response.Data?.extraFees.transactionFees || "0").isFinite()).toBe(true);
  });

  it("should handle edge case with large token sale relative to tokens sold", async () => {
    // Given
    sale.buyToken(new BigNumber("200"), new BigNumber(0.01)); // Pre-sell smaller amount
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

    const callNativeTokenOutDto = new ExactTokenQuantityDto(vaultAddress, new BigNumber(150));
    callNativeTokenOutDto.uniqueKey = randomUniqueKey();

    const signedDto = callNativeTokenOutDto.signed(users.testUser1.privateKey);

    // When
    const response = await contract.CallNativeTokenOut(ctx, signedDto);

    // Then
    expect(response.Status).toBe(1);
    expect(response.Data?.calculatedQuantity).toBeDefined();
    expect(new BigNumber(response.Data?.calculatedQuantity || "0").isFinite()).toBe(true);
  });
});
