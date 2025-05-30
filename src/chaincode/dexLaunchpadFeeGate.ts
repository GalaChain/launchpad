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
import { ChainCallDTO } from "@gala-chain/api";
import { GalaChainContext, galaFeeGate } from "@gala-chain/chaincode";

import { AddLiquidityDTO, BurnDto, CollectDto, CreatePoolDto, SwapDto } from "../api";

export enum FeeGateCodes {
  CreatePool = "CreatePool",
  AddLiquidity = "AddLiquidity",
  Swap = "Swap",
  RemoveLiquidity = "RemoveLiquidity",
  CollectPositionFees = "CollectPositionFees",
  CreateSale = "CreateSale",
  BuyExactToken = "BuyExactToken",
  SellExactToken = "SellExactToken",
  BuyWithNative = "BuyWithNative",
  SellWithNative = "SellWithNative"
}

export async function createPoolFeeGate(ctx: GalaChainContext, dto: CreatePoolDto) {
  return galaFeeGate(ctx, { feeCode: FeeGateCodes.CreatePool });
}

export async function addLiquidityFeeGate(ctx: GalaChainContext, dto: AddLiquidityDTO) {
  return galaFeeGate(ctx, { feeCode: FeeGateCodes.AddLiquidity });
}

export async function removeLiquidityFeeGate(ctx: GalaChainContext, dto: BurnDto) {
  return galaFeeGate(ctx, { feeCode: FeeGateCodes.RemoveLiquidity });
}

export async function swapFeeGate(ctx: GalaChainContext, dto: SwapDto) {
  return galaFeeGate(ctx, { feeCode: FeeGateCodes.Swap });
}

export async function collectPositionFeesFeeGate(ctx: GalaChainContext, dto: CollectDto) {
  return galaFeeGate(ctx, { feeCode: FeeGateCodes.CollectPositionFees });
}

// Unused?
export async function createSaleFeeGate(ctx: GalaChainContext, dto: ChainCallDTO) {
  return galaFeeGate(ctx, { feeCode: FeeGateCodes.CreateSale });
}

// Unused?
export async function buyExactTokenFeeGate(ctx: GalaChainContext, dto: ChainCallDTO) {
  return galaFeeGate(ctx, { feeCode: FeeGateCodes.BuyExactToken });
}

// Unused?
export async function sellExactTokenFeeGate(ctx: GalaChainContext, dto: ChainCallDTO) {
  return galaFeeGate(ctx, { feeCode: FeeGateCodes.SellExactToken });
}

// Unused?
export async function buyWithNativeFeeGate(ctx: GalaChainContext, dto: ChainCallDTO) {
  return galaFeeGate(ctx, { feeCode: FeeGateCodes.BuyWithNative });
}

// Unused?
export async function sellWithNativeFeeGate(ctx: GalaChainContext, dto: ChainCallDTO) {
  return galaFeeGate(ctx, { feeCode: FeeGateCodes.SellWithNative });
}
