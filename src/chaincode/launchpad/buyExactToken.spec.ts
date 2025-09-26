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
  GalaChainResponse,
  TokenBalance,
  TokenClass,
  TokenClassKey,
  TokenInstance,
  UserAlias,
  ValidationFailedError,
  asValidUserAlias,
  randomUniqueKey
} from "@gala-chain/api";
import { currency, fixture, transactionError, users } from "@gala-chain/test";
import BigNumber from "bignumber.js";
import { plainToInstance } from "class-transformer";

import {
  ExactTokenQuantityDto,
  LaunchpadFeeConfig,
  LaunchpadSale,
  NativeTokenQuantityDto
} from "../../api/types";
import { LaunchpadContract } from "../LaunchpadContract";
import launchpadgala from "../test/launchpadgala";
import { InvalidDecimalError } from "@gala-chain/chaincode";

describe("buyWithNative", () => {
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
    //Given
    currencyClass = currency.tokenClass();
    currencyInstance = currency.tokenInstance();
    launchpadGalaClass = launchpadgala.tokenClass();
    launchpadGalaInstance = launchpadgala.tokenInstance();
    launchpadGalaClassKey = launchpadgala.tokenClassKey();

    launchpadGalaClass = plainToInstance(TokenClass, {
      ...launchpadgala.tokenClassPlain(),
      decimals: 18
    });

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
      quantity: new BigNumber("1e+7")
    });

    saleCurrencyBalance = plainToInstance(TokenBalance, {
      ...currency.tokenBalance(),
      owner: vaultAddress,
      quantity: new BigNumber("1e+7")
    });

    // Create user balances - user needs tokens to swap
    userlaunchpadGalaBalance = plainToInstance(TokenBalance, {
      ...launchpadgala.tokenBalance(),
      owner: users.testUser1.identityKey,
      quantity: new BigNumber("1000000") // User has 10k launchpadGala tokens
    });
    userCurrencyBalance = plainToInstance(TokenBalance, {
      ...currency.tokenBalance(),
      owner: users.testUser1.identityKey
    });
  });

  it("should reject buy when native token has 0 decimals and bonding curve produces fractional quantity", async () => {
    // Given - Setup token with 0 decimals to force decimal precision error
    launchpadGalaClass = plainToInstance(TokenClass, {
      ...launchpadgala.tokenClassPlain(),
      decimals: 0
    });

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

    // Choose a token quantity that will produce fractional native tokens from bonding curve
    // The bonding curve calculation will produce a value like 0.00825575
    const dto = new ExactTokenQuantityDto(vaultAddress, new BigNumber("500"));
    dto.uniqueKey = randomUniqueKey();
    dto.sign(users.testUser1.privateKey);

    // When
    const buyTokenRes = await contract.BuyExactToken(ctx, dto);

    // Then - Expect error due to decimal precision mismatch
    expect(buyTokenRes).toEqual(transactionError(
      new InvalidDecimalError(
        new BigNumber("0.00825575"),
        launchpadGalaClass.decimals
      )
    ));
  });

  it("should reject buy when meme token has 0 decimals and input dto contains fractional quantity", async () => {
    // Given - Setup token with 0 decimals to force decimal precision error
    const zeroDecimalCurrencyClass = plainToInstance(TokenClass, {
      ...currency.tokenClassPlain(),
      decimals: 0 // Integer-only token
    });

    const { ctx, contract } = fixture(LaunchpadContract)
      .registeredUsers(users.testUser1)
      .savedState(
        zeroDecimalCurrencyClass,
        currencyInstance,
        launchpadGalaClass,
        launchpadGalaInstance,
        sale,
        salelaunchpadGalaBalance,
        saleCurrencyBalance,
        userlaunchpadGalaBalance,
        userCurrencyBalance
      );

    const dto = new ExactTokenQuantityDto(vaultAddress, new BigNumber("500.555"));
    dto.uniqueKey = randomUniqueKey();
    dto.sign(users.testUser1.privateKey);

    // When
    const buyTokenRes = await contract.BuyExactToken(ctx, dto);

    // Then
    expect(buyTokenRes).toEqual(transactionError(
      new InvalidDecimalError(
        dto.tokenQuantity,
        zeroDecimalCurrencyClass.decimals
      )
    ));
  });

  test("User should be able to buy exact tokens, without fee configured", async () => {
    //Given
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

    const dto = new ExactTokenQuantityDto(vaultAddress, new BigNumber("500"));

    dto.uniqueKey = randomUniqueKey();
    dto.sign(users.testUser1.privateKey);

    //When
    const buyTokenRes = await contract.BuyExactToken(ctx, dto);

    //Then
    expect(buyTokenRes.Data).toMatchObject({
      inputQuantity: "0.00825575",
      totalFees: "0.00000000",
      outputQuantity: "500",
      tokenName: "AUTOMATEDTESTCOIN",
      tradeType: "Buy",
      vaultAddress: "service|GALA$Unit$none$none$launchpad",
      userAddress: "client|testUser1",
      isFinalized: false,
      functionName: "BuyExactToken"
    });
    expect(buyTokenRes.Data?.inputQuantity).toEqual("0.00825575");
    expect(buyTokenRes.Data?.outputQuantity).toEqual("500");
  });

  test("User should be able to buy tokens , fee configured check", async () => {
    //Given
    const launchpadConfig = new LaunchpadFeeConfig(users.testUser2.identityKey, Number("0.32"), [
      users.testUser2.identityKey
    ]);

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
        userCurrencyBalance,
        launchpadConfig
      );

    const dto = new ExactTokenQuantityDto(vaultAddress, new BigNumber("5430"));

    dto.uniqueKey = randomUniqueKey();
    dto.sign(users.testUser1.privateKey);

    //When
    const buyTokenRes = await contract.BuyExactToken(ctx, dto);

    //Then
    expect(buyTokenRes.Data).toMatchObject({
      inputQuantity: "0.08991559",
      totalFees: "0.02877299",
      outputQuantity: "5430",
      tokenName: "AUTOMATEDTESTCOIN",
      tradeType: "Buy",
      vaultAddress: "service|GALA$Unit$none$none$launchpad",
      userAddress: "client|testUser1",
      isFinalized: false,
      functionName: "BuyExactToken"
    });
    expect(buyTokenRes.Data?.inputQuantity).toEqual("0.08991559");
    expect(buyTokenRes.Data?.outputQuantity).toEqual("5430");
  });

  test("User should be able to finalise sale , if fee is configured", async () => {
    //Given
    salelaunchpadGalaBalance = plainToInstance(TokenBalance, {
      ...launchpadgala.tokenBalance(),
      owner: vaultAddress,
      quantity: new BigNumber("0")
    });

    saleCurrencyBalance = plainToInstance(TokenBalance, {
      ...currency.tokenBalance(),
      owner: vaultAddress,
      quantity: new BigNumber("2e+7")
    });
    userlaunchpadGalaBalance = plainToInstance(TokenBalance, {
      ...launchpadgala.tokenBalance(),
      owner: users.testUser1.identityKey,
      quantity: new BigNumber("100000000")
    });

    const launchpadConfig = new LaunchpadFeeConfig(users.testUser2.identityKey, Number("0.001"), [
      users.testUser2.identityKey
    ]);

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
        userCurrencyBalance,
        launchpadConfig
      );

    const dto = new ExactTokenQuantityDto(vaultAddress, new BigNumber("10000000"));

    dto.uniqueKey = randomUniqueKey();
    dto.sign(users.testUser1.privateKey);

    //When
    const buyTokenRes = await contract.BuyExactToken(ctx, dto);

    //Then
    expect(buyTokenRes.Data?.isFinalized).toBe(true);
  });

  it("should throw error if user has insufficient funds incuding the transaction fees", async () => {
    //Given
    const launchpadConfig = new LaunchpadFeeConfig(users.testUser2.identityKey, Number("0.32"), [
      users.testUser2.identityKey
    ]);
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
        userCurrencyBalance,
        launchpadConfig
      );

    const dto = new NativeTokenQuantityDto(vaultAddress, new BigNumber("10000000"));

    dto.uniqueKey = randomUniqueKey();
    dto.sign(users.testUser1.privateKey);

    //When
    const buyTokenRes = await contract.BuyWithNative(ctx, dto);

    //Then
    expect(buyTokenRes).toEqual(
      GalaChainResponse.Error(
        new ValidationFailedError(
          "Insufficient balance: Total amount required including fee is 2166101.31430784"
        )
      )
    );
  });
});
