import { z } from "zod";

// Package tiers available
export const PACKAGE_TIERS = [100, 500, 1000, 3000, 5000, 10000] as const;
export type PackageTier = typeof PACKAGE_TIERS[number];

// AF Release Mode
export type AFReleaseMode = 'gold_standard' | 'coin_standard';

// Simulation Mode
export type SimulationMode = 'package' | 'days';

// Days mode tier durations
export const DAYS_MODE_TIERS = [30, 60, 90, 180] as const;
export type DaysModeTier = typeof DAYS_MODE_TIERS[number];

// User profit sharing tiers
export const PROFIT_SHARE_TIERS = [60, 65, 70, 75, 80, 85] as const;
export type ProfitShareTier = typeof PROFIT_SHARE_TIERS[number];

// Broker levels
export const BROKER_LEVELS = ['V1', 'V2', 'V3', 'V4', 'V5', 'V6'] as const;
export type BrokerLevel = typeof BROKER_LEVELS[number];

// Package config for each tier
export const packageConfigSchema = z.object({
  tier: z.number(),
  releaseMultiplier: z.number().min(0.1), // Total release = investment × multiplier
  stakingPeriodDays: z.number().min(1), // Staking period for this package
  tradingFeeRate: z.number().min(0).max(100), // Trading fee rate for this package
  tradingProfitRate: z.number().min(-100).max(100), // Expected profit rate for this package
  profitSharePercent: z.number().min(0).max(100), // User profit share for this package
  // Release choice distribution (must sum to 100%)
  releaseWithdrawPercent: z.number().min(0).max(100), // % to withdraw (sell)
  releaseKeepPercent: z.number().min(0).max(100), // % to keep as fee
  releaseConvertPercent: z.number().min(0).max(100), // % to convert to trading capital
});

export type PackageConfig = z.infer<typeof packageConfigSchema>;

// Days mode config for each duration tier
export const daysConfigSchema = z.object({
  days: z.number(), // 30, 60, 90, 180
  releaseMultiplier: z.number().min(1), // Total AF = deposit/price * multiplier
  tradingFeeRate: z.number().min(0).max(100),
  tradingProfitRate: z.number().min(-100).max(100),
  profitSharePercent: z.number().min(0).max(100),
  withdrawFeePercent: z.number().min(0).max(100), // Fee on AF withdrawal (default 20%)
});

export type DaysConfig = z.infer<typeof daysConfigSchema>;

// Main configuration schema
export const afxConfigSchema = z.object({
  // AF Release Mode
  afReleaseMode: z.enum(['gold_standard', 'coin_standard']),

  // Simulation Mode: package (配套模式) or days (天数模式)
  simulationMode: z.enum(['package', 'days']),

  // Package configs (per tier)
  packageConfigs: z.array(packageConfigSchema),

  // Days mode configs (per duration tier)
  daysConfigs: z.array(daysConfigSchema),
  
  // Trading capital multiplier (global setting for all packages)
  tradingCapitalMultiplier: z.number().min(1), // Principal × multiplier = trading capital

  // Core settings
  stakingEnabled: z.boolean(), // Whether AF release period is enabled
  releaseStartsTradingDays: z.number().min(0), // Days after staking before trading begins
  
  // Initial LP pool settings
  initialLpUsdc: z.number().min(0), // Initial USDC in LP pool
  initialLpAf: z.number().min(0), // Initial AF in LP pool
  
  // USDC deposit allocation (from user deposits)
  depositLpRatio: z.number().min(0).max(100), // % of deposit to LP (add liquidity)
  depositBuybackRatio: z.number().min(0).max(100), // % of deposit to buyback AF
  // Remaining goes to trading reserve (calculated as 100 - lpRatio - buybackRatio)
  
  // Daily trading volume percent (how much of trading capital is traded daily)
  dailyTradingVolumePercent: z.number().min(0).max(100),
  
  // AF to trading capital conversion rate (multiplier when converting AF to trading capital)
  afToTradingCapitalRate: z.number().min(0),
  
  // Burn ratio for withdrawn AF (% of withdrawn AF that gets burned)
  afExitBurnRatio: z.number().min(0).max(100),
  
  // Trading fund flow ratios (from trading capital)
  lpPoolUsdcRatio: z.number().min(0).max(100), // % USDC to LP
  lpPoolAfRatio: z.number().min(0).max(100), // % AF to LP
  buybackRatio: z.number().min(0).max(100), // % to buyback
  reserveRatio: z.number().min(0).max(100), // % to forex reserve
  
  // Broker system
  brokerPromotionRatios: z.array(z.number()), // V1-V6 promotion rates
  brokerLayerDistribution: z.array(z.object({
    level: z.string(),
    layers: z.array(z.number()),
    ratePerLayer: z.number(),
  })),
});

export type AFxConfig = z.infer<typeof afxConfigSchema>;

// Staking order
export const stakingOrderSchema = z.object({
  id: z.string(),
  packageTier: z.number(),
  amount: z.number(),
  startDate: z.string(),
  daysStaked: z.number(),
  afReleased: z.number(),
  tradingCapital: z.number(),
  // New fields for mode support
  mode: z.enum(['package', 'days']).default('package'),
  startDay: z.number().default(0), // Which simulation day this order was placed
  durationDays: z.number().optional(), // For days mode
  totalAfToRelease: z.number().default(0), // For days mode: total AF to release over duration
  afWithdrawn: z.number().default(0), // AF withdrawn so far
  afKeptInSystem: z.number().default(0), // AF kept in system (not withdrawn)
});

export type StakingOrder = z.infer<typeof stakingOrderSchema>;

// Simulation result for a day
export const dailySimulationSchema = z.object({
  day: z.number(),
  afReleased: z.number(),
  afPrice: z.number(),
  userProfit: z.number(),
  platformProfit: z.number(),
  brokerProfit: z.number(),
  tradingFeeConsumed: z.number(),
  lpPoolSize: z.number(),
  // Pool state snapshot at end of day
  poolUsdcBalance: z.number(), // USDC in pool
  poolAfBalance: z.number(), // AF in pool
  poolTotalValue: z.number(), // Pool TVL in USDC (USDC + AF * price)
  buybackAmountUsdc: z.number(), // Buyback amount in USDC
  burnAmountAf: z.number(), // Burn amount in AF
  // Exit distribution tracking
  toSecondaryMarketAf: z.number(), // AF sold to secondary market
  toTradingFeeAf: z.number(), // AF kept as trading fee
  toTradingCapitalUsdc: z.number(), // Converted to trading capital
  // AF selling revenue (USDC received from selling withdrawn AF to LP pool)
  afSellingRevenueUsdc: z.number(),
  // Fund flow tracking (from trading capital)
  lpContributionUsdc: z.number(), // USDC added to LP pool
  lpContributionAfValue: z.number(), // AF value added to LP pool (in USDC)
  reserveAmountUsdc: z.number(), // Forex reserve (in USDC)
});

export type DailySimulation = z.infer<typeof dailySimulationSchema>;

// Per-order daily detail for the popup
export const orderDailyDetailSchema = z.object({
  day: z.number(),
  orderId: z.string(),
  principalRelease: z.number(), // USDC value of principal component
  interestRelease: z.number(), // USDC value of interest component
  dailyAfRelease: z.number(), // AF released this day
  afPrice: z.number(),
  cumAfReleased: z.number(), // Cumulative AF released
  afInSystem: z.number(), // AF kept in system (not withdrawn)
  tradingCapital: z.number(), // Trading capital from un-withdrawn AF
  forexIncome: z.number(), // Forex trading income this day
  withdrawnAf: z.number(), // AF withdrawn this day
  withdrawFee: z.number(), // Withdraw fee (USDC)
});

export type OrderDailyDetail = z.infer<typeof orderDailyDetailSchema>;

// Per-order release progress
export const orderReleaseProgressSchema = z.object({
  orderId: z.string(),
  packageTier: z.number(),
  amount: z.number(), // Original staking amount
  totalDays: z.number(), // Total staking period
  currentDay: z.number(), // Current day in simulation
  daysRemaining: z.number(), // Days remaining
  progressPercent: z.number(), // Progress percentage
  totalAfReleased: z.number(), // Total AF released so far
  dailyAfRelease: z.number(), // Daily AF release amount
  totalAfValue: z.number(), // Total value of released AF (in USDC)
  tradingCapital: z.number(), // Trading capital allocated
  isComplete: z.boolean(), // Whether release is complete
  // New fields for mode support
  mode: z.enum(['package', 'days']).default('package'),
  startDay: z.number().default(0),
  afKeptInSystem: z.number().default(0),
  afWithdrawn: z.number().default(0),
});

export type OrderReleaseProgress = z.infer<typeof orderReleaseProgressSchema>;

// AAM Pool state
export const aamPoolSchema = z.object({
  usdcBalance: z.number(),
  afBalance: z.number(),
  lpTokens: z.number(),
  afPrice: z.number(),
  totalBuyback: z.number(),
  totalBurn: z.number(),
});

export type AAMPool = z.infer<typeof aamPoolSchema>;

// Trading simulation result
export const tradingSimulationSchema = z.object({
  tradeVolume: z.number(),
  tradingFee: z.number(),
  userProfit: z.number(),
  platformProfit: z.number(),
  brokerProfit: z.number(),
  lpContribution: z.number(),
  buybackAmount: z.number(),
  reserveAmount: z.number(),
});

export type TradingSimulation = z.infer<typeof tradingSimulationSchema>;

// Default days mode configurations
export const defaultDaysConfigs: DaysConfig[] = [
  { days: 30, releaseMultiplier: 1.5, tradingFeeRate: 10, tradingProfitRate: 3, profitSharePercent: 60, withdrawFeePercent: 20 },
  { days: 60, releaseMultiplier: 2.0, tradingFeeRate: 8, tradingProfitRate: 5, profitSharePercent: 65, withdrawFeePercent: 20 },
  { days: 90, releaseMultiplier: 2.5, tradingFeeRate: 6, tradingProfitRate: 6, profitSharePercent: 75, withdrawFeePercent: 20 },
  { days: 180, releaseMultiplier: 3.0, tradingFeeRate: 3, tradingProfitRate: 8, profitSharePercent: 80, withdrawFeePercent: 20 },
];

// Default configuration
export const defaultConfig: AFxConfig = {
  afReleaseMode: 'gold_standard',
  simulationMode: 'package',
  daysConfigs: defaultDaysConfigs,
  tradingCapitalMultiplier: 3, // Global trading capital multiplier (principal × multiplier)
  packageConfigs: PACKAGE_TIERS.map(tier => ({
    tier,
    releaseMultiplier: tier === 100 ? 1.5 : tier === 500 ? 1.8 : tier === 1000 ? 2.0 : tier === 3000 ? 2.5 : tier === 5000 ? 3.0 : 3.5,
    stakingPeriodDays: tier === 100 ? 30 : tier === 500 ? 45 : tier === 1000 ? 60 : tier === 3000 ? 90 : tier === 5000 ? 120 : 180,
    tradingFeeRate: tier === 100 ? 8 : tier === 500 ? 6 : tier === 1000 ? 5 : tier === 3000 ? 4 : tier === 5000 ? 2 : 1,
    tradingProfitRate: tier === 100 ? 3 : tier === 500 ? 4 : tier === 1000 ? 5 : tier === 3000 ? 6 : tier === 5000 ? 7 : 8,
    profitSharePercent: tier === 100 ? 60 : tier === 500 ? 65 : tier === 1000 ? 70 : tier === 3000 ? 75 : tier === 5000 ? 80 : 85,
    releaseWithdrawPercent: 60, // 60% withdraw (sell to secondary market)
    releaseKeepPercent: 20, // 20% keep as trading fee
    releaseConvertPercent: 20, // 20% convert to trading capital
  })),
  stakingEnabled: true,
  releaseStartsTradingDays: 0, // Trading starts immediately
  initialLpUsdc: 1000000, // 1M USDC initial LP
  initialLpAf: 10000000, // 10M AF initial LP
  depositLpRatio: 30, // 30% of deposits to LP
  depositBuybackRatio: 20, // 20% of deposits to buyback
  // Remaining 50% goes to trading reserve
  dailyTradingVolumePercent: 10, // 10% of trading capital traded daily
  afToTradingCapitalRate: 1.5,
  afExitBurnRatio: 20, // 20% of withdrawn AF gets burned
  lpPoolUsdcRatio: 30,
  lpPoolAfRatio: 30,
  buybackRatio: 20,
  reserveRatio: 50,
  brokerPromotionRatios: [40, 50, 60, 70, 85, 100],
  brokerLayerDistribution: [
    { level: 'V1', layers: [1, 2, 3, 4], ratePerLayer: 4 },
    { level: 'V2', layers: [5, 6, 7, 8], ratePerLayer: 4 },
    { level: 'V3', layers: [9, 10, 11], ratePerLayer: 3 },
    { level: 'V4', layers: [12, 13, 14], ratePerLayer: 3 },
    { level: 'V5', layers: [15, 16, 17], ratePerLayer: 3 },
    { level: 'V6', layers: [18, 19, 20], ratePerLayer: 3 },
  ],
};

// Keep existing user schema for compatibility
import { sql } from "drizzle-orm";
import { pgTable, text, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
