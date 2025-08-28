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
import { ChainCallDTO, GalaChainErrorResponse, NotFoundError } from "@gala-chain/api";
import { fixture, users } from "@gala-chain/test";

import { LaunchpadFeeConfig } from "../../api/types";
import { LaunchpadContract } from "../LaunchpadContract";

describe("fetchLaunchpadFeeAmount", () => {
  it("Should return the feeAmount when LaunchpadFeeConfig exists", async () => {
    //Given
    const launchpadConfig = new LaunchpadFeeConfig(users.testUser2.identityKey, Number("0.32"), [
      users.testUser2.identityKey
    ]);

    const { ctx, contract } = fixture(LaunchpadContract)
      .registeredUsers(users.testUser3)
      .savedState(launchpadConfig);

    const dto = new ChainCallDTO();

    dto.sign(users.testUser3.privateKey);

    //When
    const res = await contract.FetchLaunchpadFeeAmount(ctx);

    //Then
    expect(res.Data).toEqual(0.32);
  });

  it("Should revert when LaunchpadFeeConfig  does not exists", async () => {
    //Given

    const { ctx, contract } = fixture(LaunchpadContract).registeredUsers(users.testUser3);

    const dto = new ChainCallDTO();

    dto.sign(users.testUser3.privateKey);

    //When
    const res = await contract.FetchLaunchpadFeeAmount(ctx);

    //Then
    expect(res).toEqual(
      new GalaChainErrorResponse(
        new NotFoundError("Platform fee configuration has yet to be defined. Fee amount is not available.")
      )
    );
  });
});
