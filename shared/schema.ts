import { z } from "zod";

// Package tiers available
export const PACKAGE_TIERS = [100, 500, 1000, 3000, 5000, 10000] as const;
export type PackageTier = typeof PACKAGE_TIERS[number];

// MS Release Mode
export type MSReleaseMode = 'gold_standard' | 'coin_standard';

// Trading Mode
export type TradingMode = 'individual' | 'dividend_pool';

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
  releaseMultiplier: z.number().min(1), // Total MS = deposit/price * multiplier
  tradingFeeRate: z.number().min(0).max(100),
  tradingProfitRate: z.number().min(-100).max(100),
  profitSharePercent: z.number().min(0).max(100),
  withdrawFeePercent: z.number().min(0).max(100), // Fee on MS withdrawal (default 20%)
});

export type DaysConfig = z.infer<typeof daysConfigSchema>;

// Main configuration schema
export const nmsConfigSchema = z.object({
  // MS Release Mode
  msReleaseMode: z.enum(['gold_standard', 'coin_standard']),

  // Simulation Mode: package (配套模式) or days (天数模式)
  simulationMode: z.enum(['package', 'days']),

  // Package configs (per tier)
  packageConfigs: z.array(packageConfigSchema),

  // Days mode configs (per duration tier)
  daysConfigs: z.array(daysConfigSchema),
  
  // Trading capital multiplier (global setting for all packages)
  tradingCapitalMultiplier: z.number().min(1), // Principal × multiplier = trading capital

  // Core settings
  stakingEnabled: z.boolean(), // Whether MS release period is enabled
  releaseStartsTradingDays: z.number().min(0), // Days after staking before trading begins
  
  // Initial LP pool settings
  initialLpUsdc: z.number().min(0), // Initial USDC in LP pool
  initialLpMs: z.number().min(0), // Initial MS in LP pool
  
  // USDC deposit allocation (from user deposits)
  depositLpRatio: z.number().min(0).max(100), // % of deposit to LP (add liquidity)
  depositBuybackRatio: z.number().min(0).max(100), // % of deposit to buyback MS
  // Remaining goes to trading reserve (calculated as 100 - lpRatio - buybackRatio)
  
  // Daily trading volume percent (how much of trading capital is traded daily)
  dailyTradingVolumePercent: z.number().min(0).max(100),
  
  // Burn ratio for withdrawn MS (% of withdrawn MS that gets burned)
  msExitBurnRatio: z.number().min(0).max(100),
  
  // Trading fund flow ratios (from trading capital)
  lpPoolUsdcRatio: z.number().min(0).max(100), // % USDC to LP
  lpPoolMsRatio: z.number().min(0).max(100), // % MS to LP
  buybackRatio: z.number().min(0).max(100), // % to buyback
  reserveRatio: z.number().min(0).max(100), // % to forex reserve
  
  // Multiplier cap for days mode (stop releasing when MS value reaches principal × multiplier)
  multiplierCapEnabled: z.boolean(),

  // Trading mode: individual (per-order trading) or dividend_pool (MS-weighted pool distribution)
  tradingMode: z.enum(['individual', 'dividend_pool']),

  // Dividend pool parameters
  dividendMarginMultiplier: z.number().min(0), // Margin multiplier for dividend pool
  depositTradingPoolRatio: z.number().min(0).max(100), // % of deposits into trading pool
  poolDailyProfitRate: z.number().min(0).max(100), // Daily profit rate of trading pool

  // Broker system — layer rates, level access, dividend rates
  brokerLayerRates: z.array(z.object({
    fromLayer: z.number(),
    toLayer: z.number(),
    ratePercent: z.number(),
  })),
  brokerLevelAccess: z.array(z.object({
    level: z.string(),
    maxLayer: z.number(),
  })),
  brokerDividendRates: z.array(z.number()), // V1-V6 differential dividend rates
});

export type NMSConfig = z.infer<typeof nmsConfigSchema>;

// Staking order
export const stakingOrderSchema = z.object({
  id: z.string(),
  packageTier: z.number(),
  amount: z.number(),
  startDate: z.string(),
  daysStaked: z.number(),
  msReleased: z.number(),
  tradingCapital: z.number(),
  // New fields for mode support
  mode: z.enum(['package', 'days']).default('package'),
  startDay: z.number().default(0), // Which simulation day this order was placed
  durationDays: z.number().optional(), // For days mode
  totalMsToRelease: z.number().default(0), // For days mode: total MS to release over duration
  msWithdrawn: z.number().default(0), // MS withdrawn so far
  msKeptInSystem: z.number().default(0), // MS kept in system (not withdrawn)
  // Per-order MS release withdrawal ratio (0-100)
  // 0% = all MS → trading capital (no sell pressure)
  // 100% = all MS → withdraw → burn portion + secondary market sell pressure
  withdrawPercent: z.number().min(0).max(100).default(60),
});

export type StakingOrder = z.infer<typeof stakingOrderSchema>;

// Simulation result for a day
export const dailySimulationSchema = z.object({
  day: z.number(),
  msReleased: z.number(),
  msPrice: z.number(),
  userProfit: z.number(),
  platformProfit: z.number(),
  brokerProfit: z.number(),
  tradingFeeConsumed: z.number(),
  lpPoolSize: z.number(),
  // Pool state snapshot at end of day
  poolUsdcBalance: z.number(), // USDC in pool
  poolMsBalance: z.number(), // MS in pool
  poolTotalValue: z.number(), // Pool TVL in USDC (USDC + MS * price)
  buybackAmountUsdc: z.number(), // Buyback amount in USDC
  burnAmountMs: z.number(), // Burn amount in MS
  // Exit distribution tracking
  toSecondaryMarketMs: z.number(), // MS sold to secondary market
  // MS selling revenue (USDC received from selling withdrawn MS to LP pool)
  msSellingRevenueUsdc: z.number(),
  // Fund flow tracking (from trading capital)
  lpContributionUsdc: z.number(), // USDC added to LP pool
  lpContributionMsValue: z.number(), // MS value added to LP pool (in USDC)
  reserveAmountUsdc: z.number(), // Forex reserve (in USDC)
});

export type DailySimulation = z.infer<typeof dailySimulationSchema>;

// Per-order daily detail for the popup
export const orderDailyDetailSchema = z.object({
  day: z.number(),
  orderId: z.string(),
  principalRelease: z.number(), // USDC value of principal component
  interestRelease: z.number(), // USDC value of interest component
  dailyMsRelease: z.number(), // MS released this day
  msPrice: z.number(),
  cumMsReleased: z.number(), // Cumulative MS released
  msInSystem: z.number(), // MS kept in system (not withdrawn)
  tradingCapital: z.number(), // Trading capital from un-withdrawn MS
  forexIncome: z.number(), // Forex trading income this day
  withdrawnMs: z.number(), // MS withdrawn this day
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
  totalMsReleased: z.number(), // Total MS released so far
  dailyMsRelease: z.number(), // Daily MS release amount
  totalMsValue: z.number(), // Total value of released MS (in USDC)
  tradingCapital: z.number(), // Trading capital allocated
  isComplete: z.boolean(), // Whether release is complete
  // New fields for mode support
  mode: z.enum(['package', 'days']).default('package'),
  startDay: z.number().default(0),
  msKeptInSystem: z.number().default(0),
  msWithdrawn: z.number().default(0),
});

export type OrderReleaseProgress = z.infer<typeof orderReleaseProgressSchema>;

// AAM Pool state
export const aamPoolSchema = z.object({
  usdcBalance: z.number(),
  msBalance: z.number(),
  lpTokens: z.number(),
  msPrice: z.number(),
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
  { days: 30, releaseMultiplier: 1.4, tradingFeeRate: 10, tradingProfitRate: 10, profitSharePercent: 60, withdrawFeePercent: 20 },
  { days: 60, releaseMultiplier: 1.6, tradingFeeRate: 8, tradingProfitRate: 10, profitSharePercent: 65, withdrawFeePercent: 20 },
  { days: 90, releaseMultiplier: 1.8, tradingFeeRate: 6, tradingProfitRate: 10, profitSharePercent: 75, withdrawFeePercent: 20 },
  { days: 180, releaseMultiplier: 2.0, tradingFeeRate: 3, tradingProfitRate: 10, profitSharePercent: 80, withdrawFeePercent: 20 },
];

// Default configuration
export const defaultConfig: NMSConfig = {
  msReleaseMode: 'coin_standard',
  simulationMode: 'days',
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
  initialLpUsdc: 10000, // 10K USDC initial LP
  initialLpMs: 100000, // 100K MS initial LP
  depositLpRatio: 30, // 30% of deposits to LP
  depositBuybackRatio: 20, // 20% of deposits to buyback
  // Remaining 50% goes to trading reserve
  dailyTradingVolumePercent: 10, // 10% of trading capital traded daily
  msExitBurnRatio: 20, // 20% of withdrawn MS gets burned
  lpPoolUsdcRatio: 30,
  lpPoolMsRatio: 30,
  buybackRatio: 20,
  reserveRatio: 50,
  multiplierCapEnabled: true,
  tradingMode: 'individual',
  dividendMarginMultiplier: 3,
  depositTradingPoolRatio: 50,
  poolDailyProfitRate: 10,
  brokerLayerRates: [
    { fromLayer: 1, toLayer: 8, ratePercent: 4 },
    { fromLayer: 9, toLayer: 20, ratePercent: 3 },
  ],
  brokerLevelAccess: [
    { level: 'V1', maxLayer: 3 },
    { level: 'V2', maxLayer: 8 },
    { level: 'V3', maxLayer: 11 },
    { level: 'V4', maxLayer: 14 },
    { level: 'V5', maxLayer: 17 },
    { level: 'V6', maxLayer: 20 },
  ],
  brokerDividendRates: [30, 40, 50, 60, 75, 90],
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
