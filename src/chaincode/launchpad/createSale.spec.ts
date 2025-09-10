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
import { randomUniqueKey, TokenBalance, TokenClass, TokenInstance } from "@gala-chain/api";
import { fixture, users, currency } from "@gala-chain/test";
import BigNumber from "bignumber.js";
import { plainToInstance } from "class-transformer";

import { CreateTokenSaleDTO } from "../../api/types";
import { LaunchpadContract } from "../LaunchpadContract";

describe("createSale", () => {
  it("should create a new token sale successfully", async () => {
    // Given
    const { ctx, contract } = fixture(LaunchpadContract).registeredUsers(users.testUser1);

    const createSaleDto = new CreateTokenSaleDTO(
      "Test Token",
      "TEST",
      "A test token for launchpad",
      "https://example.com/token.png",
      new BigNumber(0),
      "TestCollection",
      "TestCategory"
    );
    createSaleDto.websiteUrl = "https://example.com";
    createSaleDto.uniqueKey = randomUniqueKey();

    const signedDto = createSaleDto.signed(users.testUser1.privateKey);

    // When
    const response = await contract.CreateSale(ctx, signedDto);

    // Then
    expect(response.Status).toBe(1);
    expect(response.Data?.tokenName).toBe("Test Token");
    expect(response.Data?.symbol).toBe("TEST");
    expect(response.Data?.description).toBe("A test token for launchpad");
    expect(response.Data?.collection).toBe("TestCollection");
    expect(response.Data?.category).toBe("TestCategory");
    expect(response.Data?.vaultAddress).toBeDefined();
    expect(response.Data?.creatorAddress).toBe(users.testUser1.identityKey);
    expect(response.Data?.isFinalized).toBe(false);
  });

  it("should create token sale with telegram URL", async () => {
    // Given
    const { ctx, contract } = fixture(LaunchpadContract).registeredUsers(users.testUser1);

    const createSaleDto = new CreateTokenSaleDTO(
      "Telegram Token",
      "TG",
      "A token with telegram link",
      "https://example.com/tg.png",
      new BigNumber(0),
      "TelegramCollection",
      "SocialCategory"
    );
    createSaleDto.telegramUrl = "https://t.me/testtoken";
    createSaleDto.uniqueKey = randomUniqueKey();

    const signedDto = createSaleDto.signed(users.testUser1.privateKey);

    // When
    const response = await contract.CreateSale(ctx, signedDto);

    // Then
    expect(response.Status).toBe(1);
    expect(response.Data?.telegramUrl).toBe("https://t.me/testtoken");
    expect(response.Data?.websiteUrl).toBe("");
    expect(response.Data?.twitterUrl).toBe("");
  });

  it("should create token sale with twitter URL", async () => {
    // Given
    const { ctx, contract } = fixture(LaunchpadContract).registeredUsers(users.testUser1);

    const createSaleDto = new CreateTokenSaleDTO(
      "Twitter Token",
      "TWT",
      "A token with twitter link",
      "https://example.com/twt.png",
      new BigNumber(0),
      "TwitterCollection",
      "SocialCategory"
    );
    createSaleDto.twitterUrl = "https://twitter.com/testtoken";
    createSaleDto.uniqueKey = randomUniqueKey();

    const signedDto = createSaleDto.signed(users.testUser1.privateKey);

    // When
    const response = await contract.CreateSale(ctx, signedDto);

    // Then
    expect(response.Status).toBe(1);
    expect(response.Data?.twitterUrl).toBe("https://twitter.com/testtoken");
  });

  it("should create token sale with pre-buy amount", async () => {
    // Given - Setup GALA token for pre-buy (matching LaunchpadSale nativeToken)
    const galaClass = plainToInstance(TokenClass, {
      collection: "GALA",
      category: "Unit", 
      type: "none",
      additionalKey: "none",
      decimals: 8,
      name: "GALA",
      symbol: "GALA",
      description: "GALA token",
      image: "",
      maxSupply: new BigNumber("1e+10"),
      maxCapacity: new BigNumber("1e+10"),
      totalMintAllowance: new BigNumber("1e+10"),
      totalSupply: new BigNumber("1e+10"),
      totalBurned: new BigNumber("0"),
      authorities: [users.testUser1.identityKey]
    });

    const galaInstance = plainToInstance(TokenInstance, {
      collection: "GALA",
      category: "Unit",
      type: "none", 
      additionalKey: "none",
      instance: new BigNumber(0),
      isNonFungible: false,
      owner: users.testUser1.identityKey,
      quantity: new BigNumber("1e+10")
    });

    const userGalaBalance = plainToInstance(TokenBalance, {
      collection: "GALA",
      category: "Unit",
      type: "none",
      additionalKey: "none", 
      instance: new BigNumber(0),
      owner: users.testUser1.identityKey,
      quantity: new BigNumber("1000") // User has GALA for pre-buy
    });

    const { ctx, contract } = fixture(LaunchpadContract)
      .registeredUsers(users.testUser1)
      .savedState(
        galaClass,
        galaInstance,
        userGalaBalance
      );

    const createSaleDto = new CreateTokenSaleDTO(
      "Pre-buy Token",
      "PRE",
      "A token with pre-buy",
      "https://example.com/pre.png",
      new BigNumber("10"),
      "PreBuyCollection",
      "PreBuyCategory"
    );
    createSaleDto.websiteUrl = "https://example.com";
    createSaleDto.uniqueKey = randomUniqueKey();

    const signedDto = createSaleDto.signed(users.testUser1.privateKey);

    // When
    const response = await contract.CreateSale(ctx, signedDto);

    // Then
    expect(response.Status).toBe(1);
    expect(response.Data?.initialBuyQuantity).toBe("10");
  });

  it("should convert token symbol to uppercase", async () => {
    // Given
    const { ctx, contract } = fixture(LaunchpadContract).registeredUsers(users.testUser1);

    const createSaleDto = new CreateTokenSaleDTO(
      "Lowercase Token",
      "lower", // lowercase symbol
      "A token with lowercase symbol",
      "https://example.com/lower.png",
      new BigNumber(0),
      "LowerCollection",
      "LowerCategory"
    );
    createSaleDto.websiteUrl = "https://example.com";
    createSaleDto.uniqueKey = randomUniqueKey();

    const signedDto = createSaleDto.signed(users.testUser1.privateKey);

    // When
    const response = await contract.CreateSale(ctx, signedDto);

    // Then
    expect(response.Status).toBe(1);
    expect(response.Data?.symbol).toBe("LOWER"); // Should be converted to uppercase
  });

  it("should create sale with all social media URLs", async () => {
    // Given
    const { ctx, contract } = fixture(LaunchpadContract).registeredUsers(users.testUser1);

    const createSaleDto = new CreateTokenSaleDTO(
      "Social Token",
      "SOC",
      "A fully connected social token",
      "https://example.com/soc.png",
      new BigNumber(0),
      "SocialCollection",
      "FullSocialCategory"
    );
    createSaleDto.websiteUrl = "https://socialtoken.com";
    createSaleDto.telegramUrl = "https://t.me/socialtoken";
    createSaleDto.twitterUrl = "https://twitter.com/socialtoken";
    createSaleDto.uniqueKey = randomUniqueKey();

    const signedDto = createSaleDto.signed(users.testUser1.privateKey);

    // When
    const response = await contract.CreateSale(ctx, signedDto);

    // Then
    expect(response.Status).toBe(1);
    expect(response.Data?.websiteUrl).toBe("https://socialtoken.com");
    expect(response.Data?.telegramUrl).toBe("https://t.me/socialtoken");
    expect(response.Data?.twitterUrl).toBe("https://twitter.com/socialtoken");
  });

  it("should create sale with custom token image", async () => {
    // Given
    const { ctx, contract } = fixture(LaunchpadContract).registeredUsers(users.testUser1);

    const createSaleDto = new CreateTokenSaleDTO(
      "Image Token",
      "IMG",
      "A token with custom image",
      "https://cdn.example.com/token-logo.png",
      new BigNumber(0),
      "ImageCollection",
      "ImageCategory"
    );
    createSaleDto.websiteUrl = "https://example.com";
    createSaleDto.uniqueKey = randomUniqueKey();

    const signedDto = createSaleDto.signed(users.testUser1.privateKey);

    // When
    const response = await contract.CreateSale(ctx, signedDto);

    // Then
    expect(response.Status).toBe(1);
    expect(response.Data?.image).toBe("https://cdn.example.com/token-logo.png");
  });
});