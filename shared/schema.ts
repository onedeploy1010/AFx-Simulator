import { z } from "zod";

// Package tiers available
export const PACKAGE_TIERS = [100, 500, 1000, 3000, 5000, 10000] as const;
export type PackageTier = typeof PACKAGE_TIERS[number];

// AF Release Mode
export type AFReleaseMode = 'gold_standard' | 'coin_standard';

// User profit sharing tiers
export const PROFIT_SHARE_TIERS = [60, 65, 70, 75, 80, 85] as const;
export type ProfitShareTier = typeof PROFIT_SHARE_TIERS[number];

// Broker levels
export const BROKER_LEVELS = ['V1', 'V2', 'V3', 'V4', 'V5', 'V6'] as const;
export type BrokerLevel = typeof BROKER_LEVELS[number];

// Package config for each tier
export const packageConfigSchema = z.object({
  tier: z.number(),
  afReleaseRate: z.number().min(0).max(100), // AF release interest rate per day
  tradingCapitalMultiplier: z.number().min(1), // Principal × multiplier
});

export type PackageConfig = z.infer<typeof packageConfigSchema>;

// Main configuration schema
export const afxConfigSchema = z.object({
  // AF Release Mode
  afReleaseMode: z.enum(['gold_standard', 'coin_standard']),
  
  // Package configs (per tier)
  packageConfigs: z.array(packageConfigSchema),
  
  // Staking settings
  stakingEnabled: z.boolean(),
  stakingPeriodDays: z.number().min(1),
  
  // Trading simulation parameters
  dailyTradingVolumePercent: z.number().min(0).max(100), // % of trading capital traded daily
  tradingProfitRatePercent: z.number().min(-100).max(100), // Expected profit rate per trade
  
  // Trading fee rate (varies by staking amount: 1%-8%)
  tradingFeeRateMin: z.number().min(0).max(100),
  tradingFeeRateMax: z.number().min(0).max(100),
  
  // User profit share tier
  userProfitShareTier: z.number().min(60).max(85),
  
  // AF release exit ratios
  afExitWithdrawRatio: z.number().min(0).max(100), // % to secondary market
  afExitBurnRatio: z.number().min(0).max(100), // % destroyed
  afExitTradingFeeRatio: z.number().min(0).max(100), // % kept as trading fee
  afExitConvertRatio: z.number().min(0).max(100), // % converted to trading capital
  
  // AF to trading capital conversion rate
  afToTradingCapitalRate: z.number().min(0),
  
  // User release choice distribution
  userWithdrawChoicePercent: z.number().min(0).max(100),
  userConvertChoicePercent: z.number().min(0).max(100),
  
  // Trading fund flow ratios
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
  buybackAmountUsdc: z.number(), // Buyback amount in USDC
  burnAmountAf: z.number(), // Burn amount in AF
  // Exit distribution tracking
  toSecondaryMarketAf: z.number(), // AF sold to secondary market
  toTradingFeeAf: z.number(), // AF kept as trading fee
  toTradingCapitalUsdc: z.number(), // Converted to trading capital
  // Fund flow tracking (from trading capital)
  lpContributionUsdc: z.number(), // USDC added to LP pool
  lpContributionAfValue: z.number(), // AF value added to LP pool (in USDC)
  reserveAmountUsdc: z.number(), // Forex reserve (in USDC)
});

export type DailySimulation = z.infer<typeof dailySimulationSchema>;

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

// Default configuration
export const defaultConfig: AFxConfig = {
  afReleaseMode: 'gold_standard',
  packageConfigs: PACKAGE_TIERS.map(tier => ({
    tier,
    afReleaseRate: tier === 100 ? 0.5 : tier === 500 ? 0.6 : tier === 1000 ? 0.7 : tier === 3000 ? 0.8 : tier === 5000 ? 0.9 : 1.0,
    tradingCapitalMultiplier: tier === 100 ? 2 : tier === 500 ? 2.5 : tier === 1000 ? 3 : tier === 3000 ? 3.5 : tier === 5000 ? 4 : 5,
  })),
  stakingEnabled: true,
  stakingPeriodDays: 30,
  dailyTradingVolumePercent: 10, // 10% of trading capital traded daily
  tradingProfitRatePercent: 5, // 5% profit rate per trade
  tradingFeeRateMin: 1,
  tradingFeeRateMax: 8,
  userProfitShareTier: 70,
  afExitWithdrawRatio: 80,
  afExitBurnRatio: 20,
  afExitTradingFeeRatio: 0,
  afExitConvertRatio: 0,
  afToTradingCapitalRate: 1.5,
  userWithdrawChoicePercent: 60,
  userConvertChoicePercent: 40,
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
