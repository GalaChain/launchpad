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
import { randomUniqueKey } from "@gala-chain/api";
import { fixture, users } from "@gala-chain/test";
import BigNumber from "bignumber.js";

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
      "TestCollection",
      "TestCategory"
    );
    createSaleDto.tokenImage = "https://example.com/token.png";
    createSaleDto.websiteUrl = "https://example.com";
    createSaleDto.preBuyQuantity = new BigNumber(0);
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
      "TelegramCollection",
      "SocialCategory"
    );
    createSaleDto.telegramUrl = "https://t.me/testtoken";
    createSaleDto.preBuyQuantity = new BigNumber(0);
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
      "TwitterCollection",
      "SocialCategory"
    );
    createSaleDto.twitterUrl = "https://twitter.com/testtoken";
    createSaleDto.preBuyQuantity = new BigNumber(0);
    createSaleDto.uniqueKey = randomUniqueKey();

    const signedDto = createSaleDto.signed(users.testUser1.privateKey);

    // When
    const response = await contract.CreateSale(ctx, signedDto);

    // Then
    expect(response.Status).toBe(1);
    expect(response.Data?.twitterUrl).toBe("https://twitter.com/testtoken");
  });

  it("should create token sale with pre-buy amount", async () => {
    // Given
    const { ctx, contract } = fixture(LaunchpadContract).registeredUsers(users.testUser1);

    const createSaleDto = new CreateTokenSaleDTO(
      "Pre-buy Token",
      "PRE",
      "A token with pre-buy",
      "PreBuyCollection",
      "PreBuyCategory"
    );
    createSaleDto.websiteUrl = "https://example.com";
    createSaleDto.preBuyQuantity = new BigNumber("10");
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
      "LowerCollection",
      "LowerCategory"
    );
    createSaleDto.websiteUrl = "https://example.com";
    createSaleDto.preBuyQuantity = new BigNumber(0);
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
      "SocialCollection",
      "FullSocialCategory"
    );
    createSaleDto.websiteUrl = "https://socialtoken.com";
    createSaleDto.telegramUrl = "https://t.me/socialtoken";
    createSaleDto.twitterUrl = "https://twitter.com/socialtoken";
    createSaleDto.preBuyQuantity = new BigNumber(0);
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
      "ImageCollection",
      "ImageCategory"
    );
    createSaleDto.websiteUrl = "https://example.com";
    createSaleDto.tokenImage = "https://cdn.example.com/token-logo.png";
    createSaleDto.preBuyQuantity = new BigNumber(0);
    createSaleDto.uniqueKey = randomUniqueKey();

    const signedDto = createSaleDto.signed(users.testUser1.privateKey);

    // When
    const response = await contract.CreateSale(ctx, signedDto);

    // Then
    expect(response.Status).toBe(1);
    expect(response.Data?.image).toBe("https://cdn.example.com/token-logo.png");
  });
});
