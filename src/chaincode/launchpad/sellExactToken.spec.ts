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
import { currency, fixture, transactionSuccess, users } from "@gala-chain/test";
import BigNumber from "bignumber.js";
import { plainToInstance } from "class-transformer";

import { ExactTokenQuantityDto, LaunchpadSale, TradeResDto } from "../../api/types";
import { LaunchpadContract } from "../LaunchpadContract";
import launchpadgala from "../test/launchpadgala";

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
      quantity: new BigNumber("1000") // User has some CURRENCY tokens
    });
  });

  it("should sell exact token amount successfully", async () => {
    // Given
    sale.buyToken(new BigNumber("1000"), new BigNumber("100")); // Users bought tokens, sale now has GALA
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
    sale.buyToken(new BigNumber("800"), new BigNumber("50")); // Users bought tokens, sale now has GALA
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
    sale.buyToken(new BigNumber("2000"), new BigNumber("500")); // Users bought tokens, sale now has GALA
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

  let galaPurchaseQtyDefaultSupply: BigNumber;

  test("Adjustable supply: Single transaction yields expected value for default 10 Million supply", async () => {
    // Given
    const multiplier = undefined;

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

    const sellDto = new ExactTokenQuantityDto(vaultAddress, new BigNumber("50"));
    sellDto.uniqueKey = randomUniqueKey();
    const signedDto = sellDto.signed(users.testUser1.privateKey);

    // When
    const buyRes = await contract.BuyExactToken(ctx, buyDto);

    const sellRes = await contract.SellExactToken(ctx, signedDto);

    // Then
    expect(buyRes).toEqual(transactionSuccess(expectedBuyResponse));

    expect(sellRes.Status).toBe(1);
    expect(sellRes.Data?.inputQuantity).toBe("50");
    expect(sellRes.Data?.outputQuantity).toBe("0.00082579");

    galaPurchaseQtyDefaultSupply = new BigNumber(sellRes.Data?.outputQuantity ?? 0);
  });

  test("Adjustable supply: Single transaction yields expected quantity for 100x scaled 1 Billion supply", async () => {
    // Given
    const multiplier = 100;
    const inputQty = new BigNumber("50").times(multiplier);

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

    const sellDto = new ExactTokenQuantityDto(vaultAddress, inputQty);
    sellDto.uniqueKey = randomUniqueKey();
    const signedDto = sellDto.signed(users.testUser1.privateKey);

    // When
    const buyRes = await contract.BuyExactToken(ctx, buyDto);

    const sellRes = await contract.SellExactToken(ctx, signedDto);

    // Then
    expect(buyRes).toEqual(transactionSuccess(expectedBuyResponse));

    expect(sellRes.Status).toBe(1);
    expect(sellRes.Data?.inputQuantity).toBe(inputQty.toString());
    expect(sellRes.Data?.outputQuantity).toBe("0.00082579");

    const galaPurchaseQty100xSupply = new BigNumber(sellRes.Data?.outputQuantity ?? -1);

    // Compared to the previous test where the Launchpad has the default 10 Million supply,
    // We expect the Meme token Qty to scale 100x and the Gala Qty to remain the same
    expect(galaPurchaseQtyDefaultSupply).toEqual(galaPurchaseQty100xSupply);
  });
});
