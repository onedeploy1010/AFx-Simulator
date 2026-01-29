import type { AFxConfig, StakingOrder, TradingSimulation, AAMPool, DailySimulation } from "@shared/schema";

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

// Calculate AF exit distribution based on user choice and config ratios
// All outputs are in AF units except toTradingCapitalAf which is AF amount converted
export function calculateAFExitDistribution(
  afReleased: number,
  afPrice: number,
  config: AFxConfig
): {
  toWithdrawAf: number;
  toConvertAf: number;
  toBurnAf: number;
  toTradingFeeAf: number;
  toSecondaryMarketAf: number;
  toTradingCapitalUsdc: number; // USDC value of converted AF
} {
  // Split by user choice (both in AF)
  const userWithdrawAf = afReleased * (config.userWithdrawChoicePercent / 100);
  const userConvertAf = afReleased * (config.userConvertChoicePercent / 100);
  
  // Apply exit ratios to withdrawn portion (all in AF)
  const toSecondaryMarketAf = userWithdrawAf * (config.afExitWithdrawRatio / 100);
  const toBurnAf = userWithdrawAf * (config.afExitBurnRatio / 100);
  const toTradingFeeAf = userWithdrawAf * (config.afExitTradingFeeRatio / 100);
  
  // Convert AF to USDC for trading capital (at current AF price × rate multiplier)
  const toTradingCapitalUsdc = userConvertAf * afPrice * config.afToTradingCapitalRate;
  
  return {
    toWithdrawAf: userWithdrawAf,
    toConvertAf: userConvertAf,
    toBurnAf,
    toTradingFeeAf,
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
  
  // Trading fee is applied to the trade value
  const tradingFee = tradingCapital * (tradingFeeRate / 100);
  
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
      // Check if staking period has passed
      if (!config.stakingEnabled || day > order.daysStaked) continue;
      
      // Calculate AF release for this order
      const afReleased = calculateDailyAFRelease(order, config, currentPool.afPrice);
      totalAfReleased += afReleased;
      
      // Calculate exit distribution with current AF price
      const exitDist = calculateAFExitDistribution(afReleased, currentPool.afPrice, config);
      totalBurn += exitDist.toBurnAf;
      totalToTradingCapital += exitDist.toTradingCapitalUsdc;
      totalToSecondaryMarket += exitDist.toSecondaryMarketAf;
      totalToTradingFeeFromExit += exitDist.toTradingFeeAf;
      
      // Simulate trading with trading capital (configurable daily volume %)
      const dailyTradingVolume = order.tradingCapital * (config.dailyTradingVolumePercent / 100);
      totalTradingVolume += dailyTradingVolume;
      
      const feeRate = calculateTradingFeeRate(
        order.amount,
        10000,
        config.tradingFeeRateMin,
        config.tradingFeeRateMax
      );
      
      // Calculate trading with configurable profit rate
      const tradingSim = calculateTradingSimulation(
        dailyTradingVolume,
        config.tradingProfitRatePercent / 100, // Convert to decimal
        feeRate,
        config.userProfitShareTier,
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
