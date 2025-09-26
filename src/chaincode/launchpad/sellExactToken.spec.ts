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
import { currency, fixture, transactionError, users } from "@gala-chain/test";
import { ValidationFailedError } from "@gala-chain/api";
import BigNumber from "bignumber.js";
import { plainToInstance } from "class-transformer";

import { ExactTokenQuantityDto, LaunchpadSale } from "../../api/types";
import { LaunchpadContract } from "../LaunchpadContract";
import launchpadgala from "../test/launchpadgala";
import { InvalidDecimalError } from "@gala-chain/chaincode";

describe("sellExactToken", () => {
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

  it("should sell exact token amount successfully", async () => {
    // Given
    sale.buyToken(new BigNumber("1000"), new BigNumber("50")); // Users bought tokens, sale now has GALA
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

    const sellDto = new ExactTokenQuantityDto(vaultAddress, new BigNumber("100"));
    sellDto.uniqueKey = randomUniqueKey();
    const signedDto = sellDto.signed(users.testUser1.privateKey);

    // When
    const response = await contract.SellExactToken(ctx, signedDto);

    // Then
    expect(response.Status).toBe(1);
    expect(response.Data).toHaveProperty("outputQuantity");
    expect(response.Data).toHaveProperty("inputQuantity", "100");
    expect(response.Data).toHaveProperty("isFinalized");
  });

  it("should reject sell when native token has 0 decimals and bonding curve produces fractional quantity", async () => {
    // Given
    const zeroDecimalNativeClass = plainToInstance(TokenClass, {
      ...launchpadgala.tokenClassPlain(),
      decimals: 0 // Integer-only native token
    });

    // Simulate prior buys to establish sale state
    sale.buyToken(new BigNumber("5000"), new BigNumber("100"));

    const { ctx, contract } = fixture(LaunchpadContract)
      .registeredUsers(users.testUser1)
      .savedState(
        zeroDecimalNativeClass,
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
    const sellDto = new ExactTokenQuantityDto(vaultAddress, new BigNumber("100"));
    sellDto.uniqueKey = randomUniqueKey();
    const signedDto = sellDto.signed(users.testUser1.privateKey);

    // When
    const response = await contract.SellExactToken(ctx, signedDto);

    // Then - Expect error due to decimal precision mismatch
    expect(response).toEqual(transactionError(
      new InvalidDecimalError(
        new BigNumber("0.00166022"),
        zeroDecimalNativeClass.decimals
      )
    ));
  });

  it("should reject sell when meme token has 0 decimals and input dto contains fractional quantity", async () => {
    // Given
    const zeroDecimalMemeClass = plainToInstance(TokenClass, {
      ...currency.tokenClassPlain(),
      decimals: 0 // Integer-only native token
    });

    // Simulate prior buys to establish sale state
    sale.buyToken(new BigNumber("5000"), new BigNumber("100"));

    const { ctx, contract } = fixture(LaunchpadContract)
      .registeredUsers(users.testUser1)
      .savedState(
        zeroDecimalMemeClass,
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
    const sellDto = new ExactTokenQuantityDto(vaultAddress, new BigNumber("100.555"));
    sellDto.uniqueKey = randomUniqueKey();
    const signedDto = sellDto.signed(users.testUser1.privateKey);

    // When
    const response = await contract.SellExactToken(ctx, signedDto);

    // Then - Expect error due to decimal precision mismatch
    expect(response).toEqual(transactionError(
      new InvalidDecimalError(
        sellDto.tokenQuantity,
        zeroDecimalMemeClass.decimals
      )
    ));
  });

  it("should handle small token sell amount", async () => {
    // Given
    sale.buyToken(new BigNumber("500"), new BigNumber("25")); // Users bought tokens, sale now has GALA
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

    const sellDto = new ExactTokenQuantityDto(vaultAddress, new BigNumber("1"));
    sellDto.uniqueKey = randomUniqueKey();
    const signedDto = sellDto.signed(users.testUser1.privateKey);

    // When
    const response = await contract.SellExactToken(ctx, signedDto);

    // Then
    expect(response.Status).toBe(1);
    expect(response.Data?.inputQuantity).toBe("1");
    expect(new BigNumber(response.Data?.outputQuantity || "0").isPositive()).toBe(true);
  });

  it("should handle sell with expected native token parameter", async () => {
    // Given
    sale.buyToken(new BigNumber("800"), new BigNumber("40")); // Users bought tokens, sale now has GALA
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

    const sellDto = new ExactTokenQuantityDto(vaultAddress, new BigNumber("50"));
    sellDto.expectedNativeToken = new BigNumber("0.0001"); // Set realistic expectation for slippage protection
    sellDto.uniqueKey = randomUniqueKey();
    const signedDto = sellDto.signed(users.testUser1.privateKey);

    // When
    const response = await contract.SellExactToken(ctx, signedDto);

    // Then
    expect(response.Status).toBe(1);
    expect(response.Data?.inputQuantity).toBe("50");
  });

  it("should handle large token sell amount", async () => {
    // Given
    sale.buyToken(new BigNumber("2000"), new BigNumber("100")); // Users bought tokens, sale now has GALA
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

    const sellDto = new ExactTokenQuantityDto(vaultAddress, new BigNumber("500"));
    sellDto.uniqueKey = randomUniqueKey();
    const signedDto = sellDto.signed(users.testUser1.privateKey);

    // When
    const response = await contract.SellExactToken(ctx, signedDto);

    // Then
    expect(response.Status).toBe(1);
    expect(response.Data?.inputQuantity).toBe("500");
    expect(new BigNumber(response.Data?.outputQuantity || "0").isPositive()).toBe(true);
  });
});
