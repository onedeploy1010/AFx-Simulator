import type { AFxConfig, StakingOrder, TradingSimulation, AAMPool, DailySimulation, OrderReleaseProgress } from "@shared/schema";

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
// All monetary inputs are in USDC, internally converted to AF using current pool price
export function simulateAAMPool(
  currentPool: AAMPool,
  usdcAddedToLp: number, // USDC added to LP pool
  usdcValueForAfLp: number, // USDC value used to buy AF for LP
  buybackUsdc: number, // USDC spent on buyback (removes AF from pool)
  burnAf: number // AF burned (direct AF units)
): AAMPool {
  // Convert USDC values to AF units using current price
  const afPrice = currentPool.afPrice > 0 ? currentPool.afPrice : 1;
  const afAddedFromPurchase = usdcValueForAfLp / afPrice;
  const afBuybackAmount = buybackUsdc / afPrice;
  
  const newUsdcBalance = currentPool.usdcBalance + usdcAddedToLp;
  const newAfBalance = currentPool.afBalance + afAddedFromPurchase - afBuybackAmount - burnAf;
  
  // Simple AMM price calculation (x * y = k)
  const k = newUsdcBalance * Math.max(0.01, newAfBalance);
  const newAfPrice = newAfBalance > 0.01 ? newUsdcBalance / newAfBalance : afPrice;
  
  return {
    usdcBalance: newUsdcBalance,
    afBalance: Math.max(0, newAfBalance),
    lpTokens: Math.sqrt(k),
    afPrice: newAfPrice,
    totalBuyback: currentPool.totalBuyback + afBuybackAmount,
    totalBurn: currentPool.totalBurn + burnAf,
  };
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
    let totalBuyback = 0;
    let totalBurn = 0;
    let totalToTradingCapital = 0;
    let totalToSecondaryMarket = 0;
    let totalToTradingFeeFromExit = 0;
    let totalTradingVolume = 0;
    let totalLpContributionUsdc = 0;
    let totalLpContributionAf = 0;
    
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
        // Fund flow split from trading capital (not fees)
        totalBuyback += tradingSim.buybackAmount;
        totalLpContributionUsdc += dailyTradingVolume * (config.lpPoolUsdcRatio / 100);
        totalLpContributionAf += dailyTradingVolume * (config.lpPoolAfRatio / 100);
      }
    }
    
    // Update pool - LP contributions now based on trading capital, not fees
    // All values passed in their natural units (USDC or AF), pool handles conversion
    currentPool = simulateAAMPool(
      currentPool,
      totalLpContributionUsdc, // USDC added to LP pool
      totalLpContributionAf, // USDC value used to buy AF for LP
      totalBuyback, // USDC spent on buyback
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
      buybackAmountUsdc: totalBuyback, // Buyback in USDC
      burnAmountAf: totalBurn, // Burn in AF
      // Exit distribution outputs
      toSecondaryMarketAf: totalToSecondaryMarket, // AF sold to secondary market
      toTradingFeeAf: totalToTradingFeeFromExit, // AF kept as trading fee
      toTradingCapitalUsdc: totalToTradingCapital, // Already in USDC from calculation
      // Fund flow outputs (all in USDC)
      lpContributionUsdc: totalLpContributionUsdc,
      lpContributionAfValue: totalLpContributionAf, // USDC value used to buy AF for LP
      reserveAmountUsdc: totalReserve,
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
