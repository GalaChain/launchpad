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
import { InvalidDecimalError } from "@gala-chain/chaincode";
import { currency, fixture, transactionError, transactionSuccess, users } from "@gala-chain/test";
import BigNumber from "bignumber.js";
import { plainToInstance } from "class-transformer";

import { ExactTokenQuantityDto, LaunchpadSale, NativeTokenQuantityDto, TradeResDto } from "../../api/types";
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
      currencyInstance.instanceKeyObj(),
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
      quantity: new BigNumber("10000") // User has some CURRENCY tokens
    });
  });

  test("Round sell qty when bonding curve produces fractional precision than meme TokenClass.decimals", async () => {
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
    expect(response).not.toEqual(
      transactionError(
        new InvalidDecimalError(new BigNumber("9940.1186641108"), zeroDecimalMemeTokenClass.decimals)
      )
    );
  });

  it("should sell tokens for native currency successfully", async () => {
    // Given
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

    const expectedResponse = plainToInstance(TradeResDto, {
      functionName: "SellWithNative",
      inputQuantity: "6008.9271949683",
      isFinalized: false,
      outputQuantity: "0.1",
      tokenName: "AUTOMATEDTESTCOIN",
      totalFees: "0",
      totalTokenSold: "3991.0728050317",
      tradeType: "Sell",
      uniqueKey: sellDto.uniqueKey,
      userAddress: "client|testUser1",
      vaultAddress: "service|GALA$Unit$none$none$launchpad"
    });

    // When
    const response = await contract.SellWithNative(ctx, signedDto);

    // Then
    expect(response).toEqual(transactionSuccess(expectedResponse));
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

  let galaPurchaseQtyDefaultSupply: BigNumber;
  let memeSaleQtyDefaultSupply: BigNumber;

  test("Adjustable supply: Single transaction yields expected value for default 10 Million supply", async () => {
    // Given
    const multiplier = undefined;
    galaPurchaseQtyDefaultSupply = new BigNumber("0.00082579");
    memeSaleQtyDefaultSupply = new BigNumber("49.999949130655");

    sale = new LaunchpadSale(
      vaultAddress,
      currencyInstance.instanceKeyObj(),
      undefined,
      users.testUser1.identityKey,
      undefined,
      multiplier
    );

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

    const buyDto = new ExactTokenQuantityDto(vaultAddress, new BigNumber("500"));

    buyDto.uniqueKey = randomUniqueKey();
    buyDto.sign(users.testUser1.privateKey);

    const expectedBuyResponse = plainToInstance(TradeResDto, {
      inputQuantity: "0.00825575",
      totalFees: "0",
      totalTokenSold: new BigNumber("500").toString(),
      outputQuantity: new BigNumber("500").toString(),
      tokenName: "AUTOMATEDTESTCOIN",
      tradeType: "Buy",
      uniqueKey: buyDto.uniqueKey,
      vaultAddress: "service|GALA$Unit$none$none$launchpad",
      userAddress: "client|testUser1",
      isFinalized: false,
      functionName: "BuyExactToken"
    });

    const sellDto = new NativeTokenQuantityDto(vaultAddress, galaPurchaseQtyDefaultSupply);
    sellDto.uniqueKey = randomUniqueKey();
    const signedDto = sellDto.signed(users.testUser1.privateKey);

    // When
    const buyRes = await contract.BuyExactToken(ctx, buyDto);

    const sellRes = await contract.SellWithNative(ctx, signedDto);

    // Then
    expect(buyRes).toEqual(transactionSuccess(expectedBuyResponse));

    expect(sellRes).toEqual(
      transactionSuccess(
        expect.objectContaining({
          outputQuantity: galaPurchaseQtyDefaultSupply.toString(),
          // extra precision in set constant above accounts for loss of precision
          // when increased by the multiplier below.
          // here, we round to the token decimal places to match the internal logic
          inputQuantity: memeSaleQtyDefaultSupply.decimalPlaces(10).toString()
        })
      )
    );
    galaPurchaseQtyDefaultSupply = new BigNumber(sellRes.Data?.outputQuantity ?? 0);
  });

  test("Adjustable supply: Single transaction yields expected quantity for 100x scaled 1 Billion supply", async () => {
    // Given
    const multiplier = 100;

    // Same Gala purchase amount should buy 100x meme token output
    const inputQty = new BigNumber(galaPurchaseQtyDefaultSupply);

    sale = new LaunchpadSale(
      vaultAddress,
      currencyInstance.instanceKeyObj(),
      undefined,
      users.testUser1.identityKey,
      undefined,
      multiplier
    );

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

    const buyDto = new ExactTokenQuantityDto(vaultAddress, new BigNumber("500").times(multiplier));

    buyDto.uniqueKey = randomUniqueKey();
    buyDto.sign(users.testUser1.privateKey);

    const expectedBuyResponse = plainToInstance(TradeResDto, {
      inputQuantity: "0.00825575",
      totalFees: "0",
      totalTokenSold: new BigNumber("500").times(multiplier).toString(),
      outputQuantity: new BigNumber("500").times(multiplier).toString(),
      tokenName: "AUTOMATEDTESTCOIN",
      tradeType: "Buy",
      uniqueKey: buyDto.uniqueKey,
      vaultAddress: "service|GALA$Unit$none$none$launchpad",
      userAddress: "client|testUser1",
      isFinalized: false,
      functionName: "BuyExactToken"
    });

    const sellDto = new NativeTokenQuantityDto(vaultAddress, inputQty);
    sellDto.uniqueKey = randomUniqueKey();
    const signedDto = sellDto.signed(users.testUser1.privateKey);

    // When
    const buyRes = await contract.BuyExactToken(ctx, buyDto);

    const sellRes = await contract.SellWithNative(ctx, signedDto);

    // Then
    expect(buyRes).toEqual(transactionSuccess(expectedBuyResponse));

    expect(sellRes).toEqual(
      transactionSuccess(
        expect.objectContaining({
          inputQuantity: memeSaleQtyDefaultSupply.times(multiplier).toString(),
          outputQuantity: galaPurchaseQtyDefaultSupply.toString()
        })
      )
    );

    const galaPurchaseQty100xSupply = new BigNumber(sellRes.Data?.outputQuantity ?? -1);
    const memeSaleQty100xSupply = new BigNumber(sellRes.Data?.inputQuantity ?? -1);

    // Compared to the previous test where the Launchpad has the default 10 Million supply,
    // We expect the Meme token Qty to scale 100x and the Gala Qty to remain the same
    expect(galaPurchaseQtyDefaultSupply).toEqual(galaPurchaseQty100xSupply);
    expect(memeSaleQtyDefaultSupply).toEqual(memeSaleQty100xSupply.dividedBy(multiplier));
  });
});
