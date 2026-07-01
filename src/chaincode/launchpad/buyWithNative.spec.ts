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
  ValidationFailedError,
  asValidUserAlias,
  randomUniqueKey
} from "@gala-chain/api";
import { InvalidDecimalError } from "@gala-chain/chaincode";
import { currency, fixture, transactionError, transactionSuccess, users } from "@gala-chain/test";
import BigNumber from "bignumber.js";
import { plainToInstance } from "class-transformer";

import {
  ExactTokenQuantityDto,
  LaunchpadFeeConfig,
  LaunchpadSale,
  NativeTokenQuantityDto,
  TradeResDto
} from "../../api/types";
import { LaunchpadContract } from "../LaunchpadContract";
import launchpadgala from "../test/launchpadgala";

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
    currencyClass = plainToInstance(TokenClass, {
      ...currency.tokenClassPlain(),
      decimals: LaunchpadSale.SELLING_TOKEN_DECIMALS
    });
    currencyInstance = currency.tokenInstance();

    launchpadGalaClass = plainToInstance(TokenClass, {
      ...launchpadgala.tokenClassPlain(),
      decimals: LaunchpadSale.NATIVE_TOKEN_DECIMALS
    });

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

  it("should round buy when meme token has 0 decimals and bonding curve produces fractional quantity", async () => {
    // Given
    const zeroDecimalCurrencyClass = plainToInstance(TokenClass, {
      ...currency.tokenClassPlain(),
      decimals: 0 // Integer-only meme token
    });

    const { ctx, contract } = fixture(LaunchpadContract)
      .registeredUsers(users.testUser1)
      .savedState(
        currencyInstance,
        zeroDecimalCurrencyClass,
        launchpadGalaInstance,
        launchpadGalaClass,
        sale,
        salelaunchpadGalaBalance,
        saleCurrencyBalance,
        userlaunchpadGalaBalance,
        userCurrencyBalance
      );

    // Use a native token amount that will produce fractional meme tokens from bonding curve
    const dto = new NativeTokenQuantityDto(vaultAddress, new BigNumber("0.01"));
    dto.uniqueKey = randomUniqueKey();
    dto.sign(users.testUser1.privateKey);

    // When
    const buyTokenRes = await contract.BuyWithNative(ctx, dto);

    // Then - Expect code to round transferToken qty to decimal limit specified by TokenClass
    expect(buyTokenRes).not.toEqual(
      transactionError(
        new InvalidDecimalError(new BigNumber("605.60177406237267161"), zeroDecimalCurrencyClass.decimals)
      )
    );
  });

  test("User buys tokens by providing native gala, without fee needing to be configured", async () => {
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

    const dto = new NativeTokenQuantityDto(vaultAddress, new BigNumber("150"));

    dto.uniqueKey = randomUniqueKey();
    dto.sign(users.testUser1.privateKey);

    const expectedResponse = plainToInstance(TradeResDto, {
      inputQuantity: "150",
      totalFees: "0",
      totalTokenSold: "2101667.889065163",
      outputQuantity: "2101667.889065163",
      tokenName: "AUTOMATEDTESTCOIN",
      tradeType: "Buy",
      vaultAddress: "service|GALA$Unit$none$none$launchpad",
      userAddress: "client|testUser1",
      isFinalized: false,
      functionName: "BuyWithNative",
      uniqueKey: dto.uniqueKey
    });

    //When
    const buyTokenRes = await contract.BuyWithNative(ctx, dto);

    //Then
    expect(buyTokenRes).toEqual(transactionSuccess(expectedResponse));
  });

  test("User buys tokens, configured fee is checked", async () => {
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

    const dto = new NativeTokenQuantityDto(vaultAddress, new BigNumber("1000"));
    dto.uniqueKey = randomUniqueKey();
    dto.sign(users.testUser1.privateKey);

    const expectedResponse = plainToInstance(TradeResDto, {
      inputQuantity: "1000",
      totalFees: "320",
      totalTokenSold: "3663321.362813055",
      outputQuantity: "3663321.362813055",
      tokenName: "AUTOMATEDTESTCOIN",
      tradeType: "Buy",
      vaultAddress: "service|GALA$Unit$none$none$launchpad",
      userAddress: "client|testUser1",
      isFinalized: false,
      functionName: "BuyWithNative",
      uniqueKey: dto.uniqueKey
    });

    //When
    const buyTokenRes = await contract.BuyWithNative(ctx, dto);

    //Then
    expect(buyTokenRes).toEqual(transactionSuccess(expectedResponse));
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
      transactionError(
        new ValidationFailedError(
          "Insufficient balance: Total amount required including fee is 2166101.31430784"
        )
      )
    );
  });

  it("should return inverse native tokens when buying and selling tokens", async () => {
    //Given
    salelaunchpadGalaBalance.subtractQuantity(new BigNumber("1e+7"), 0);
    saleCurrencyBalance.addQuantity(new BigNumber("1e+7"));
    userlaunchpadGalaBalance.addQuantity(new BigNumber("1e+7"));
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

    const arr: string[] = [
      "31.27520343",
      "100.3731319",
      "322.1326962",
      "1033.837164",
      "3317.947211",
      "10648.46001",
      "34174.65481",
      "109678.4915",
      "351996.8694",
      "1129679.88999"
    ];

    const sellingArr: string[] = [];
    const sellArr: string[] = [
      "1000000.000060721",
      "1000000.000017497",
      "999999.999868935",
      "1000000.000187964",
      "999999.999879254",
      "999999.999929098",
      "1000000.000096442",
      "999999.999800915",
      "1000000.000112742",
      "999999.000293124"
    ];

    // When - Buy tokens using native token amounts from arr
    for (let i = 0; i < arr.length; i++) {
      let nativeCoins = Number(arr[i]);
      nativeCoins = roundToDecimal(nativeCoins, 8);

      const dto = new NativeTokenQuantityDto(vaultAddress, new BigNumber(nativeCoins));
      dto.uniqueKey = randomUniqueKey();
      dto.sign(users.testUser1.privateKey);

      const buyTokenRes = await contract.BuyWithNative(ctx, dto);
      expect(buyTokenRes).toEqual(transactionSuccess());
    }

    // When - Sell tokens back in reverse order
    for (let i = sellArr.length - 1; i >= 0; i--) {
      const sellDto = new ExactTokenQuantityDto(vaultAddress, new BigNumber(sellArr[i]));
      sellDto.uniqueKey = randomUniqueKey();
      sellDto.sign(users.testUser1.privateKey);

      const sellTokenRes = await contract.SellExactToken(ctx, sellDto);
      expect(sellTokenRes).toEqual(transactionSuccess());
      sellingArr.push(sellTokenRes.Data?.outputQuantity || "0");
    }

    // Then - Verify sellingArr is the inverse of arr with the extra ""
    const expectedSellingArr = [...arr].reverse();

    // Compare each element, checking that values match up to 4 decimal places
    const tolerance = new BigNumber("0.0001"); // 4 decimal places tolerance
    for (let i = 1; i < sellingArr.length; i++) {
      const sellingValue = new BigNumber(sellingArr[i]);
      const expectedValue = new BigNumber(expectedSellingArr[i]);
      const difference = sellingValue.minus(expectedValue).abs();
      expect(difference.isLessThanOrEqualTo(tolerance)).toBe(true);
    }
  });

  test("Adjustable supply: Single transaction", async () => {
    //Given
    const multiplier = 100;

    sale = new LaunchpadSale(
      vaultAddress,
      currencyInstance.instanceKeyObj(),
      undefined,
      users.testUser1.identityKey,
      undefined,
      multiplier
    );

    saleCurrencyBalance = plainToInstance(TokenBalance, {
      ...currency.tokenBalance(),
      owner: vaultAddress,
      quantity: new BigNumber("2e+7").times(multiplier)
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

    const dto = new NativeTokenQuantityDto(vaultAddress, new BigNumber("150"));

    dto.uniqueKey = randomUniqueKey();
    dto.sign(users.testUser1.privateKey);

    const expectedOutput = new BigNumber("2101667.8890651635").times(multiplier).toString();
    const expectedResponse = plainToInstance(TradeResDto, {
      inputQuantity: "150",
      totalFees: "0",
      totalTokenSold: expectedOutput,
      outputQuantity: expectedOutput,
      tokenName: "AUTOMATEDTESTCOIN",
      tradeType: "Buy",
      vaultAddress: "service|GALA$Unit$none$none$launchpad",
      userAddress: "client|testUser1",
      isFinalized: false,
      functionName: "BuyWithNative",
      uniqueKey: dto.uniqueKey
    });

    //When
    const buyTokenRes = await contract.BuyWithNative(ctx, dto);

    //Then
    expect(buyTokenRes).toEqual(transactionSuccess(expectedResponse));
  });
});
function roundToDecimal(value: number, decimals: number) {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}
