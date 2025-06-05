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
import { GalaChainContext, galaFeeGate } from "@gala-chain/chaincode";

export enum FeeGateCodes {
  CreateSale = "CreateSale",
  BuyExactToken = "BuyExactToken",
  SellExactToken = "SellExactToken",
  BuyWithNative = "BuyWithNative",
  SellWithNative = "SellWithNative"
}

export async function createSaleFeeGate(ctx: GalaChainContext) {
  return galaFeeGate(ctx, { feeCode: FeeGateCodes.CreateSale });
}

export async function buyExactTokenFeeGate(ctx: GalaChainContext) {
  return galaFeeGate(ctx, { feeCode: FeeGateCodes.BuyExactToken });
}

export async function sellExactTokenFeeGate(ctx: GalaChainContext) {
  return galaFeeGate(ctx, { feeCode: FeeGateCodes.SellExactToken });
}

export async function buyWithNativeFeeGate(ctx: GalaChainContext) {
  return galaFeeGate(ctx, { feeCode: FeeGateCodes.BuyWithNative });
}

export async function sellWithNativeFeeGate(ctx: GalaChainContext) {
  return galaFeeGate(ctx, { feeCode: FeeGateCodes.SellWithNative });
}
