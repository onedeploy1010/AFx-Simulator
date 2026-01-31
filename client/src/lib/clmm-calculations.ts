// CLMM (Concentrated Liquidity Market Maker) — Uniswap V3 style simulation
// All formulas based on the Uniswap V3 whitepaper

export interface CLMMPosition {
  liquidity: number;       // L
  priceLower: number;      // Pa
  priceUpper: number;      // Pb
  tokenX: number;          // AF amount
  tokenY: number;          // USDC amount
}

export interface CLMMDailyResult {
  day: number;
  price: number;
  inRange: boolean;
  tokenX: number;          // AF
  tokenY: number;          // USDC
  positionValue: number;   // LP position value in USDC
  hodlValue: number;       // HODL value in USDC
  impermanentLoss: number; // IL in USDC
  impermanentLossPct: number;
  feesEarned: number;      // daily fee
  cumulativeFees: number;
  netPnl: number;          // cumulative fees - IL
  v2PositionValue: number;
  v2ImpermanentLoss: number;
}

export interface CLMMSimulationParams {
  depositX: number;        // AF deposit
  depositY: number;        // USDC deposit
  initialPrice: number;
  priceLower: number;      // Pa
  priceUpper: number;      // Pb
  feeTier: number;         // 0.0005 | 0.003 | 0.01
  dailyVolume: number;     // daily trade volume (USDC)
  dailyVolumes?: number[]; // per-day volume array (overrides dailyVolume)
  totalLiquidity: number;  // pool total liquidity (for fee share)
  days: number;
  priceTrajectory?: number[];
  manualPriceChangePct?: number;
}

// ---------- Core CLMM Math ----------

/**
 * Calculate liquidity L from deposit amounts + price range.
 * Uniswap V3 formula: depending on where current price sits relative to [Pa, Pb]
 */
export function calculateLiquidity(
  x: number,
  y: number,
  price: number,
  Pa: number,
  Pb: number
): number {
  const sqrtP = Math.sqrt(price);
  const sqrtPa = Math.sqrt(Pa);
  const sqrtPb = Math.sqrt(Pb);

  if (price <= Pa) {
    // All token X — price is below range
    if (x <= 0) return 0;
    return x * sqrtPa * sqrtPb / (sqrtPb - sqrtPa);
  } else if (price >= Pb) {
    // All token Y — price is above range
    if (y <= 0) return 0;
    return y / (sqrtPb - sqrtPa);
  } else {
    // Price in range — L is min of both constraints
    const Lx = x > 0 ? x * sqrtP * sqrtPb / (sqrtPb - sqrtP) : 0;
    const Ly = y > 0 ? y / (sqrtP - sqrtPa) : 0;
    if (Lx <= 0) return Ly;
    if (Ly <= 0) return Lx;
    return Math.min(Lx, Ly);
  }
}

/**
 * From L + current price + range, compute token amounts.
 */
export function calculateTokenAmounts(
  L: number,
  price: number,
  Pa: number,
  Pb: number
): { tokenX: number; tokenY: number } {
  const sqrtP = Math.sqrt(Math.max(price, 0));
  const sqrtPa = Math.sqrt(Pa);
  const sqrtPb = Math.sqrt(Pb);

  if (price <= Pa) {
    return {
      tokenX: L * (1 / sqrtPa - 1 / sqrtPb),
      tokenY: 0,
    };
  } else if (price >= Pb) {
    return {
      tokenX: 0,
      tokenY: L * (sqrtPb - sqrtPa),
    };
  } else {
    return {
      tokenX: L * (1 / sqrtP - 1 / sqrtPb),
      tokenY: L * (sqrtP - sqrtPa),
    };
  }
}

/**
 * Position value in USDC: x * P + y
 */
export function calculatePositionValue(
  L: number,
  price: number,
  Pa: number,
  Pb: number
): number {
  const { tokenX, tokenY } = calculateTokenAmounts(L, price, Pa, Pb);
  return tokenX * price + tokenY;
}

/**
 * HODL value: just hold the initial tokens.
 */
export function calculateHodlValue(
  initialX: number,
  initialY: number,
  currentPrice: number
): number {
  return initialX * currentPrice + initialY;
}

/**
 * Impermanent loss = HODL value - Position value (positive means LP underperforms)
 */
export function calculateImpermanentLoss(
  hodlValue: number,
  positionValue: number
): { absolute: number; percentage: number } {
  const absolute = hodlValue - positionValue;
  const percentage = hodlValue > 0 ? (absolute / hodlValue) * 100 : 0;
  return { absolute, percentage };
}

/**
 * Capital efficiency multiplier vs V2 full-range.
 * Formula: 1 / (1 - sqrt(Pa/Pb))
 */
export function calculateCapitalEfficiency(Pa: number, Pb: number): number {
  if (Pb <= 0 || Pa <= 0 || Pa >= Pb) return 1;
  return 1 / (1 - Math.sqrt(Pa / Pb));
}

/**
 * Fee accrual per day for our position.
 * Only earns when price is in range.
 * fee = (L / totalL) * volume * feeRate * inRange
 */
export function calculateFeeAccrual(
  L: number,
  totalL: number,
  volume: number,
  feeRate: number,
  inRange: boolean
): number {
  if (!inRange || totalL <= 0 || L <= 0) return 0;
  return (L / totalL) * volume * feeRate;
}

/**
 * V2 (full-range AMM) position value.
 * V2 formula: value = 2 * sqrt(k * P)
 * where k = x0 * y0 = initialValue^2 / (4 * P0)
 * So: value = initialValue * sqrt(P / P0)  ... simplified
 * More precisely: V2_value = 2 * sqrt(x0 * y0 * P)
 * If we deposited half-half at P0:  x0 = V/(2*P0), y0 = V/2
 * k = x0*y0 = V^2/(4*P0), value = 2*sqrt(V^2*P/(4*P0)) = V*sqrt(P/P0)
 */
export function calculateV2PositionValue(
  initialValue: number,
  P0: number,
  P: number
): number {
  if (P0 <= 0 || P <= 0) return initialValue;
  return initialValue * Math.sqrt(P / P0);
}

/**
 * Generate a price trajectory using random walk or manual percentage drift.
 * If priceTrajectory is provided, use it directly.
 * If manualPct is provided, apply daily drift.
 * Otherwise, random walk with moderate volatility.
 */
export function generatePriceTrajectory(
  initialPrice: number,
  days: number,
  existing?: number[],
  manualPct?: number
): number[] {
  // Use existing trajectory if provided and long enough
  if (existing && existing.length >= days) {
    return existing.slice(0, days);
  }

  const prices: number[] = [];
  let price = initialPrice;

  if (manualPct !== undefined) {
    // Constant daily drift
    const dailyFactor = 1 + manualPct / 100;
    for (let i = 0; i < days; i++) {
      price *= dailyFactor;
      prices.push(Math.max(price, 0.000001));
    }
  } else if (existing && existing.length > 0) {
    // Use existing prices then continue with last known price drift
    for (let i = 0; i < days; i++) {
      if (i < existing.length) {
        prices.push(existing[i]);
        price = existing[i];
      } else {
        // Continue with slight random drift from last known price
        const dailyReturn = (Math.random() - 0.5) * 0.04; // +-2% daily vol
        price *= 1 + dailyReturn;
        prices.push(Math.max(price, 0.000001));
      }
    }
  } else {
    // Pure random walk
    for (let i = 0; i < days; i++) {
      const dailyReturn = (Math.random() - 0.5) * 0.06; // +-3% daily vol
      price *= 1 + dailyReturn;
      prices.push(Math.max(price, 0.000001));
    }
  }

  return prices;
}

/**
 * Main simulation entry point.
 * Runs day-by-day and returns CLMMDailyResult[].
 */
export function runCLMMSimulation(params: CLMMSimulationParams): CLMMDailyResult[] {
  const {
    depositX,
    depositY,
    initialPrice,
    priceLower: Pa,
    priceUpper: Pb,
    feeTier,
    dailyVolume,
    dailyVolumes,
    totalLiquidity,
    days,
    priceTrajectory,
    manualPriceChangePct,
  } = params;

  // Generate price path
  const prices = generatePriceTrajectory(
    initialPrice,
    days,
    priceTrajectory,
    manualPriceChangePct
  );

  // Calculate initial liquidity from deposit
  const L = calculateLiquidity(depositX, depositY, initialPrice, Pa, Pb);

  // Initial token amounts (may differ from deposit if price is at boundary)
  const initial = calculateTokenAmounts(L, initialPrice, Pa, Pb);
  const initialX = initial.tokenX;
  const initialY = initial.tokenY;
  const initialValue = initialX * initialPrice + initialY;

  // V2 initial value (same total deposit)
  const v2InitialValue = depositX * initialPrice + depositY;

  const results: CLMMDailyResult[] = [];
  let cumulativeFees = 0;

  for (let day = 1; day <= days; day++) {
    const price = prices[day - 1];
    const inRange = price >= Pa && price <= Pb;

    // Current token amounts at this price
    const { tokenX, tokenY } = calculateTokenAmounts(L, price, Pa, Pb);
    const positionValue = tokenX * price + tokenY;

    // HODL: hold initial tokens without providing liquidity
    const hodlValue = calculateHodlValue(initialX, initialY, price);

    // Impermanent loss
    const il = calculateImpermanentLoss(hodlValue, positionValue);

    // Fee earned today (use per-day volume if available)
    const vol = dailyVolumes?.[day - 1] ?? dailyVolume;
    const feesEarned = calculateFeeAccrual(L, totalLiquidity, vol, feeTier, inRange);
    cumulativeFees += feesEarned;

    // Net PnL = cumulative fees - impermanent loss
    const netPnl = cumulativeFees - il.absolute;

    // V2 comparison
    const v2PositionValue = calculateV2PositionValue(v2InitialValue, initialPrice, price);
    const v2HodlValue = calculateHodlValue(depositX, depositY, price);
    const v2IL = v2HodlValue - v2PositionValue;

    results.push({
      day,
      price,
      inRange,
      tokenX,
      tokenY,
      positionValue,
      hodlValue,
      impermanentLoss: il.absolute,
      impermanentLossPct: il.percentage,
      feesEarned,
      cumulativeFees,
      netPnl,
      v2PositionValue,
      v2ImpermanentLoss: v2IL,
    });
  }

  return results;
}
