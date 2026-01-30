import type { AFxConfig, StakingOrder, TradingSimulation, AAMPool, DailySimulation, OrderReleaseProgress, PackageConfig, DaysConfig, OrderDailyDetail } from "@shared/schema";

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

// Calculate daily AF release
export function calculateDailyAFRelease(
  order: StakingOrder,
  config: AFxConfig,
  afPrice: number
): number {
  const packageConfig = config.packageConfigs.find(p => p.tier === order.packageTier);
  if (!packageConfig) return 0;

  // Check if staking is enabled
  if (!config.stakingEnabled) return 0;

  const stakingDays = order.daysStaked;
  const releaseMultiplier = packageConfig.releaseMultiplier;

  if (config.afReleaseMode === 'coin_standard') {
    // Coin standard: totalAF = (amount / afPrice) × multiplier, dailyAF = totalAF / stakingDays
    const coinQuantity = order.amount / afPrice;
    const totalAf = coinQuantity * releaseMultiplier;
    return totalAf / stakingDays;
  } else {
    // Gold standard: totalUSDC = amount × multiplier, dailyUSDC = totalUSDC / stakingDays, dailyAF = dailyUSDC / afPrice
    const totalUsdc = order.amount * releaseMultiplier;
    const dailyUsdc = totalUsdc / stakingDays;
    return dailyUsdc / afPrice;
  }
}

// Calculate linear daily release (principal + interest) for package mode
// Coin standard: totalAF = (amount / afPrice) × releaseMultiplier, dailyAF = totalAF / stakingDays
// Gold standard: totalUSDC = amount × releaseMultiplier, dailyUSDC = totalUSDC / stakingDays, dailyAF = dailyUSDC / afPrice
export function calculateLinearDailyRelease(
  order: StakingOrder,
  config: AFxConfig,
  afPrice: number
): { dailyAf: number; principalUsdc: number; interestUsdc: number } {
  const packageConfig = config.packageConfigs.find(p => p.tier === order.packageTier);
  if (!packageConfig || !config.stakingEnabled) return { dailyAf: 0, principalUsdc: 0, interestUsdc: 0 };

  const stakingDays = order.daysStaked;
  const releaseMultiplier = packageConfig.releaseMultiplier;

  if (config.afReleaseMode === 'coin_standard') {
    // Coin standard: totalAF = (amount / afPrice) × multiplier, dailyAF = totalAF / stakingDays
    const coinQuantity = order.amount / afPrice;
    const totalAf = coinQuantity * releaseMultiplier;
    const dailyAf = totalAf / stakingDays;
    // Principal component (USDC equivalent)
    const principalUsdc = order.amount / stakingDays;
    // Interest component = total daily value minus principal
    const interestUsdc = Math.max(0, (dailyAf * afPrice) - principalUsdc);
    return { dailyAf, principalUsdc, interestUsdc };
  } else {
    // Gold standard: totalUSDC = amount × multiplier, dailyUSDC = totalUSDC / stakingDays, dailyAF = dailyUSDC / afPrice
    const totalUsdc = order.amount * releaseMultiplier;
    const dailyUsdc = totalUsdc / stakingDays;
    const dailyAf = dailyUsdc / afPrice;
    // Principal component
    const principalUsdc = order.amount / stakingDays;
    // Interest component = total daily USDC minus principal
    const interestUsdc = Math.max(0, dailyUsdc - principalUsdc);
    return { dailyAf, principalUsdc, interestUsdc };
  }
}

// Calculate days mode daily release
// afAtCurrentPrice = amount / afPrice
// totalAfToRelease = afAtCurrentPrice * releaseMultiplier
// dailyAf = totalAfToRelease / durationDays
export function calculateDaysModeDailyRelease(
  order: StakingOrder,
  daysConfig: DaysConfig,
  afPrice: number
): { dailyAf: number; totalAfToRelease: number } {
  const afAtCurrentPrice = order.amount / afPrice;
  const totalAfToRelease = afAtCurrentPrice * daysConfig.releaseMultiplier;
  const dailyAf = totalAfToRelease / (order.durationDays || daysConfig.days);
  return { dailyAf, totalAfToRelease };
}

// Calculate AF-based trading capital
// Trading capital = un-withdrawn AF value in USDC (afKeptInSystem * afPrice)
export function calculateAfBasedTradingCapital(
  afKeptInSystem: number,
  afPrice: number
): number {
  return afKeptInSystem * afPrice;
}

// Calculate AF exit distribution based on per-package release choice ratios
// Inputs: afReleased (AF), afPrice (USDC/AF), packageConfig with release percentages
// Outputs: AF units for withdraw/keep/burn, USDC for trading capital
export function calculateAFExitDistribution(
  afReleased: number,
  afPrice: number,
  packageConfig: {
    releaseWithdrawPercent: number;
    releaseKeepPercent: number;
    releaseConvertPercent: number;
  },
  config: AFxConfig
): {
  toWithdrawAf: number; // AF sold to secondary market
  toKeepAf: number; // AF kept as trading fee
  toConvertAf: number; // AF converted to trading capital
  toBurnAf: number; // AF burned (from withdraw portion)
  toSecondaryMarketAf: number; // Net AF to secondary market after burn
  toTradingCapitalUsdc: number; // USDC value of converted AF
} {
  // Normalize percentages to ensure they sum to 100%
  const total = packageConfig.releaseWithdrawPercent + packageConfig.releaseKeepPercent + packageConfig.releaseConvertPercent;
  const normalizer = total > 0 ? 100 / total : 1;
  
  // Split by release choice (normalized to sum to 100%)
  const toWithdrawAf = afReleased * ((packageConfig.releaseWithdrawPercent * normalizer) / 100);
  const toKeepAf = afReleased * ((packageConfig.releaseKeepPercent * normalizer) / 100);
  const toConvertAf = afReleased * ((packageConfig.releaseConvertPercent * normalizer) / 100);
  
  // From withdrawn portion, some gets burned
  const toBurnAf = toWithdrawAf * (config.afExitBurnRatio / 100);
  const toSecondaryMarketAf = toWithdrawAf - toBurnAf;
  
  // Convert AF to USDC for trading capital using global trading capital multiplier
  // AF value in USDC × global multiplier = trading capital
  const toTradingCapitalUsdc = toConvertAf * afPrice * config.tradingCapitalMultiplier;
  
  return {
    toWithdrawAf,
    toKeepAf,
    toConvertAf,
    toBurnAf,
    toSecondaryMarketAf,
    toTradingCapitalUsdc,
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
  config: AFxConfig
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
  // 30% USDC + 30% AF -> LP pool (AAM)
  // 20% -> buyback AF
  // 50% -> forex reserve
  const lpContributionUsdc = tradingCapital * (config.lpPoolUsdcRatio / 100);
  const lpContributionAf = tradingCapital * (config.lpPoolAfRatio / 100);
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
  config: AFxConfig
): TradingSimulation {
  // Assume 5% profit rate as default for simulation
  return calculateTradingSimulation(tradeVolume, 0.05, feeRate, userProfitSharePercent, config);
}

// Calculate broker layer distribution
export function calculateBrokerLayerEarnings(
  afReleased: number,
  brokerLevel: string,
  config: AFxConfig
): { layer: number; earnings: number }[] {
  const levelConfig = config.brokerLayerDistribution.find(l => l.level === brokerLevel);
  if (!levelConfig) return [];
  
  return levelConfig.layers.map(layer => ({
    layer,
    earnings: afReleased * (levelConfig.ratePerLayer / 100),
  }));
}

// Calculate total broker earnings across all 20 layers
export function calculateTotalBrokerLayerEarnings(
  afReleasedPerLayer: number[],
  config: AFxConfig
): { level: string; totalEarnings: number; layerDetails: { layer: number; earnings: number }[] }[] {
  return config.brokerLayerDistribution.map(dist => {
    const layerDetails = dist.layers.map(layer => {
      const afAtLayer = afReleasedPerLayer[layer - 1] || 0;
      return {
        layer,
        earnings: afAtLayer * (dist.ratePerLayer / 100),
      };
    });
    
    return {
      level: dist.level,
      totalEarnings: layerDetails.reduce((sum, l) => sum + l.earnings, 0),
      layerDetails,
    };
  });
}

// Simulate AAM pool state after operations
// Handles: LP addition, AF sell to pool (secondary market), burn
export function simulateAAMPool(
  currentPool: AAMPool,
  usdcAddedToLp: number, // USDC added to LP pool
  afAddedToLp: number, // AF added to LP pool (for LP ratio)
  afSoldToPool: number, // AF sold to pool (secondary market exit, increases AF, decreases USDC)
  burnAf: number // AF burned (direct AF units)
): AAMPool {
  let newPool = { ...currentPool };
  const afPrice = newPool.afPrice > 0 ? newPool.afPrice : 1;
  
  // Step 1: Add liquidity (both USDC and AF in ratio) - price stays same
  if (usdcAddedToLp > 0 || afAddedToLp > 0) {
    newPool.usdcBalance += usdcAddedToLp;
    newPool.afBalance += afAddedToLp;
    // Price should stay the same if adding in ratio
  }
  
  // Step 2: AF sold to pool (secondary market exit)
  // AF enters pool, USDC exits -> price DECREASES
  if (afSoldToPool > 0) {
    const usdcReceived = afSoldToPool * newPool.afPrice;
    // Limit USDC withdrawal to available balance (keep minimum)
    const maxUsdcWithdraw = Math.max(0, newPool.usdcBalance - 1);
    const actualUsdcOut = Math.min(usdcReceived, maxUsdcWithdraw);
    const actualAfIn = actualUsdcOut / newPool.afPrice;
    
    newPool.afBalance += actualAfIn;
    newPool.usdcBalance -= actualUsdcOut;
  }
  
  // Step 3: Burn AF
  // AF removed from supply (not from pool, just tracked)
  newPool.totalBurn += burnAf;
  
  // Recalculate price
  newPool.afBalance = Math.max(1, newPool.afBalance);
  newPool.afPrice = newPool.usdcBalance / newPool.afBalance;
  newPool.lpTokens = Math.sqrt(newPool.usdcBalance * newPool.afBalance);
  
  return newPool;
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
  config: AFxConfig,
  days: number,
  initialPool: AAMPool
): DailySimulation[] {
  const result = runSimulationWithDetails(orders, config, days, initialPool);
  return result.dailySimulations;
}

// Run full simulation returning both daily summaries and per-order details
export function runSimulationWithDetails(
  orders: StakingOrder[],
  config: AFxConfig,
  days: number,
  initialPool: AAMPool
): SimulationResult {
  const results: DailySimulation[] = [];
  const orderDailyDetails = new Map<string, OrderDailyDetail[]>();
  let currentPool = { ...initialPool };

  // Initialize per-order tracking state
  const orderState = new Map<string, { cumAfReleased: number; afKeptInSystem: number; afWithdrawn: number }>();
  for (const order of orders) {
    orderState.set(order.id, { cumAfReleased: 0, afKeptInSystem: 0, afWithdrawn: 0 });
    orderDailyDetails.set(order.id, []);
  }

  for (let day = 1; day <= days; day++) {
    let totalAfReleased = 0;
    let totalUserProfit = 0;
    let totalPlatformProfit = 0;
    let totalBrokerProfit = 0;
    let totalTradingFee = 0;
    let totalBurn = 0;
    let totalToTradingCapital = 0;
    let totalToSecondaryMarket = 0;
    let totalToTradingFeeFromExit = 0;
    let totalTradingVolume = 0;
    let totalLpContributionUsdc = 0;
    let totalLpContributionAf = 0;
    let totalAfSellingRevenue = 0;

    for (const order of orders) {
      const state = orderState.get(order.id)!;
      const orderMode = order.mode || 'package';
      const startDay = order.startDay || 0;
      const effectiveDay = day - startDay; // Days since this order started

      // Order hasn't started yet
      if (effectiveDay < 1) {
        orderDailyDetails.get(order.id)?.push({
          day, orderId: order.id,
          principalRelease: 0, interestRelease: 0, dailyAfRelease: 0,
          afPrice: currentPool.afPrice, cumAfReleased: state.cumAfReleased,
          afInSystem: state.afKeptInSystem, tradingCapital: 0,
          forexIncome: 0, withdrawnAf: 0, withdrawFee: 0,
        });
        continue;
      }

      if (orderMode === 'days') {
        // Days mode order
        const daysConfig = config.daysConfigs?.find(d => d.days === order.durationDays);
        if (!daysConfig) continue;

        const durationDays = order.durationDays || daysConfig.days;
        // Check if release period has passed
        if (effectiveDay > durationDays) {
          orderDailyDetails.get(order.id)?.push({
            day, orderId: order.id,
            principalRelease: 0, interestRelease: 0, dailyAfRelease: 0,
            afPrice: currentPool.afPrice, cumAfReleased: state.cumAfReleased,
            afInSystem: state.afKeptInSystem,
            tradingCapital: calculateAfBasedTradingCapital(state.afKeptInSystem, currentPool.afPrice),
            forexIncome: 0, withdrawnAf: 0, withdrawFee: 0,
          });
          continue;
        }

        // Calculate daily AF release for days mode
        const { dailyAf } = calculateDaysModeDailyRelease(order, daysConfig, currentPool.afPrice);
        totalAfReleased += dailyAf;
        state.cumAfReleased += dailyAf;

        // In days mode: AF is released daily. User can choose to withdraw (with fee) or keep in system
        // For simulation: assume all released AF stays in system (generates trading capital)
        // Withdrawal is tracked but not auto-executed in simulation
        state.afKeptInSystem += dailyAf;

        // Trading capital from un-withdrawn AF
        const tradingCapital = calculateAfBasedTradingCapital(state.afKeptInSystem, currentPool.afPrice);

        // If AF kept (not withdrawn), generate trading income
        const canTrade = effectiveDay > config.releaseStartsTradingDays;
        let forexIncome = 0;
        if (canTrade && tradingCapital > 0) {
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
          totalLpContributionUsdc += dailyTradingVolume * (config.lpPoolUsdcRatio / 100);
          totalLpContributionAf += dailyTradingVolume * (config.lpPoolAfRatio / 100);
        }

        orderDailyDetails.get(order.id)?.push({
          day, orderId: order.id,
          principalRelease: 0, // Days mode doesn't split principal/interest
          interestRelease: 0,
          dailyAfRelease: dailyAf,
          afPrice: currentPool.afPrice,
          cumAfReleased: state.cumAfReleased,
          afInSystem: state.afKeptInSystem,
          tradingCapital,
          forexIncome,
          withdrawnAf: 0,
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
            principalRelease: 0, interestRelease: 0, dailyAfRelease: 0,
            afPrice: currentPool.afPrice, cumAfReleased: state.cumAfReleased,
            afInSystem: state.afKeptInSystem, tradingCapital: 0,
            forexIncome: 0, withdrawnAf: 0, withdrawFee: 0,
          });
          continue;
        }

        // Check if trading has started
        const canTrade = effectiveDay > config.releaseStartsTradingDays;

        // Calculate AF release using linear release (principal + interest)
        const { dailyAf, principalUsdc, interestUsdc } = calculateLinearDailyRelease(order, config, currentPool.afPrice);
        totalAfReleased += dailyAf;
        state.cumAfReleased += dailyAf;

        // Calculate exit distribution using per-package release choice
        const exitDist = calculateAFExitDistribution(dailyAf, currentPool.afPrice, packageConfig, config);
        totalBurn += exitDist.toBurnAf;
        totalToTradingCapital += exitDist.toTradingCapitalUsdc;
        totalToSecondaryMarket += exitDist.toSecondaryMarketAf;
        totalToTradingFeeFromExit += exitDist.toKeepAf;

        // Track AF state
        state.afWithdrawn += exitDist.toWithdrawAf;
        state.afKeptInSystem += exitDist.toKeepAf + exitDist.toConvertAf;

        // Calculate USDC revenue from selling withdrawn AF to LP pool
        totalAfSellingRevenue += exitDist.toSecondaryMarketAf * currentPool.afPrice;

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
          totalLpContributionUsdc += dailyTradingVolume * (config.lpPoolUsdcRatio / 100);
          totalLpContributionAf += dailyTradingVolume * (config.lpPoolAfRatio / 100);
        }

        orderDailyDetails.get(order.id)?.push({
          day, orderId: order.id,
          principalRelease: principalUsdc,
          interestRelease: interestUsdc,
          dailyAfRelease: dailyAf,
          afPrice: currentPool.afPrice,
          cumAfReleased: state.cumAfReleased,
          afInSystem: state.afKeptInSystem,
          tradingCapital: order.amount * config.tradingCapitalMultiplier,
          forexIncome,
          withdrawnAf: exitDist.toWithdrawAf,
          withdrawFee: 0,
        });
      }
    }

    // Convert LP contribution AF from USDC value to AF units
    const lpAfUnits = totalLpContributionAf / currentPool.afPrice;

    // Update pool
    currentPool = simulateAAMPool(
      currentPool,
      totalLpContributionUsdc,
      lpAfUnits,
      totalToSecondaryMarket,
      totalBurn
    );

    const totalReserve = totalTradingVolume * (config.reserveRatio / 100);

    results.push({
      day,
      afReleased: totalAfReleased,
      afPrice: currentPool.afPrice,
      userProfit: totalUserProfit,
      platformProfit: totalPlatformProfit,
      brokerProfit: totalBrokerProfit,
      tradingFeeConsumed: totalTradingFee,
      lpPoolSize: currentPool.lpTokens,
      poolUsdcBalance: currentPool.usdcBalance,
      poolAfBalance: currentPool.afBalance,
      poolTotalValue: currentPool.usdcBalance + currentPool.afBalance * currentPool.afPrice,
      buybackAmountUsdc: 0,
      burnAmountAf: totalBurn,
      toSecondaryMarketAf: totalToSecondaryMarket,
      toTradingFeeAf: totalToTradingFeeFromExit,
      toTradingCapitalUsdc: totalToTradingCapital,
      afSellingRevenueUsdc: totalAfSellingRevenue,
      lpContributionUsdc: totalLpContributionUsdc,
      lpContributionAfValue: totalLpContributionAf,
      reserveAmountUsdc: totalReserve,
    });
  }

  return { dailySimulations: results, orderDailyDetails };
}

// ============================================================
// Shared helper functions used across multiple pages
// ============================================================

// Calculate initial AF price from LP pool config
export function calculateInitialPrice(config: AFxConfig): number {
  return config.initialLpAf > 0 ? config.initialLpUsdc / config.initialLpAf : 0.1;
}

// Calculate deposit reserve ratio (remaining after LP + buyback)
export function calculateDepositReserveRatio(config: AFxConfig): number {
  return Math.max(0, 100 - config.depositLpRatio - config.depositBuybackRatio);
}

// Calculate per-order trading capital based on current config
export function calculateOrderTradingCapital(order: StakingOrder, config: AFxConfig, afPrice?: number): number {
  const orderMode = order.mode || 'package';
  if (orderMode === 'days' && afPrice && afPrice > 0) {
    // Days mode: trading capital from un-withdrawn AF value
    return calculateAfBasedTradingCapital(order.afKeptInSystem || 0, afPrice);
  }
  return order.amount * config.tradingCapitalMultiplier;
}

// Calculate per-order daily trading volume
export function calculateOrderDailyVolume(order: StakingOrder, config: AFxConfig): number {
  return calculateOrderTradingCapital(order, config) * (config.dailyTradingVolumePercent / 100);
}

// Calculate per-order daily AF release amount (snapshot at given price)
export function calculateOrderDailyRelease(order: StakingOrder, config: AFxConfig, afPrice: number): number {
  const orderMode = order.mode || 'package';

  if (orderMode === 'days') {
    const daysConfig = config.daysConfigs?.find(d => d.days === order.durationDays);
    if (!daysConfig || afPrice <= 0) return 0;
    const { dailyAf } = calculateDaysModeDailyRelease(order, daysConfig, afPrice);
    return dailyAf;
  }

  // Package mode - use linear release
  const pkg = config.packageConfigs.find(p => p.tier === order.packageTier);
  if (!pkg || !config.stakingEnabled) return 0;
  const { dailyAf } = calculateLinearDailyRelease(order, config, afPrice);
  return dailyAf;
}

// Calculate per-order daily forex profit breakdown
export function calculateOrderDailyForexProfit(
  order: StakingOrder,
  config: AFxConfig,
  afPrice?: number
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
    if (!daysConfig || !afPrice || afPrice <= 0) return { dailyVolume: 0, grossProfit: 0, tradingFee: 0, netProfit: 0, userProfit: 0 };

    const tradingCapital = calculateAfBasedTradingCapital(order.afKeptInSystem || 0, afPrice);
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

// Calculate AF selling revenue from exit distribution over a period
export function calculateOrderAfSellingRevenue(
  totalAfReleased: number,
  afPrice: number,
  packageConfig: PackageConfig,
  config: AFxConfig
): { soldAf: number; revenueUsdc: number } {
  const exitDist = calculateAFExitDistribution(totalAfReleased, afPrice, packageConfig, config);
  return {
    soldAf: exitDist.toSecondaryMarketAf,
    revenueUsdc: exitDist.toSecondaryMarketAf * afPrice,
  };
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
  config: AFxConfig,
  currentDay: number,
  afPrice: number
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

      let dailyAfRelease = 0;
      if (daysConfig && afPrice > 0) {
        const { dailyAf } = calculateDaysModeDailyRelease(order, daysConfig, afPrice);
        dailyAfRelease = dailyAf;
      }

      const totalAfReleased = dailyAfRelease * effectiveDay;
      const totalAfValue = totalAfReleased * afPrice;
      const tradingCapital = calculateAfBasedTradingCapital(totalAfReleased, afPrice);

      return {
        orderId: order.id,
        packageTier: order.packageTier,
        amount: order.amount,
        totalDays: durationDays,
        currentDay: effectiveDay,
        daysRemaining,
        progressPercent,
        totalAfReleased,
        dailyAfRelease,
        totalAfValue,
        tradingCapital,
        isComplete,
        mode: 'days' as const,
        startDay,
        afKeptInSystem: totalAfReleased,
        afWithdrawn: 0,
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
        totalAfReleased: 0,
        dailyAfRelease: 0,
        totalAfValue: 0,
        tradingCapital: order.tradingCapital,
        isComplete: true,
        mode: 'package' as const,
        startDay,
        afKeptInSystem: 0,
        afWithdrawn: 0,
      };
    }

    const totalDays = order.daysStaked;
    const effectiveDay = Math.min(effectiveDayFromStart, totalDays);
    const daysRemaining = Math.max(0, totalDays - effectiveDayFromStart);
    const progressPercent = totalDays > 0 ? (effectiveDay / totalDays) * 100 : 100;
    const isComplete = effectiveDayFromStart >= totalDays;

    // Calculate daily AF release using linear release
    let dailyAfRelease = 0;
    if (config.stakingEnabled) {
      const { dailyAf } = calculateLinearDailyRelease(order, config, afPrice);
      dailyAfRelease = dailyAf;
    }

    const totalAfReleased = dailyAfRelease * effectiveDay;
    const totalAfValue = totalAfReleased * afPrice;
    const dynamicTradingCapital = order.amount * config.tradingCapitalMultiplier;

    return {
      orderId: order.id,
      packageTier: order.packageTier,
      amount: order.amount,
      totalDays,
      currentDay: effectiveDay,
      daysRemaining,
      progressPercent,
      totalAfReleased,
      dailyAfRelease,
      totalAfValue,
      tradingCapital: dynamicTradingCapital,
      isComplete,
      mode: 'package' as const,
      startDay,
      afKeptInSystem: 0,
      afWithdrawn: 0,
    };
  });
}
