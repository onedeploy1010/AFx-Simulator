import type { AFxConfig, StakingOrder, TradingSimulation, AAMPool, DailySimulation, OrderReleaseProgress, PackageConfig } from "@shared/schema";

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
  
  if (config.afReleaseMode === 'gold_standard') {
    // Release based on USDC value
    const dailyUsdcValue = order.amount * (packageConfig.afReleaseRate / 100);
    return dailyUsdcValue / afPrice;
  } else {
    // Release fixed AF amount
    return order.amount * (packageConfig.afReleaseRate / 100);
  }
}

// Calculate AF exit distribution based on per-package release choice ratios
// Inputs: afReleased (AF), afPrice (USDC/AF), packageConfig with release percentages and trading capital multiplier
// Outputs: AF units for withdraw/keep/burn, USDC for trading capital
export function calculateAFExitDistribution(
  afReleased: number,
  afPrice: number,
  packageConfig: { 
    releaseWithdrawPercent: number; 
    releaseKeepPercent: number; 
    releaseConvertPercent: number;
    tradingCapitalMultiplier: number;
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
  
  // Convert AF to USDC for trading capital using package's trading capital multiplier
  // AF value in USDC × package multiplier = trading capital
  const toTradingCapitalUsdc = toConvertAf * afPrice * packageConfig.tradingCapitalMultiplier;
  
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

// Run full simulation for N days
export function runSimulation(
  orders: StakingOrder[],
  config: AFxConfig,
  days: number,
  initialPool: AAMPool
): DailySimulation[] {
  const results: DailySimulation[] = [];
  let currentPool = { ...initialPool };
  
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
      // Get package config for this order
      const packageConfig = config.packageConfigs.find(p => p.tier === order.packageTier);
      if (!packageConfig) continue;
      
      // Check if staking period has passed (use order's daysStaked which can be customized)
      if (!config.stakingEnabled || day > order.daysStaked) continue;
      
      // Check if trading has started (releaseStartsTradingDays)
      const canTrade = day > config.releaseStartsTradingDays;
      
      // Calculate AF release for this order
      const afReleased = calculateDailyAFRelease(order, config, currentPool.afPrice);
      totalAfReleased += afReleased;
      
      // Calculate exit distribution using per-package release choice
      const exitDist = calculateAFExitDistribution(afReleased, currentPool.afPrice, packageConfig, config);
      totalBurn += exitDist.toBurnAf;
      totalToTradingCapital += exitDist.toTradingCapitalUsdc;
      totalToSecondaryMarket += exitDist.toSecondaryMarketAf;
      totalToTradingFeeFromExit += exitDist.toKeepAf; // AF kept as trading fee

      // Calculate USDC revenue from selling withdrawn AF to LP pool
      totalAfSellingRevenue += exitDist.toSecondaryMarketAf * currentPool.afPrice;

      // Only simulate trading if trading period has started
      if (canTrade) {
        // Calculate trading capital dynamically based on current config
        const dynamicTradingCapital = order.amount * packageConfig.tradingCapitalMultiplier;
        // Simulate trading with trading capital (configurable daily volume %)
        const dailyTradingVolume = dynamicTradingCapital * (config.dailyTradingVolumePercent / 100);
        totalTradingVolume += dailyTradingVolume;
        
        // Use per-package fee rate and profit rate
        const feeRate = packageConfig.tradingFeeRate;
        const profitRate = packageConfig.tradingProfitRate / 100;
        const profitSharePercent = packageConfig.profitSharePercent;
        
        // Calculate trading with per-package parameters
        const tradingSim = calculateTradingSimulation(
          dailyTradingVolume,
          profitRate,
          feeRate,
          profitSharePercent,
          config
        );
        
        totalUserProfit += tradingSim.userProfit;
        totalPlatformProfit += tradingSim.platformProfit;
        totalBrokerProfit += tradingSim.brokerProfit;
        totalTradingFee += tradingSim.tradingFee;
        // Note: Trading does NOT trigger buyback - only LP contributions
        totalLpContributionUsdc += dailyTradingVolume * (config.lpPoolUsdcRatio / 100);
        totalLpContributionAf += dailyTradingVolume * (config.lpPoolAfRatio / 100);
      }
    }
    
    // Convert LP contribution AF from USDC value to AF units
    const lpAfUnits = totalLpContributionAf / currentPool.afPrice;
    
    // Update pool:
    // - Add LP (USDC + AF in ratio)
    // - Secondary market AF sold to pool (price decreases)
    // - Burn AF (tracked, not from pool)
    currentPool = simulateAAMPool(
      currentPool,
      totalLpContributionUsdc, // USDC added to LP pool
      lpAfUnits, // AF added to LP pool (converted from USDC value)
      totalToSecondaryMarket, // AF sold to pool (secondary market exit)
      totalBurn // AF burned (direct units)
    );
    
    // Track reserve amount from trading capital
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
      // Pool state snapshot
      poolUsdcBalance: currentPool.usdcBalance,
      poolAfBalance: currentPool.afBalance,
      poolTotalValue: currentPool.usdcBalance + currentPool.afBalance * currentPool.afPrice,
      buybackAmountUsdc: 0, // No buyback from trading
      burnAmountAf: totalBurn, // Burn in AF
      // Exit distribution outputs
      toSecondaryMarketAf: totalToSecondaryMarket, // AF sold to pool
      toTradingFeeAf: totalToTradingFeeFromExit, // AF kept as trading fee
      toTradingCapitalUsdc: totalToTradingCapital, // Already in USDC from calculation
      // AF selling revenue (USDC received from selling withdrawn AF)
      afSellingRevenueUsdc: totalAfSellingRevenue,
      // Fund flow outputs (all in USDC)
      lpContributionUsdc: totalLpContributionUsdc,
      lpContributionAfValue: totalLpContributionAf, // USDC value of AF added to LP
      reserveAmountUsdc: totalReserve,
    });
  }
  
  return results;
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
export function calculateOrderTradingCapital(order: StakingOrder, config: AFxConfig): number {
  const pkg = config.packageConfigs.find(p => p.tier === order.packageTier);
  return order.amount * (pkg?.tradingCapitalMultiplier || 1);
}

// Calculate per-order daily trading volume
export function calculateOrderDailyVolume(order: StakingOrder, config: AFxConfig): number {
  return calculateOrderTradingCapital(order, config) * (config.dailyTradingVolumePercent / 100);
}

// Calculate per-order daily AF release amount (snapshot at given price)
export function calculateOrderDailyRelease(order: StakingOrder, config: AFxConfig, afPrice: number): number {
  const pkg = config.packageConfigs.find(p => p.tier === order.packageTier);
  if (!pkg || !config.stakingEnabled) return 0;
  if (config.afReleaseMode === 'gold_standard') {
    return (order.amount * (pkg.afReleaseRate / 100)) / afPrice;
  }
  return order.amount * (pkg.afReleaseRate / 100);
}

// Calculate per-order daily forex profit breakdown
export function calculateOrderDailyForexProfit(
  order: StakingOrder,
  config: AFxConfig
): {
  dailyVolume: number;
  grossProfit: number;
  tradingFee: number;
  netProfit: number;
  userProfit: number;
} {
  const pkg = config.packageConfigs.find(p => p.tier === order.packageTier);
  if (!pkg) return { dailyVolume: 0, grossProfit: 0, tradingFee: 0, netProfit: 0, userProfit: 0 };

  const tradingCapital = order.amount * pkg.tradingCapitalMultiplier;
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
    const packageConfig = config.packageConfigs.find(p => p.tier === order.packageTier);
    if (!packageConfig) {
      return {
        orderId: order.id,
        packageTier: order.packageTier,
        amount: order.amount,
        totalDays: order.daysStaked,
        currentDay,
        daysRemaining: 0,
        progressPercent: 100,
        totalAfReleased: 0,
        dailyAfRelease: 0,
        totalAfValue: 0,
        tradingCapital: order.tradingCapital,
        isComplete: true,
      };
    }

    const totalDays = order.daysStaked;
    const effectiveDay = Math.min(currentDay, totalDays);
    const daysRemaining = Math.max(0, totalDays - currentDay);
    const progressPercent = totalDays > 0 ? (effectiveDay / totalDays) * 100 : 100;
    const isComplete = currentDay >= totalDays;

    // Calculate daily AF release
    let dailyAfRelease = 0;
    if (config.stakingEnabled) {
      if (config.afReleaseMode === 'gold_standard') {
        const dailyUsdcValue = order.amount * (packageConfig.afReleaseRate / 100);
        dailyAfRelease = dailyUsdcValue / afPrice;
      } else {
        dailyAfRelease = order.amount * (packageConfig.afReleaseRate / 100);
      }
    }

    // Total AF released up to current day
    const totalAfReleased = dailyAfRelease * effectiveDay;
    const totalAfValue = totalAfReleased * afPrice;

    // Calculate trading capital dynamically based on current config
    const dynamicTradingCapital = order.amount * packageConfig.tradingCapitalMultiplier;

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
    };
  });
}
