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
  BigNumberIsNotNegative,
  BigNumberProperty,
  ChainKey,
  ChainObject,
  IsUserAlias,
  UserAlias
} from "@gala-chain/api";
import BigNumber from "bignumber.js";
import { Exclude } from "class-transformer";
import { IsInt, IsNotEmpty } from "class-validator";
import { JSONSchema } from "class-validator-jsonschema";

export interface ILaunchpadTradeData {
  vaultAddress: UserAlias;
  galaVolumeTraded: BigNumber;
  createdAt: number;
  lastUpdated: number;
}

@JSONSchema({
  description:
    "LaunchpadSale trade data, metrics, and/or analytics aggregated throughout the lifetime of the sale."
})
export class LaunchpadTradeData extends ChainObject {
  @Exclude()
  static INDEX_KEY = "GCLPTD"; //GalaChain LaunchPad Trade Data

  @ChainKey({ position: 0 })
  @IsUserAlias()
  @IsNotEmpty()
  public vaultAddress: UserAlias;

  @BigNumberIsNotNegative()
  @BigNumberProperty()
  public galaVolumeTraded: BigNumber;

  @IsInt()
  public createdAt: number;

  @IsInt()
  public lastUpdated: number;

  // constructor supports both new LaunchpadTradeData() and plainToInstance() / createValidChainObject()
  // instance initialization styles
  constructor(data: ILaunchpadTradeData) {
    super();
    this.vaultAddress = data?.vaultAddress ?? "";
    this.galaVolumeTraded = data?.galaVolumeTraded ?? new BigNumber(0);
    this.createdAt = data?.createdAt ?? 0;
    this.lastUpdated = data?.lastUpdated ?? 0;
  }
}
