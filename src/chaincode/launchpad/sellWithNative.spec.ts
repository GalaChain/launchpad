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
import { ValidationFailedError } from "@gala-chain/api";
import { InvalidDecimalError } from "@gala-chain/chaincode";
import { currency, fixture, transactionError, transactionSuccess, users } from "@gala-chain/test";
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

  it("should reject sell when meme token has 0 decimals and bonding curve produces fractional quantity", async () => {
    // Given - Setup meme token with 0 decimals to force decimal precision error
    const zeroDecimalMemeTokenClass = plainToInstance(TokenClass, {
      ...currency.tokenClassPlain(),
      decimals: 0 // Integer-only meme token
    });

    // Simulate prior buys to establish sale state with native tokens
    sale.buyToken(new BigNumber("10000"), new BigNumber("10"));

    const { ctx, contract } = fixture(LaunchpadContract)
      .registeredUsers(users.testUser1)
      .savedState(
        currencyInstance,
        zeroDecimalMemeTokenClass,
        launchpadGalaClass,
        launchpadGalaInstance,
        sale,
        salelaunchpadGalaBalance,
        saleCurrencyBalance,
        userlaunchpadGalaBalance,
        userCurrencyBalance
      );

    // Request native tokens that will require fractional meme tokens from bonding curve
    const sellDto = new NativeTokenQuantityDto(vaultAddress, new BigNumber("0.001"));
    sellDto.uniqueKey = randomUniqueKey();
    sellDto.sign(users.testUser1.privateKey);

    // When
    const response = await contract.SellWithNative(ctx, sellDto);

    // Then - Expect error due to decimal precision mismatch
    expect(response).toEqual(
      transactionError(
        new InvalidDecimalError(new BigNumber("9940.1186641108"), zeroDecimalMemeTokenClass.decimals)
      )
    );
  });

  it("should reject sell when native token has 0 decimals and dto contains fractional quantity", async () => {
    // Given - Setup meme token with 0 decimals to force decimal precision error
    const zeroDecimalLaunchpadGalaClass = plainToInstance(TokenClass, {
      ...launchpadgala.tokenClassPlain(),
      decimals: 0 // Integer-only meme token
    });

    // Simulate prior buys to establish sale state with native tokens
    sale.buyToken(new BigNumber("10000"), new BigNumber("10"));

    const { ctx, contract } = fixture(LaunchpadContract)
      .registeredUsers(users.testUser1)
      .savedState(
        currencyClass,
        currencyInstance,
        zeroDecimalLaunchpadGalaClass,
        launchpadGalaInstance,
        sale,
        salelaunchpadGalaBalance,
        saleCurrencyBalance,
        userlaunchpadGalaBalance,
        userCurrencyBalance
      );

    // Request native tokens that will require fractional meme tokens from bonding curve
    const sellDto = new NativeTokenQuantityDto(vaultAddress, new BigNumber("0.001"));
    sellDto.uniqueKey = randomUniqueKey();
    sellDto.sign(users.testUser1.privateKey);

    // When
    const response = await contract.SellWithNative(ctx, sellDto);

    // Then - Expect error due to decimal precision mismatch
    expect(response).toEqual(
      transactionError(
        new InvalidDecimalError(sellDto.nativeTokenQuantity, zeroDecimalLaunchpadGalaClass.decimals)
      )
    );
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

    // todo: ideally tests illustrate our expected response.
    // given expected inputs, output, when / then
    // const expectedResponse =

    // When
    const response = await contract.SellWithNative(ctx, signedDto);

    // Then
    // todo: ideally expectedRepsonse would be passed to transactionSuccess()
    expect(response).toEqual(transactionSuccess());
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
    expect(response).toEqual(transactionSuccess());
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

    const sellDto = new NativeTokenQuantityDto(vaultAddress, new BigNumber("0.001"));

    // expectedToken value, if provided, must be greater than or equal to actual amount received
    // in other words, if the transaction would sell the buyer less than the buyer expects, it fails.
    sellDto.expectedToken = new BigNumber("100"); // Set expectation for slippage protection

    sellDto.uniqueKey = randomUniqueKey();
    const signedDto = sellDto.signed(users.testUser1.privateKey);

    // When
    const response = await contract.SellWithNative(ctx, signedDto);

    // Then
    expect(response).toEqual(transactionSuccess());
  });

  it("should handle large native token sell amount", async () => {
    // Given
    sale.buyToken(new BigNumber("2000000000"), new BigNumber("200000000")); // Users bought tokens, sale now has GALA
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

    const sellDto = new NativeTokenQuantityDto(vaultAddress, new BigNumber("1000"));
    sellDto.uniqueKey = randomUniqueKey();
    const signedDto = sellDto.signed(users.testUser1.privateKey);

    // When
    const response = await contract.SellWithNative(ctx, signedDto);

    // Then
    expect(response).toEqual(transactionSuccess());
  });

  it("should handle edge case with vault balance limits", async () => {
    // Given
    sale.buyToken(new BigNumber("10000"), new BigNumber("1000")); // Users bought tokens, sale has GALA amount
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
    const sellDto = new NativeTokenQuantityDto(vaultAddress, new BigNumber("0.1"));
    sellDto.uniqueKey = randomUniqueKey();
    const signedDto = sellDto.signed(users.testUser1.privateKey);

    // When
    const response = await contract.SellWithNative(ctx, signedDto);

    // Then
    expect(response).toEqual(transactionSuccess());

    // todo: check writes map, verify vault balance
  });
});
