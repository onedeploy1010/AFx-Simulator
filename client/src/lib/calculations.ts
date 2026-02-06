import type { NMSConfig, StakingOrder, TradingSimulation, AAMPool, DailySimulation, OrderReleaseProgress, PackageConfig, DaysConfig, OrderDailyDetail } from "@shared/schema";

// Calculate trading fee rate based on staking amount
export function calculateTradingFeeRate(
  stakingAmount: number,
  maxStaking: number,
  minRate: number,
  maxRate: number
): number {
  if (stakingAmount >= maxStaking) return minRate;
  if (stakingAmount <= 0) return maxRate;
  
  const ratio = stakingAmount / maxStaking;
  return maxRate - (maxRate - minRate) * ratio;
}

// Calculate daily MS release
export function calculateDailyAFRelease(
  order: StakingOrder,
  config: NMSConfig,
  msPrice: number
): number {
  const packageConfig = config.packageConfigs.find(p => p.tier === order.packageTier);
  if (!packageConfig) return 0;

  // Check if staking is enabled
  if (!config.stakingEnabled) return 0;

  const stakingDays = order.daysStaked;
  const releaseMultiplier = packageConfig.releaseMultiplier;

  if (config.msReleaseMode === 'coin_standard') {
    // Coin standard: totalAF = (amount / msPrice) × multiplier, dailyAF = totalAF / stakingDays
    const coinQuantity = order.amount / msPrice;
    const totalMs = coinQuantity * releaseMultiplier;
    return totalMs / stakingDays;
  } else {
    // Gold standard: totalUSDC = amount × multiplier, dailyUSDC = totalUSDC / stakingDays, dailyAF = dailyUSDC / msPrice
    const totalUsdc = order.amount * releaseMultiplier;
    const dailyUsdc = totalUsdc / stakingDays;
    return dailyUsdc / msPrice;
  }
}

// Calculate linear daily release (principal + interest) for package mode
// Coin standard: totalAF = (amount / msPrice) × releaseMultiplier, dailyAF = totalAF / stakingDays
// Gold standard: totalUSDC = amount × releaseMultiplier, dailyUSDC = totalUSDC / stakingDays, dailyAF = dailyUSDC / msPrice
export function calculateLinearDailyRelease(
  order: StakingOrder,
  config: NMSConfig,
  msPrice: number
): { dailyMs: number; principalUsdc: number; interestUsdc: number } {
  const packageConfig = config.packageConfigs.find(p => p.tier === order.packageTier);
  if (!packageConfig || !config.stakingEnabled) return { dailyMs: 0, principalUsdc: 0, interestUsdc: 0 };

  const stakingDays = order.daysStaked;
  const releaseMultiplier = packageConfig.releaseMultiplier;

  if (config.msReleaseMode === 'coin_standard') {
    // Coin standard: totalAF = (amount / msPrice) × multiplier, dailyAF = totalAF / stakingDays
    const coinQuantity = order.amount / msPrice;
    const totalMs = coinQuantity * releaseMultiplier;
    const dailyMs = totalMs / stakingDays;
    // Principal component (USDC equivalent)
    const principalUsdc = order.amount / stakingDays;
    // Interest component = total daily value minus principal
    const interestUsdc = Math.max(0, (dailyMs * msPrice) - principalUsdc);
    return { dailyMs, principalUsdc, interestUsdc };
  } else {
    // Gold standard: totalUSDC = amount × multiplier, dailyUSDC = totalUSDC / stakingDays, dailyAF = dailyUSDC / msPrice
    const totalUsdc = order.amount * releaseMultiplier;
    const dailyUsdc = totalUsdc / stakingDays;
    const dailyMs = dailyUsdc / msPrice;
    // Principal component
    const principalUsdc = order.amount / stakingDays;
    // Interest component = total daily USDC minus principal
    const interestUsdc = Math.max(0, dailyUsdc - principalUsdc);
    return { dailyMs, principalUsdc, interestUsdc };
  }
}

// Calculate days mode daily release
// Uses stored totalMsToRelease (fixed at order creation time based on entry AAM price)
// Falls back to current price calculation only if stored value is not available
// dailyMs = totalMsToRelease / durationDays
export function calculateDaysModeDailyRelease(
  order: StakingOrder,
  daysConfig: DaysConfig,
  msPrice: number
): { dailyMs: number; totalMsToRelease: number } {
  // Use stored totalMsToRelease from order creation time (fixed at entry price)
  // Only fallback to current price calculation if not stored
  const totalMsToRelease = (order.totalMsToRelease && order.totalMsToRelease > 0)
    ? order.totalMsToRelease
    : (order.amount / msPrice) * daysConfig.releaseMultiplier;
  const dailyMs = totalMsToRelease / (order.durationDays || daysConfig.days);
  return { dailyMs, totalMsToRelease };
}

// Check if multiplier cap has been reached (days mode)
export function isMultiplierCapReached(
  cumMsReleased: number,
  msPrice: number,
  principal: number,
  releaseMultiplier: number
): boolean {
  return cumMsReleased * msPrice >= principal * releaseMultiplier;
}

// Calculate dividend pool profit for a single order
export function calculateDividendPoolProfit(
  personalUnclaimedMs: number,
  totalUnclaimedMs: number,
  totalMsReleased: number,
  totalAfxMultiplier: number,
  principal: number,
  totalDepositAmount: number,
  config: NMSConfig,
  daysConfig: { tradingFeeRate: number; profitSharePercent: number }
): {
  margin: number;
  weight: number;
  poolCapital: number;
  dailyPoolProfit: number;
  personalShare: number;
  userProfit: number;
  platformProfit: number;
  brokerProfit: number;
  tradingFee: number;
} {
  // Margin = (personalUnclaimedMs / totalAfxMultiplier) × principal × marginMultiplier
  const margin = totalAfxMultiplier > 0
    ? (personalUnclaimedMs / totalAfxMultiplier) * principal * config.dividendMarginMultiplier
    : 0;

  // Weight = personalUnclaimedMs / totalUnclaimedMs
  const weight = totalUnclaimedMs > 0 ? personalUnclaimedMs / totalUnclaimedMs : 0;

  // Trading pool capital = totalDepositAmount × (depositTradingPoolRatio / 100)
  const poolCapital = totalDepositAmount * (config.depositTradingPoolRatio / 100);

  // Daily pool profit = poolCapital × (poolDailyProfitRate / 100)
  const dailyPoolProfit = poolCapital * (config.poolDailyProfitRate / 100);

  // Personal share = dailyPoolProfit × weight
  const personalShare = dailyPoolProfit * weight;

  // Apply fee and profit sharing (same as individual mode)
  const tradingFee = personalShare * (daysConfig.tradingFeeRate / 100);
  const netProfit = Math.max(0, personalShare - tradingFee);
  const userProfit = netProfit * (daysConfig.profitSharePercent / 100);
  const remainingProfit = netProfit - userProfit;
  const platformProfit = remainingProfit * 0.5;
  const brokerProfit = remainingProfit * 0.5;

  return {
    margin,
    weight,
    poolCapital,
    dailyPoolProfit,
    personalShare,
    userProfit,
    platformProfit,
    brokerProfit,
    tradingFee,
  };
}

// Calculate MS-based trading capital
// Trading capital = un-withdrawn MS value in USDC (msKeptInSystem * msPrice)
export function calculateAfBasedTradingCapital(
  msKeptInSystem: number,
  msPrice: number
): number {
  return msKeptInSystem * msPrice;
}

// Calculate MS exit distribution based on per-order withdrawal ratio
// withdrawPercent: 0 = all MS held (= trading capital), 100 = all MS withdrawn (burn + sell)
// Held MS automatically becomes trading capital (held MS * price = trading capital value)
export function calculateAFExitDistribution(
  msReleased: number,
  _msPrice: number,
  withdrawPercent: number,
  config: NMSConfig
): {
  toWithdrawMs: number; // MS withdrawn (before burn)
  toHoldMs: number; // MS held in system = trading capital
  toBurnMs: number; // MS burned (from withdraw portion)
  toSecondaryMarketMs: number; // Net MS to secondary market after burn
} {
  const wp = Math.max(0, Math.min(100, withdrawPercent));

  // Two-way split: withdraw vs hold
  const toWithdrawMs = msReleased * (wp / 100);
  const toHoldMs = msReleased * ((100 - wp) / 100);

  // From withdrawn portion, some gets burned (msExitBurnRatio, default 20%)
  const toBurnMs = toWithdrawMs * (config.msExitBurnRatio / 100);
  const toSecondaryMarketMs = toWithdrawMs - toBurnMs;

  return {
    toWithdrawMs,
    toHoldMs,
    toBurnMs,
    toSecondaryMarketMs,
  };
}

// Calculate trading simulation
// tradingCapital: The capital used for trading
// profitRate: Expected profit rate per trade (e.g., 0.02 = 2%)
export function calculateTradingSimulation(
  tradingCapital: number,
  profitRate: number,
  tradingFeeRate: number,
  userProfitSharePercent: number,
  config: NMSConfig
): TradingSimulation {
  // Calculate gross profit from trading
  const grossProfit = tradingCapital * profitRate;
  
  // Trading fee is deducted from gross profit (not trading capital)
  const tradingFee = grossProfit * (tradingFeeRate / 100);
  
  // Net profit after fees
  const netProfit = Math.max(0, grossProfit - tradingFee);
  
  // User takes their share of net profit
  const userProfit = netProfit * (userProfitSharePercent / 100);
  
  // Remaining profit split 50/50 between platform and broker
  const remainingProfit = netProfit - userProfit;
  const platformProfit = remainingProfit * 0.5;
  const brokerProfit = remainingProfit * 0.5;
  
  // Fund flow split - applied to trading capital (transaction funds) per requirement
  // 30% USDC + 30% MS -> LP pool (AAM)
  // 20% -> buyback MS
  // 50% -> forex reserve
  const lpContributionUsdc = tradingCapital * (config.lpPoolUsdcRatio / 100);
  const lpContributionAf = tradingCapital * (config.lpPoolMsRatio / 100);
  const lpContribution = lpContributionUsdc + lpContributionAf;
  const buybackAmount = tradingCapital * (config.buybackRatio / 100);
  const reserveAmount = tradingCapital * (config.reserveRatio / 100);
  
  return {
    tradeVolume: tradingCapital,
    tradingFee,
    userProfit,
    platformProfit,
    brokerProfit,
    lpContribution,
    buybackAmount,
    reserveAmount,
  };
}

// Legacy wrapper for backward compatibility
export function calculateTradingSimulationLegacy(
  tradeVolume: number,
  feeRate: number,
  userProfitSharePercent: number,
  config: NMSConfig
): TradingSimulation {
  // Assume 5% profit rate as default for simulation
  return calculateTradingSimulation(tradeVolume, 0.05, feeRate, userProfitSharePercent, config);
}

// ============================================================
// Broker system — MS layer income + trading dividend
// ============================================================

/** Get the layer rate (%) for a given layer number from config */
export function getLayerRate(layer: number, config: NMSConfig): number {
  for (const lr of config.brokerLayerRates) {
    if (layer >= lr.fromLayer && layer <= lr.toLayer) return lr.ratePercent;
  }
  return 0;
}

/** Get the max accessible layer for a broker level */
export function getMaxLayer(brokerLevel: string, config: NMSConfig): number {
  const entry = config.brokerLevelAccess.find(e => e.level === brokerLevel);
  return entry?.maxLayer ?? 0;
}

/**
 * Calculate broker MS layer income for a 20-layer tree.
 * Each layer has MS released; the broker earns `ratePercent%` of each accessible layer.
 * Inaccessible layers' earnings are "compressed" (passed up to higher-level brokers).
 */
export function calculateBrokerLayerMsIncome(
  msReleasedPerLayer: number[],
  brokerLevel: string,
  config: NMSConfig
): {
  layers: { layer: number; msReleased: number; rate: number; earnings: number; accessible: boolean }[];
  totalEarnings: number;
  compressedEarnings: number;
} {
  const maxLayer = getMaxLayer(brokerLevel, config);
  const layers: { layer: number; msReleased: number; rate: number; earnings: number; accessible: boolean }[] = [];
  let totalEarnings = 0;
  let compressedEarnings = 0;

  for (let i = 0; i < 20; i++) {
    const layer = i + 1;
    const af = msReleasedPerLayer[i] || 0;
    const rate = getLayerRate(layer, config);
    const earnings = af * (rate / 100);
    const accessible = layer <= maxLayer;

    if (accessible) {
      totalEarnings += earnings;
    } else {
      compressedEarnings += earnings;
    }

    layers.push({ layer, msReleased: af, rate, earnings, accessible });
  }

  return { layers, totalEarnings, compressedEarnings };
}

/**
 * Calculate broker dividend pool from trading profit flow.
 * grossProfit → subtract tradingFee → netProfit → user share → remaining 50% broker / 50% platform
 */
export function calculateBrokerDividendPool(
  grossProfit: number,
  tradingFee: number,
  profitSharePercent: number
): { userShare: number; brokerDividendPool: number; platformShare: number } {
  const netProfit = Math.max(0, grossProfit - tradingFee);
  const userShare = netProfit * (profitSharePercent / 100);
  const remaining = netProfit - userShare;
  return {
    userShare,
    brokerDividendPool: remaining * 0.5,
    platformShare: remaining * 0.5,
  };
}

/**
 * Calculate broker trading dividend using differential (级差) system.
 * Each level has a dividend rate; the broker earns (own rate - subordinate rate) of the pool.
 */
export function calculateBrokerTradingDividend(
  brokerDividendPool: number,
  brokerLevel: string,
  subordinateLevel: string | null,
  config: NMSConfig
): { brokerRate: number; subRate: number; differentialRate: number; earnings: number } {
  const levels = config.brokerLevelAccess.map(e => e.level);
  const brokerIdx = levels.indexOf(brokerLevel);
  const subIdx = subordinateLevel ? levels.indexOf(subordinateLevel) : -1;

  const brokerRate = brokerIdx >= 0 ? (config.brokerDividendRates[brokerIdx] ?? 0) : 0;
  const subRate = subIdx >= 0 ? (config.brokerDividendRates[subIdx] ?? 0) : 0;
  const differentialRate = Math.max(0, brokerRate - subRate);
  const earnings = brokerDividendPool * (differentialRate / 100);

  return { brokerRate, subRate, differentialRate, earnings };
}

// Simulate AAM pool state after operations
// Handles: LP addition, MS sell to pool (secondary market), buyback, burn
export function simulateAAMPool(
  currentPool: AAMPool,
  usdcAddedToLp: number, // USDC added to LP pool
  msAddedToLp: number, // MS added to LP pool (for LP ratio)
  msSoldToPool: number, // MS sold to pool (secondary market exit, increases MS, decreases USDC)
  burnMs: number, // MS burned (direct MS units)
  buybackUsdc: number = 0 // USDC used to buy MS from pool (price UP)
): AAMPool {
  let newPool = { ...currentPool };

  // Step 1: Add liquidity (both USDC and MS in ratio) - price stays same
  if (usdcAddedToLp > 0 || msAddedToLp > 0) {
    newPool.usdcBalance += usdcAddedToLp;
    newPool.msBalance += msAddedToLp;
  }

  // Step 2: MS sold to pool (secondary market exit)
  // MS enters pool, USDC exits -> price DECREASES
  if (msSoldToPool > 0) {
    const usdcReceived = msSoldToPool * newPool.msPrice;
    const maxUsdcWithdraw = Math.max(0, newPool.usdcBalance - 1);
    const actualUsdcOut = Math.min(usdcReceived, maxUsdcWithdraw);
    const actualAfIn = actualUsdcOut / newPool.msPrice;

    newPool.msBalance += actualAfIn;
    newPool.usdcBalance -= actualUsdcOut;
  }

  // Step 3: Buyback MS (USDC enters pool, MS exits -> price INCREASES)
  if (buybackUsdc > 0 && newPool.msBalance > 1 && newPool.msPrice > 0) {
    const maxAfCanBuy = Math.max(0, newPool.msBalance - 1);
    const afWantToBuy = buybackUsdc / newPool.msPrice;
    const afBought = Math.min(afWantToBuy, maxAfCanBuy);
    if (afBought > 0) {
      const actualUsdc = afBought * newPool.msPrice;
      newPool.usdcBalance += actualUsdc;
      newPool.msBalance -= afBought;
      newPool.totalBuyback += actualUsdc;
    }
  }

  // Step 4: Burn MS (removed from supply, not from pool)
  newPool.totalBurn += burnMs;

  // Recalculate price
  newPool.msBalance = Math.max(1, newPool.msBalance);
  newPool.msPrice = newPool.usdcBalance / newPool.msBalance;
  newPool.lpTokens = Math.sqrt(newPool.usdcBalance * newPool.msBalance);

  return newPool;
}

// ============================================================
// CLMM price trajectory generator (deterministic seeded random)
// ============================================================

// Simple deterministic PRNG (mulberry32) for reproducible price paths
function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Box-Muller transform: convert uniform [0,1) pair to standard normal
function boxMuller(u1: number, u2: number): number {
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/**
 * Generate a CLMM price trajectory with drift, volatility, and range clamping.
 * Uses deterministic seed so same parameters → same price path.
 */
export function generateCLMMPriceTrajectory(
  initialPrice: number,
  days: number,
  config: NMSConfig,
  totalMintedUsdc: number
): number[] {
  const effectiveVolatility =
    config.clmmBaseVolatilityPct + (totalMintedUsdc / 1000) * config.clmmVolatilityPerThousandUsdc;
  const priceLower = initialPrice * (1 - config.clmmPriceRangePct / 100);
  const priceUpper = initialPrice * (1 + config.clmmPriceRangePct / 100);
  const drift = config.clmmDriftPct / 100;
  const vol = effectiveVolatility / 100;

  // Deterministic seed based on parameters
  const seed = Math.round(days * 1000 + totalMintedUsdc * 7 + initialPrice * 13 + config.clmmPriceRangePct * 31);
  const rng = mulberry32(seed);

  const prices: number[] = [];
  let price = initialPrice;

  for (let d = 0; d < days; d++) {
    const u1 = Math.max(1e-10, rng()); // avoid log(0)
    const u2 = rng();
    const z = boxMuller(u1, u2);
    // Geometric Brownian Motion step
    price = price * (1 + drift + vol * z);
    // Clamp to range
    price = Math.max(priceLower, Math.min(priceUpper, price));
    prices.push(price);
  }

  return prices;
}

// Simulation result type including per-order daily details
export interface SimulationResult {
  dailySimulations: DailySimulation[];
  orderDailyDetails: Map<string, OrderDailyDetail[]>;
}

// Run full simulation for N days
// Supports both package mode and days mode orders
export function runSimulation(
  orders: StakingOrder[],
  config: NMSConfig,
  days: number,
  initialPool: AAMPool
): DailySimulation[] {
  const result = runSimulationWithDetails(orders, config, days, initialPool);
  return result.dailySimulations;
}

// Run full simulation returning both daily summaries and per-order details
export function runSimulationWithDetails(
  orders: StakingOrder[],
  config: NMSConfig,
  days: number,
  initialPool: AAMPool
): SimulationResult {
  const results: DailySimulation[] = [];
  const orderDailyDetails = new Map<string, OrderDailyDetail[]>();
  let currentPool = { ...initialPool };

  // Pre-generate CLMM price trajectory if using CLMM price source
  const useCLMMPrice = config.priceSource === 'clmm';
  let clmmPrices: number[] = [];
  if (useCLMMPrice) {
    const totalMintedUsdc = orders.reduce((sum, o) => sum + o.amount, 0);
    clmmPrices = generateCLMMPriceTrajectory(
      currentPool.msPrice,
      days,
      config,
      totalMintedUsdc
    );
  }

  // Initialize per-order tracking state
  const orderState = new Map<string, { cumMsReleased: number; msKeptInSystem: number; msWithdrawn: number }>();
  for (const order of orders) {
    orderState.set(order.id, { cumMsReleased: 0, msKeptInSystem: 0, msWithdrawn: 0 });
    orderDailyDetails.set(order.id, []);
  }

  for (let day = 1; day <= days; day++) {
    // Determine effective price for this day (CLMM simulated or AAM pool)
    const effectivePrice = useCLMMPrice ? clmmPrices[day - 1] : currentPool.msPrice;

    let totalMsReleased = 0;
    let totalUserProfit = 0;
    let totalPlatformProfit = 0;
    let totalBrokerProfit = 0;
    let totalTradingFee = 0;
    let totalBurn = 0;
    let totalToSecondaryMarket = 0;
    let totalTradingVolume = 0;
    let totalLpContributionUsdc = 0;
    let totalLpContributionAf = 0;
    let totalAfSellingRevenue = 0;
    let totalBuybackUsdc = 0;

    for (const order of orders) {
      const state = orderState.get(order.id)!;
      const orderMode = order.mode || 'package';
      const startDay = order.startDay || 0;
      const effectiveDay = day - startDay; // Days since this order started

      // Order hasn't started yet
      if (effectiveDay < 1) {
        orderDailyDetails.get(order.id)?.push({
          day, orderId: order.id,
          principalRelease: 0, interestRelease: 0, dailyMsRelease: 0,
          msPrice: effectivePrice, cumMsReleased: state.cumMsReleased,
          msInSystem: state.msKeptInSystem, tradingCapital: 0,
          forexIncome: 0, withdrawnMs: 0, withdrawFee: 0,
        });
        continue;
      }

      if (orderMode === 'days') {
        // Days mode order
        const daysConfig = config.daysConfigs?.find(d => d.days === order.durationDays);
        if (!daysConfig) continue;

        const durationDays = order.durationDays || daysConfig.days;
        const capValue = order.amount * daysConfig.releaseMultiplier;

        // Check if multiplier cap already reached (uses effectivePrice)
        const alreadyCapped = config.multiplierCapEnabled &&
          isMultiplierCapReached(state.cumMsReleased, effectivePrice, order.amount, daysConfig.releaseMultiplier);

        // Check if release period has passed OR already capped
        if (effectiveDay > durationDays || alreadyCapped) {
          // Even after cap/completion, if MS kept in system, continue trading income
          const tradingCapital = calculateAfBasedTradingCapital(state.msKeptInSystem, effectivePrice);
          const canTrade = effectiveDay > config.releaseStartsTradingDays;
          let forexIncome = 0;

          if (canTrade && tradingCapital > 0 && config.tradingMode === 'individual') {
            const dailyTradingVolume = tradingCapital * (config.dailyTradingVolumePercent / 100);
            totalTradingVolume += dailyTradingVolume;

            const tradingSim = calculateTradingSimulation(
              dailyTradingVolume,
              daysConfig.tradingProfitRate / 100,
              daysConfig.tradingFeeRate,
              daysConfig.profitSharePercent,
              config
            );

            forexIncome = tradingSim.userProfit;
            totalUserProfit += tradingSim.userProfit;
            totalPlatformProfit += tradingSim.platformProfit;
            totalBrokerProfit += tradingSim.brokerProfit;
            totalTradingFee += tradingSim.tradingFee;
            totalBuybackUsdc += tradingSim.buybackAmount;
            totalLpContributionUsdc += dailyTradingVolume * (config.lpPoolUsdcRatio / 100);
            totalLpContributionAf += dailyTradingVolume * (config.lpPoolMsRatio / 100);
          }

          orderDailyDetails.get(order.id)?.push({
            day, orderId: order.id,
            principalRelease: 0, interestRelease: 0, dailyMsRelease: 0,
            msPrice: effectivePrice, cumMsReleased: state.cumMsReleased,
            msInSystem: state.msKeptInSystem,
            tradingCapital,
            forexIncome, withdrawnMs: 0, withdrawFee: 0,
          });
          continue;
        }

        // Calculate daily MS release for days mode (uses effectivePrice)
        let { dailyMs } = calculateDaysModeDailyRelease(order, daysConfig, effectivePrice);

        // Apply multiplier cap: truncate if this release would exceed cap
        if (config.multiplierCapEnabled) {
          const currentValue = state.cumMsReleased * effectivePrice;
          const afterValue = (state.cumMsReleased + dailyMs) * effectivePrice;
          if (afterValue >= capValue) {
            // Truncate: release only enough to reach cap exactly
            const remainingValue = Math.max(0, capValue - currentValue);
            dailyMs = effectivePrice > 0 ? remainingValue / effectivePrice : 0;
          }
        }

        totalMsReleased += dailyMs;
        state.cumMsReleased += dailyMs;

        // Apply exit distribution using per-order withdrawal ratio
        const exitDist = calculateAFExitDistribution(dailyMs, effectivePrice, order.withdrawPercent ?? 60, config);
        totalBurn += exitDist.toBurnMs;
        totalToSecondaryMarket += exitDist.toSecondaryMarketMs;

        // Track MS state: withdrawn vs held (held MS = trading capital)
        state.msWithdrawn += exitDist.toWithdrawMs;
        state.msKeptInSystem += exitDist.toHoldMs;

        // Calculate USDC revenue from selling withdrawn MS to LP pool
        totalAfSellingRevenue += exitDist.toSecondaryMarketMs * effectivePrice;

        // Trading capital from un-withdrawn MS
        const tradingCapital = calculateAfBasedTradingCapital(state.msKeptInSystem, effectivePrice);

        // If MS kept (not withdrawn), generate trading income (individual mode only here; dividend_pool handled in second pass)
        const canTrade = effectiveDay > config.releaseStartsTradingDays;
        let forexIncome = 0;
        if (canTrade && tradingCapital > 0 && config.tradingMode === 'individual') {
          const dailyTradingVolume = tradingCapital * (config.dailyTradingVolumePercent / 100);
          totalTradingVolume += dailyTradingVolume;

          const tradingSim = calculateTradingSimulation(
            dailyTradingVolume,
            daysConfig.tradingProfitRate / 100,
            daysConfig.tradingFeeRate,
            daysConfig.profitSharePercent,
            config
          );

          forexIncome = tradingSim.userProfit;
          totalUserProfit += tradingSim.userProfit;
          totalPlatformProfit += tradingSim.platformProfit;
          totalBrokerProfit += tradingSim.brokerProfit;
          totalTradingFee += tradingSim.tradingFee;
          totalBuybackUsdc += tradingSim.buybackAmount;
          totalLpContributionUsdc += dailyTradingVolume * (config.lpPoolUsdcRatio / 100);
          totalLpContributionAf += dailyTradingVolume * (config.lpPoolMsRatio / 100);
        }

        orderDailyDetails.get(order.id)?.push({
          day, orderId: order.id,
          principalRelease: 0, // Days mode doesn't split principal/interest
          interestRelease: 0,
          dailyMsRelease: dailyMs,
          msPrice: effectivePrice,
          cumMsReleased: state.cumMsReleased,
          msInSystem: state.msKeptInSystem,
          tradingCapital,
          forexIncome,
          withdrawnMs: exitDist.toWithdrawMs,
          withdrawFee: 0,
        });

      } else {
        // Package mode order (existing logic with linear release)
        const packageConfig = config.packageConfigs.find(p => p.tier === order.packageTier);
        if (!packageConfig) continue;

        // Check if staking period has passed
        if (!config.stakingEnabled || effectiveDay > order.daysStaked) {
          orderDailyDetails.get(order.id)?.push({
            day, orderId: order.id,
            principalRelease: 0, interestRelease: 0, dailyMsRelease: 0,
            msPrice: effectivePrice, cumMsReleased: state.cumMsReleased,
            msInSystem: state.msKeptInSystem, tradingCapital: 0,
            forexIncome: 0, withdrawnMs: 0, withdrawFee: 0,
          });
          continue;
        }

        // Check if trading has started
        const canTrade = effectiveDay > config.releaseStartsTradingDays;

        // Calculate MS release using linear release (principal + interest)
        const { dailyMs, principalUsdc, interestUsdc } = calculateLinearDailyRelease(order, config, effectivePrice);
        totalMsReleased += dailyMs;
        state.cumMsReleased += dailyMs;

        // Calculate exit distribution using per-order withdrawal ratio
        const exitDist = calculateAFExitDistribution(dailyMs, effectivePrice, order.withdrawPercent ?? 60, config);
        totalBurn += exitDist.toBurnMs;
        totalToSecondaryMarket += exitDist.toSecondaryMarketMs;

        // Track MS state: withdrawn vs held (held MS = trading capital)
        state.msWithdrawn += exitDist.toWithdrawMs;
        state.msKeptInSystem += exitDist.toHoldMs;

        // Calculate USDC revenue from selling withdrawn MS to LP pool
        totalAfSellingRevenue += exitDist.toSecondaryMarketMs * effectivePrice;

        // Trading simulation
        let forexIncome = 0;
        if (canTrade) {
          const dynamicTradingCapital = order.amount * config.tradingCapitalMultiplier;
          const dailyTradingVolume = dynamicTradingCapital * (config.dailyTradingVolumePercent / 100);
          totalTradingVolume += dailyTradingVolume;

          const tradingSim = calculateTradingSimulation(
            dailyTradingVolume,
            packageConfig.tradingProfitRate / 100,
            packageConfig.tradingFeeRate,
            packageConfig.profitSharePercent,
            config
          );

          forexIncome = tradingSim.userProfit;
          totalUserProfit += tradingSim.userProfit;
          totalPlatformProfit += tradingSim.platformProfit;
          totalBrokerProfit += tradingSim.brokerProfit;
          totalTradingFee += tradingSim.tradingFee;
          totalBuybackUsdc += tradingSim.buybackAmount;
          totalLpContributionUsdc += dailyTradingVolume * (config.lpPoolUsdcRatio / 100);
          totalLpContributionAf += dailyTradingVolume * (config.lpPoolMsRatio / 100);
        }

        orderDailyDetails.get(order.id)?.push({
          day, orderId: order.id,
          principalRelease: principalUsdc,
          interestRelease: interestUsdc,
          dailyMsRelease: dailyMs,
          msPrice: effectivePrice,
          cumMsReleased: state.cumMsReleased,
          msInSystem: state.msKeptInSystem,
          tradingCapital: order.amount * config.tradingCapitalMultiplier,
          forexIncome,
          withdrawnMs: exitDist.toWithdrawMs,
          withdrawFee: 0,
        });
      }
    }

    // Dividend pool mode: second pass to distribute pool profits by MS weight
    if (config.tradingMode === 'dividend_pool') {
      // Gather total unclaimed MS and total deposit across all days-mode orders
      let totalUnclaimedMs = 0;
      const totalDepositAmount = orders.reduce((sum, o) => sum + o.amount, 0);

      for (const order of orders) {
        if ((order.mode || 'package') === 'days') {
          const st = orderState.get(order.id)!;
          totalUnclaimedMs += st.msKeptInSystem;
        }
      }

      if (totalUnclaimedMs > 0) {
        for (const order of orders) {
          if ((order.mode || 'package') !== 'days') continue;
          const st = orderState.get(order.id)!;
          if (st.msKeptInSystem <= 0) continue;

          const startDay = order.startDay || 0;
          const effectiveDay = day - startDay;
          if (effectiveDay < 1 || effectiveDay <= config.releaseStartsTradingDays) continue;

          const daysConfig = config.daysConfigs?.find(d => d.days === order.durationDays);
          if (!daysConfig) continue;

          const dividendResult = calculateDividendPoolProfit(
            st.msKeptInSystem,
            totalUnclaimedMs,
            st.cumMsReleased,
            daysConfig.releaseMultiplier,
            order.amount,
            totalDepositAmount,
            config,
            { tradingFeeRate: daysConfig.tradingFeeRate, profitSharePercent: daysConfig.profitSharePercent }
          );

          totalUserProfit += dividendResult.userProfit;
          totalPlatformProfit += dividendResult.platformProfit;
          totalBrokerProfit += dividendResult.brokerProfit;
          totalTradingFee += dividendResult.tradingFee;

          // Update the order's daily detail with dividend income
          const details = orderDailyDetails.get(order.id);
          if (details && details.length > 0) {
            const lastDetail = details[details.length - 1];
            if (lastDetail.day === day) {
              lastDetail.forexIncome += dividendResult.userProfit;
            }
          }
        }
      }
    }

    // Convert LP contribution MS from USDC value to MS units (uses AAM pool price for pool operations)
    const lpAfUnits = totalLpContributionAf / currentPool.msPrice;

    // Update AAM pool normally (pool mechanics always use pool price)
    currentPool = simulateAAMPool(
      currentPool,
      totalLpContributionUsdc,
      lpAfUnits,
      totalToSecondaryMarket,
      totalBurn,
      totalBuybackUsdc
    );

    const totalReserve = totalTradingVolume * (config.reserveRatio / 100);

    results.push({
      day,
      msReleased: totalMsReleased,
      msPrice: effectivePrice, // Output effective price (CLMM or AAM)
      userProfit: totalUserProfit,
      platformProfit: totalPlatformProfit,
      brokerProfit: totalBrokerProfit,
      tradingFeeConsumed: totalTradingFee,
      lpPoolSize: currentPool.lpTokens,
      poolUsdcBalance: currentPool.usdcBalance,
      poolMsBalance: currentPool.msBalance,
      poolTotalValue: currentPool.usdcBalance + currentPool.msBalance * currentPool.msPrice,
      buybackAmountUsdc: totalBuybackUsdc,
      burnAmountMs: totalBurn,
      toSecondaryMarketMs: totalToSecondaryMarket,
      msSellingRevenueUsdc: totalAfSellingRevenue,
      lpContributionUsdc: totalLpContributionUsdc,
      lpContributionMsValue: totalLpContributionAf,
      reserveAmountUsdc: totalReserve,
      aamPrice: useCLMMPrice ? currentPool.msPrice : undefined, // Record AAM price when using CLMM
    });
  }

  return { dailySimulations: results, orderDailyDetails };
}

// ============================================================
// Shared helper functions used across multiple pages
// ============================================================

// Calculate initial MS price from LP pool config
export function calculateInitialPrice(config: NMSConfig): number {
  return config.initialLpMs > 0 ? config.initialLpUsdc / config.initialLpMs : 0.1;
}

// Calculate deposit reserve ratio (remaining after LP + buyback)
export function calculateDepositReserveRatio(config: NMSConfig): number {
  return Math.max(0, 100 - config.depositLpRatio - config.depositBuybackRatio);
}

// Calculate per-order trading capital based on current config
export function calculateOrderTradingCapital(order: StakingOrder, config: NMSConfig, msPrice?: number): number {
  const orderMode = order.mode || 'package';
  if (orderMode === 'days' && msPrice && msPrice > 0) {
    // Days mode: trading capital from un-withdrawn MS value
    return calculateAfBasedTradingCapital(order.msKeptInSystem || 0, msPrice);
  }
  return order.amount * config.tradingCapitalMultiplier;
}

// Calculate per-order daily trading volume
export function calculateOrderDailyVolume(order: StakingOrder, config: NMSConfig): number {
  return calculateOrderTradingCapital(order, config) * (config.dailyTradingVolumePercent / 100);
}

// Calculate per-order daily MS release amount (snapshot at given price)
export function calculateOrderDailyRelease(order: StakingOrder, config: NMSConfig, msPrice: number): number {
  const orderMode = order.mode || 'package';

  if (orderMode === 'days') {
    const daysConfig = config.daysConfigs?.find(d => d.days === order.durationDays);
    if (!daysConfig || msPrice <= 0) return 0;
    const { dailyMs } = calculateDaysModeDailyRelease(order, daysConfig, msPrice);
    return dailyMs;
  }

  // Package mode - use linear release
  const pkg = config.packageConfigs.find(p => p.tier === order.packageTier);
  if (!pkg || !config.stakingEnabled) return 0;
  const { dailyMs } = calculateLinearDailyRelease(order, config, msPrice);
  return dailyMs;
}

// Calculate per-order daily forex profit breakdown
export function calculateOrderDailyForexProfit(
  order: StakingOrder,
  config: NMSConfig,
  msPrice?: number
): {
  dailyVolume: number;
  grossProfit: number;
  tradingFee: number;
  netProfit: number;
  userProfit: number;
} {
  const orderMode = order.mode || 'package';

  if (orderMode === 'days') {
    const daysConfig = config.daysConfigs?.find(d => d.days === order.durationDays);
    if (!daysConfig || !msPrice || msPrice <= 0) return { dailyVolume: 0, grossProfit: 0, tradingFee: 0, netProfit: 0, userProfit: 0 };

    const tradingCapital = calculateAfBasedTradingCapital(order.msKeptInSystem || 0, msPrice);
    const dailyVolume = tradingCapital * (config.dailyTradingVolumePercent / 100);
    const sim = calculateTradingSimulation(
      dailyVolume,
      daysConfig.tradingProfitRate / 100,
      daysConfig.tradingFeeRate,
      daysConfig.profitSharePercent,
      config
    );
    const grossProfit = dailyVolume * (daysConfig.tradingProfitRate / 100);
    return {
      dailyVolume,
      grossProfit,
      tradingFee: sim.tradingFee,
      netProfit: grossProfit - sim.tradingFee,
      userProfit: sim.userProfit,
    };
  }

  const pkg = config.packageConfigs.find(p => p.tier === order.packageTier);
  if (!pkg) return { dailyVolume: 0, grossProfit: 0, tradingFee: 0, netProfit: 0, userProfit: 0 };

  const tradingCapital = order.amount * config.tradingCapitalMultiplier;
  const dailyVolume = tradingCapital * (config.dailyTradingVolumePercent / 100);
  const sim = calculateTradingSimulation(
    dailyVolume,
    pkg.tradingProfitRate / 100,
    pkg.tradingFeeRate,
    pkg.profitSharePercent,
    config
  );

  const grossProfit = dailyVolume * (pkg.tradingProfitRate / 100);
  return {
    dailyVolume,
    grossProfit,
    tradingFee: sim.tradingFee,
    netProfit: grossProfit - sim.tradingFee,
    userProfit: sim.userProfit,
  };
}

// Calculate MS selling revenue from exit distribution over a period
export function calculateOrderMsSellingRevenue(
  totalMsReleased: number,
  msPrice: number,
  withdrawPercent: number,
  config: NMSConfig
): { soldAf: number; revenueUsdc: number } {
  const exitDist = calculateAFExitDistribution(totalMsReleased, msPrice, withdrawPercent, config);
  return {
    soldAf: exitDist.toSecondaryMarketMs,
    revenueUsdc: exitDist.toSecondaryMarketMs * msPrice,
  };
}

// ============================================================
// Duration comparison calculator
// ============================================================

export interface DurationComparisonResult {
  days: number;
  releaseMultiplier: number;
  tradingFeeRate: number;
  profitSharePercent: number;
  // MS metrics
  totalMsReleased: number;
  totalWithdrawnAf: number;
  totalHeldAf: number;
  // Revenue metrics (USDC)
  msArbitrageRevenue: number;  // USDC from selling MS on secondary market
  heldMsValue: number;         // USDC value of held MS (unrealized)
  tradingProfit: number;       // Forex trading income
  totalRevenue: number;        // msArbitrageRevenue + tradingProfit (realized only)
  netProfit: number;           // totalRevenue - investment amount
  // Efficiency metrics
  avgDailyIncome: number;      // totalRevenue / days
  monthlyRoi: number;          // (netProfit / amount) / days * 30 * 100
  totalRoi: number;            // (netProfit / amount) * 100
  finalAfPrice: number;
}

export function simulateDurationComparison(
  amount: number,
  withdrawPercent: number,
  config: NMSConfig,
  initialPool: AAMPool
): DurationComparisonResult[] {
  const results: DurationComparisonResult[] = [];

  for (const dc of config.daysConfigs) {
    const days = dc.days;

    // Create a virtual staking order for this duration
    const virtualOrder: StakingOrder = {
      id: `compare-${days}`,
      amount,
      mode: 'days',
      durationDays: days,
      withdrawPercent,
      startDay: 0,
      packageTier: 0,
      startDate: '',
      daysStaked: days,
      msReleased: 0,
      tradingCapital: 0,
      totalMsToRelease: 0,
      msWithdrawn: 0,
      msKeptInSystem: 0,
    };

    // Run simulation with a fresh copy of initialPool for fair comparison
    const sim = runSimulationWithDetails([virtualOrder], config, days, { ...initialPool });
    const details = sim.orderDailyDetails.get(virtualOrder.id) || [];

    // Aggregate from daily details
    let totalWithdrawnAf = 0;
    let tradingProfit = 0;
    let totalMsReleased = 0;
    let totalHeldAf = 0;

    for (const d of details) {
      totalWithdrawnAf += d.withdrawnMs;
      tradingProfit += d.forexIncome;
    }

    if (details.length > 0) {
      const last = details[details.length - 1];
      totalMsReleased = last.cumMsReleased;
      totalHeldAf = last.msInSystem;
    }

    // Use simulation-derived final price for realistic valuation
    const lastSimDay = sim.dailySimulations[sim.dailySimulations.length - 1];
    const finalAfPrice = lastSimDay ? lastSimDay.msPrice : initialPool.msPrice;
    const msArbitrageRevenue = totalWithdrawnAf * (1 - config.msExitBurnRatio / 100) * finalAfPrice;

    const heldMsValue = totalHeldAf * finalAfPrice;
    const totalRevenue = msArbitrageRevenue + tradingProfit; // realized only
    const netProfit = totalRevenue - amount;
    const avgDailyIncome = days > 0 ? totalRevenue / days : 0;
    const totalRoi = amount > 0 ? (netProfit / amount) * 100 : 0;
    const monthlyRoi = amount > 0 && days > 0 ? (netProfit / amount) / days * 30 * 100 : 0;

    results.push({
      days,
      releaseMultiplier: dc.releaseMultiplier,
      tradingFeeRate: dc.tradingFeeRate,
      profitSharePercent: dc.profitSharePercent,
      totalMsReleased,
      totalWithdrawnAf,
      totalHeldAf,
      msArbitrageRevenue,
      heldMsValue,
      tradingProfit,
      totalRevenue,
      netProfit,
      avgDailyIncome,
      monthlyRoi,
      totalRoi,
      finalAfPrice,
    });
  }

  return results;
}

// Format number for display
export function formatNumber(num: number, decimals: number = 2): string {
  return num.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

// Format currency
export function formatCurrency(num: number): string {
  return `$${formatNumber(num)}`;
}

// Format percentage
export function formatPercent(num: number): string {
  return `${formatNumber(num, 1)}%`;
}

// Calculate per-order release progress for a given simulation day
export function calculateOrderReleaseProgress(
  orders: StakingOrder[],
  config: NMSConfig,
  currentDay: number,
  msPrice: number
): OrderReleaseProgress[] {
  return orders.map(order => {
    const orderMode = order.mode || 'package';
    const startDay = order.startDay || 0;
    const effectiveDayFromStart = Math.max(0, currentDay - startDay);

    if (orderMode === 'days') {
      // Days mode order
      const daysConfig = config.daysConfigs?.find(d => d.days === order.durationDays);
      const durationDays = order.durationDays || 30;
      const effectiveDay = Math.min(effectiveDayFromStart, durationDays);
      const daysRemaining = Math.max(0, durationDays - effectiveDayFromStart);
      const progressPercent = durationDays > 0 ? (effectiveDay / durationDays) * 100 : 100;
      const isComplete = effectiveDayFromStart >= durationDays;

      let dailyMsRelease = 0;
      if (daysConfig && msPrice > 0) {
        const { dailyMs } = calculateDaysModeDailyRelease(order, daysConfig, msPrice);
        dailyMsRelease = dailyMs;
      }

      const totalMsReleased = dailyMsRelease * effectiveDay;
      const totalMsValue = totalMsReleased * msPrice;
      const tradingCapital = calculateAfBasedTradingCapital(totalMsReleased, msPrice);

      return {
        orderId: order.id,
        packageTier: order.packageTier,
        amount: order.amount,
        totalDays: durationDays,
        currentDay: effectiveDay,
        daysRemaining,
        progressPercent,
        totalMsReleased,
        dailyMsRelease,
        totalMsValue,
        tradingCapital,
        isComplete,
        mode: 'days' as const,
        startDay,
        msKeptInSystem: totalMsReleased,
        msWithdrawn: 0,
      };
    }

    // Package mode
    const packageConfig = config.packageConfigs.find(p => p.tier === order.packageTier);
    if (!packageConfig) {
      return {
        orderId: order.id,
        packageTier: order.packageTier,
        amount: order.amount,
        totalDays: order.daysStaked,
        currentDay: currentDay,
        daysRemaining: 0,
        progressPercent: 100,
        totalMsReleased: 0,
        dailyMsRelease: 0,
        totalMsValue: 0,
        tradingCapital: order.tradingCapital,
        isComplete: true,
        mode: 'package' as const,
        startDay,
        msKeptInSystem: 0,
        msWithdrawn: 0,
      };
    }

    const totalDays = order.daysStaked;
    const effectiveDay = Math.min(effectiveDayFromStart, totalDays);
    const daysRemaining = Math.max(0, totalDays - effectiveDayFromStart);
    const progressPercent = totalDays > 0 ? (effectiveDay / totalDays) * 100 : 100;
    const isComplete = effectiveDayFromStart >= totalDays;

    // Calculate daily MS release using linear release
    let dailyMsRelease = 0;
    if (config.stakingEnabled) {
      const { dailyMs } = calculateLinearDailyRelease(order, config, msPrice);
      dailyMsRelease = dailyMs;
    }

    const totalMsReleased = dailyMsRelease * effectiveDay;
    const totalMsValue = totalMsReleased * msPrice;
    const dynamicTradingCapital = order.amount * config.tradingCapitalMultiplier;

    return {
      orderId: order.id,
      packageTier: order.packageTier,
      amount: order.amount,
      totalDays,
      currentDay: effectiveDay,
      daysRemaining,
      progressPercent,
      totalMsReleased,
      dailyMsRelease,
      totalMsValue,
      tradingCapital: dynamicTradingCapital,
      isComplete,
      mode: 'package' as const,
      startDay,
      msKeptInSystem: 0,
      msWithdrawn: 0,
    };
  });
}
