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
import { ChainObject, IsUserAlias, UserAlias } from "@gala-chain/api";
import { Exclude } from "class-transformer";
import { ArrayNotEmpty, IsNotEmpty, IsNumber, Max, Min } from "class-validator";
import { JSONSchema } from "class-validator-jsonschema";

@JSONSchema({
  description: "Defines the platform fee address and authorized owners for modification."
})
export class LaunchpadFeeConfig extends ChainObject {
  @Exclude()
  public static INDEX_KEY = "GCLFC"; // GalaChain Launchpad Fee Configuration

  @IsNotEmpty()
  @IsUserAlias()
  feeAddress: UserAlias;

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  @Max(1)
  public feeAmount: number;

  @ArrayNotEmpty()
  @IsUserAlias({ each: true })
  authorities: UserAlias[];

  constructor(feeAddress: UserAlias, feeAmount: number, authorities: UserAlias[]) {
    super();
    this.feeAddress = feeAddress;
    this.feeAmount = feeAmount;
    this.authorities = authorities;
  }

  public updateFeeConfig(newfeeAddress: UserAlias, newFeeAmount: number, newAuthorities: UserAlias[]) {
    this.feeAddress = newfeeAddress;
    this.feeAmount = newFeeAmount;
    this.authorities = newAuthorities;
    this.validate();
  }
}
