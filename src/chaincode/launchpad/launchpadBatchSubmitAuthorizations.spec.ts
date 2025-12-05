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
import { fixture, transactionSuccess, users } from "@gala-chain/test";
import { plainToInstance } from "class-transformer";

import {
  AuthorizeBatchSubmitterDto,
  BatchSubmitAuthoritiesResDto,
  DeauthorizeBatchSubmitterDto,
  FetchBatchSubmitAuthoritiesDto,
  LaunchpadBatchSubmitAuthorities
} from "../../api/types";
import { LaunchpadContract } from "../LaunchpadContract";
import {
  authorizeLaunchpadBatchSubmitter,
  deauthorizeLaunchpadBatchSubmitter,
  fetchLaunchpadBatchSubmitAuthorities,
  getLaunchpadBatchSubmitAuthorities
} from "./launchpadBatchSubmitAuthorizations";

describe("BatchSubmitAuthorizations", () => {
  describe("BatchSubmitAuthorities chain object", () => {
    it("should create with initial authorities", () => {
      const auth = new LaunchpadBatchSubmitAuthorities(["user1", "user2"]);
      expect(auth.authorities).toEqual(["user1", "user2"]);
    });

    it("should add authority", () => {
      const auth = new LaunchpadBatchSubmitAuthorities(["user1"]);
      auth.addAuthority("user2");
      expect(auth.authorities).toEqual(["user1", "user2"]);
    });

    it("should not add duplicate authority", () => {
      const auth = new LaunchpadBatchSubmitAuthorities(["user1"]);
      auth.addAuthority("user1");
      expect(auth.authorities).toEqual(["user1"]);
    });

    it("should remove authority", () => {
      const auth = new LaunchpadBatchSubmitAuthorities(["user1", "user2"]);
      auth.removeAuthority("user1");
      expect(auth.authorities).toEqual(["user2"]);
    });

    it("should check if user is authorized", () => {
      const auth = new LaunchpadBatchSubmitAuthorities(["user1", "user2"]);
      expect(auth.isAuthorized("user1")).toBe(true);
      expect(auth.isAuthorized("user3")).toBe(false);
    });

    it("should get authorized authorities", () => {
      const auth = new LaunchpadBatchSubmitAuthorities(["user1", "user2"]);
      const authorities = auth.getAuthorities();
      expect(authorities).toEqual(["user1", "user2"]);
      // Should return a copy, not the original array
      authorities.push("user3");
      expect(auth.authorities).toEqual(["user1", "user2"]);
    });
  });

  describe("fetchLaunchpadBatchSubmitAuthorities", () => {
    it("should return existing authorizations", async () => {
      // Given
      const existingAuth = new LaunchpadBatchSubmitAuthorities([
        users.testUser1.identityKey,
        users.testUser2.identityKey
      ]);

      const { ctx } = fixture(LaunchpadContract).registeredUsers(users.testUser1).savedState(existingAuth);

      // When
      const result = await fetchLaunchpadBatchSubmitAuthorities(ctx);

      // Then
      expect(result).toBeInstanceOf(LaunchpadBatchSubmitAuthorities);
      expect(result.authorities).toContain(users.testUser1.identityKey);
      expect(result.authorities).toContain(users.testUser2.identityKey);
    });
  });

  describe("authorizeLaunchpadBatchSubmitter", () => {
    it("should authorize new users when caller is authorized", async () => {
      // Given
      const existingAuth = new LaunchpadBatchSubmitAuthorities([users.testUser1.identityKey]);

      const { ctx } = fixture(LaunchpadContract).registeredUsers(users.testUser1).savedState(existingAuth);

      const dto = new AuthorizeBatchSubmitterDto();
      dto.authorities = [users.testUser2.identityKey];
      dto.uniqueKey = randomUniqueKey();
      dto.sign(users.testUser1.privateKey);

      // When
      const result = await authorizeLaunchpadBatchSubmitter(ctx, dto);

      // Then
      expect(result).toBeInstanceOf(BatchSubmitAuthoritiesResDto);
      expect(result.authorities).toContain(users.testUser1.identityKey);
      expect(result.authorities).toContain(users.testUser2.identityKey);
    });

    it("should create new authorities object when none exists", async () => {
      // Given
      const { ctx } = fixture(LaunchpadContract).registeredUsers(users.testUser1);

      const dto = new AuthorizeBatchSubmitterDto();
      dto.authorities = [users.testUser1.identityKey, users.testUser2.identityKey];
      dto.uniqueKey = randomUniqueKey();
      dto.sign(users.testUser1.privateKey);

      // When
      const result = await authorizeLaunchpadBatchSubmitter(ctx, dto);

      // Then
      expect(result).toBeInstanceOf(BatchSubmitAuthoritiesResDto);
      expect(result.authorities).toContain(users.testUser1.identityKey);
      expect(result.authorities).toContain(users.testUser2.identityKey);
    });
  });

  describe("deauthorizeLaunchpadBatchSubmitter", () => {
    it("should deauthorize user when caller is authorized", async () => {
      // Given
      const existingAuth = new LaunchpadBatchSubmitAuthorities([
        users.testUser1.identityKey,
        users.testUser2.identityKey
      ]);

      const { ctx } = fixture(LaunchpadContract).registeredUsers(users.testUser1).savedState(existingAuth);

      const dto = new DeauthorizeBatchSubmitterDto();
      dto.authority = users.testUser2.identityKey;
      dto.uniqueKey = randomUniqueKey();
      dto.sign(users.testUser1.privateKey);

      // When
      const result = await deauthorizeLaunchpadBatchSubmitter(ctx, dto);

      // Then
      expect(result).toBeInstanceOf(BatchSubmitAuthoritiesResDto);
      expect(result.authorities).toContain(users.testUser1.identityKey);
      expect(result.authorities).not.toContain(users.testUser2.identityKey);
    });
  });

  describe("getLaunchpadBatchSubmitAuthorities", () => {
    it("should return current authorizations", async () => {
      // Given
      const existingAuth = new LaunchpadBatchSubmitAuthorities([
        users.testUser1.identityKey,
        users.testUser2.identityKey
      ]);

      const { ctx } = fixture(LaunchpadContract).registeredUsers(users.testUser1).savedState(existingAuth);

      const dto = new FetchBatchSubmitAuthoritiesDto();
      dto.uniqueKey = randomUniqueKey();
      dto.sign(users.testUser1.privateKey);

      // When
      const result = await getLaunchpadBatchSubmitAuthorities(ctx, dto);

      // Then
      expect(result).toBeInstanceOf(BatchSubmitAuthoritiesResDto);
      expect(result.authorities).toEqual([users.testUser1.identityKey, users.testUser2.identityKey]);
    });
  });

  describe("AuthorizeBatchSubmitter contract method", () => {
    it("should authorize new users through contract", async () => {
      // Given
      const existingAuth = new LaunchpadBatchSubmitAuthorities([users.admin.identityKey]);

      const { ctx, contract } = fixture(LaunchpadContract)
        .caClientIdentity("test-admin", "CuratorOrg")
        .registeredUsers(users.admin)
        .savedState(existingAuth);

      const dto = new AuthorizeBatchSubmitterDto();
      dto.authorities = [users.testUser2.identityKey];
      dto.uniqueKey = randomUniqueKey();
      dto.sign(users.admin.privateKey);

      const expectedResponse = plainToInstance(BatchSubmitAuthoritiesResDto, {
        authorities: [users.admin.identityKey, users.testUser2.identityKey]
      });

      // When
      const result = await contract.AuthorizeBatchSubmitter(ctx, dto);

      // Then
      expect(result).toEqual(transactionSuccess(expectedResponse));
    });
  });

  describe("DeauthorizeBatchSubmitter contract method", () => {
    it("should deauthorize user through contract", async () => {
      // Given
      const existingAuth = new LaunchpadBatchSubmitAuthorities([
        users.admin.identityKey,
        users.testUser2.identityKey
      ]);

      const { ctx, contract } = fixture(LaunchpadContract)
        .caClientIdentity("test-admin", "CuratorOrg")
        .registeredUsers(users.admin)
        .savedState(existingAuth);

      const dto = new DeauthorizeBatchSubmitterDto();
      dto.authority = users.testUser2.identityKey;
      dto.uniqueKey = randomUniqueKey();
      dto.sign(users.admin.privateKey);

      const expectedResponse = plainToInstance(BatchSubmitAuthoritiesResDto, {
        authorities: [users.admin.identityKey]
      });

      // When
      const result = await contract.DeauthorizeBatchSubmitter(ctx, dto);

      // Then
      expect(result).toEqual(transactionSuccess(expectedResponse));
    });
  });

  describe("GetBatchSubmitAuthorities contract method", () => {
    it("should return current authorizations through contract", async () => {
      // Given
      const existingAuth = new LaunchpadBatchSubmitAuthorities([
        users.testUser1.identityKey,
        users.testUser2.identityKey
      ]);

      const { ctx, contract } = fixture(LaunchpadContract)
        .registeredUsers(users.testUser1)
        .savedState(existingAuth);

      const dto = new FetchBatchSubmitAuthoritiesDto();
      dto.uniqueKey = randomUniqueKey();
      dto.sign(users.testUser1.privateKey);

      const expectedResponse = plainToInstance(BatchSubmitAuthoritiesResDto, {
        authorities: [users.testUser1.identityKey, users.testUser2.identityKey]
      });

      // When
      const result = await contract.GetBatchSubmitAuthorities(ctx, dto);

      // Then
      expect(result).toEqual(transactionSuccess(expectedResponse));
    });
  });
});
