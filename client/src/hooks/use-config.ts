import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AFxConfig, StakingOrder, AAMPool, PackageConfig, DaysConfig } from "@shared/schema";
import { defaultConfig, defaultDaysConfigs, PACKAGE_TIERS } from "@shared/schema";

// Merge saved config with defaults to handle new fields
const mergeWithDefaults = (savedConfig: Partial<AFxConfig>): AFxConfig => {
  return {
    ...defaultConfig,
    ...savedConfig,
    // Ensure new fields have defaults if missing from localStorage
    simulationMode: savedConfig.simulationMode ?? defaultConfig.simulationMode,
    tradingCapitalMultiplier: savedConfig.tradingCapitalMultiplier ?? defaultConfig.tradingCapitalMultiplier,
    initialLpUsdc: savedConfig.initialLpUsdc ?? defaultConfig.initialLpUsdc,
    initialLpAf: savedConfig.initialLpAf ?? defaultConfig.initialLpAf,
    depositLpRatio: savedConfig.depositLpRatio ?? defaultConfig.depositLpRatio,
    depositBuybackRatio: savedConfig.depositBuybackRatio ?? defaultConfig.depositBuybackRatio,
    // Merge package configs properly
    packageConfigs: savedConfig.packageConfigs?.map((pkg, i) => ({
      ...defaultConfig.packageConfigs[i],
      ...pkg,
      // Migrate afReleaseRate → releaseMultiplier if needed
      releaseMultiplier: pkg.releaseMultiplier ?? (pkg as any).afReleaseRate ?? defaultConfig.packageConfigs[i]?.releaseMultiplier ?? 1.5,
      // Ensure release choice fields exist
      releaseWithdrawPercent: pkg.releaseWithdrawPercent ?? defaultConfig.packageConfigs[i]?.releaseWithdrawPercent ?? 60,
      releaseKeepPercent: pkg.releaseKeepPercent ?? defaultConfig.packageConfigs[i]?.releaseKeepPercent ?? 20,
      releaseConvertPercent: pkg.releaseConvertPercent ?? defaultConfig.packageConfigs[i]?.releaseConvertPercent ?? 20,
    })) ?? defaultConfig.packageConfigs,
    // Merge days configs properly
    daysConfigs: savedConfig.daysConfigs?.map((dc, i) => ({
      ...defaultDaysConfigs[i],
      ...dc,
    })) ?? defaultDaysConfigs,
    // Broker system new fields
    brokerLayerRates: savedConfig.brokerLayerRates ?? defaultConfig.brokerLayerRates,
    brokerLevelAccess: savedConfig.brokerLevelAccess ?? defaultConfig.brokerLevelAccess,
    brokerDividendRates: savedConfig.brokerDividendRates ?? defaultConfig.brokerDividendRates,
  };
};

interface ConfigStore {
  config: AFxConfig;
  stakingOrders: StakingOrder[];
  aamPool: AAMPool;
  currentSimulationDay: number;
  setConfig: (config: Partial<AFxConfig>) => void;
  updatePackageConfig: (tier: number, updates: Partial<PackageConfig>) => void;
  updateDaysConfig: (days: number, updates: Partial<DaysConfig>) => void;
  resetConfig: () => void;
  resetAll: () => void;
  addStakingOrder: (order: Omit<StakingOrder, "id">) => void;
  removeStakingOrder: (id: string) => void;
  clearStakingOrders: () => void;
  updateAAMPool: (pool: Partial<AAMPool>) => void;
  resetAAMPool: () => void;
  setSimulationDay: (day: number) => void;
  advanceToDay: (day: number) => void;
}

const getInitialAAMPool = (config: AFxConfig): AAMPool => ({
  usdcBalance: config.initialLpUsdc,
  afBalance: config.initialLpAf,
  lpTokens: Math.sqrt(config.initialLpUsdc * config.initialLpAf),
  afPrice: config.initialLpAf > 0 ? config.initialLpUsdc / config.initialLpAf : 0.1,
  totalBuyback: 0,
  totalBurn: 0,
});

const initialAAMPool = getInitialAAMPool(defaultConfig);

export const useConfigStore = create<ConfigStore>()(
  persist(
    (set, get) => ({
      config: defaultConfig,
      stakingOrders: [],
      aamPool: initialAAMPool,
      currentSimulationDay: 0,

      setConfig: (newConfig) =>
        set((state) => {
          const updatedConfig = { ...state.config, ...newConfig };

          // If initial LP settings changed, update AAM pool to match
          const lpConfigChanged =
            (newConfig.initialLpUsdc !== undefined && newConfig.initialLpUsdc !== state.config.initialLpUsdc) ||
            (newConfig.initialLpAf !== undefined && newConfig.initialLpAf !== state.config.initialLpAf);

          if (lpConfigChanged) {
            return {
              config: updatedConfig,
              aamPool: getInitialAAMPool(updatedConfig),
              stakingOrders: [], // Clear orders when LP config changes
              currentSimulationDay: 0,
            };
          }

          return { config: updatedConfig };
        }),

      updatePackageConfig: (tier, updates) =>
        set((state) => ({
          config: {
            ...state.config,
            packageConfigs: state.config.packageConfigs.map((pkg) =>
              pkg.tier === tier ? { ...pkg, ...updates } : pkg
            ),
          },
        })),

      updateDaysConfig: (days, updates) =>
        set((state) => ({
          config: {
            ...state.config,
            daysConfigs: state.config.daysConfigs.map((dc) =>
              dc.days === days ? { ...dc, ...updates } : dc
            ),
          },
        })),

      resetConfig: () => set({ config: defaultConfig, currentSimulationDay: 0 }),

      resetAll: () => set({
        config: defaultConfig,
        stakingOrders: [],
        aamPool: getInitialAAMPool(defaultConfig),
        currentSimulationDay: 0,
      }),

      addStakingOrder: (order) =>
        set((state) => {
          const depositAmount = order.amount;
          const lpRatio = state.config.depositLpRatio / 100;
          const buybackRatio = state.config.depositBuybackRatio / 100;

          // Calculate deposit allocation
          const toLp = depositAmount * lpRatio;
          const toBuyback = depositAmount * buybackRatio;

          // Update AAM pool
          let newPool = { ...state.aamPool };

          if (toLp > 0 && newPool.afPrice > 0) {
            const afToAdd = toLp / newPool.afPrice;
            newPool.usdcBalance += toLp;
            newPool.afBalance += afToAdd;
          }

          if (toBuyback > 0 && newPool.afPrice > 0 && newPool.afBalance > 1) {
            const minAfFloor = 1;
            const maxAfCanBuy = Math.max(0, newPool.afBalance - minAfFloor);
            const afWantToBuy = toBuyback / newPool.afPrice;
            const afBought = Math.min(afWantToBuy, maxAfCanBuy);

            if (afBought > 0) {
              const actualBuybackUsdc = afBought * newPool.afPrice;
              newPool.usdcBalance += actualBuybackUsdc;
              newPool.afBalance -= afBought;
              newPool.totalBuyback += actualBuybackUsdc;
              newPool.afPrice = newPool.usdcBalance / newPool.afBalance;
            }
          }

          newPool.afBalance = Math.max(1, newPool.afBalance);
          newPool.afPrice = newPool.usdcBalance / newPool.afBalance;
          newPool.lpTokens = Math.sqrt(newPool.usdcBalance * newPool.afBalance);

          // Stamp order with mode and simulation day
          const newOrder = {
            ...order,
            id: crypto.randomUUID(),
            mode: order.mode || state.config.simulationMode,
            startDay: order.startDay ?? state.currentSimulationDay,
            afWithdrawn: 0,
            afKeptInSystem: 0,
          };

          return {
            stakingOrders: [...state.stakingOrders, newOrder],
            aamPool: newPool,
          };
        }),
      
      removeStakingOrder: (id) =>
        set((state) => ({
          stakingOrders: state.stakingOrders.filter((o) => o.id !== id),
        })),
      
      clearStakingOrders: () => set({ stakingOrders: [] }),
      
      updateAAMPool: (pool) =>
        set((state) => ({
          aamPool: { ...state.aamPool, ...pool },
        })),
      
      resetAAMPool: () => set((state) => ({
        aamPool: getInitialAAMPool(state.config)
      })),

      setSimulationDay: (day) => set({ currentSimulationDay: Math.max(0, day) }),

      advanceToDay: (day) =>
        set((state) => ({
          currentSimulationDay: Math.max(state.currentSimulationDay, day),
        })),
    }),
    {
      name: "afx-config-storage",
      // Migrate stored config to handle new fields
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<ConfigStore> | undefined;
        if (!persisted) return currentState;
        
        const mergedConfig = mergeWithDefaults(persisted.config || {});
        
        // Auto-sync AAM pool with config's initial values if they don't match
        let aamPool = persisted.aamPool || currentState.aamPool;
        const expectedInitialPrice = mergedConfig.initialLpAf > 0 
          ? mergedConfig.initialLpUsdc / mergedConfig.initialLpAf 
          : 0.1;
        
        // If the initial LP values changed or pool seems stale, reset it
        const configInitialUsdc = mergedConfig.initialLpUsdc;
        const configInitialAf = mergedConfig.initialLpAf;
        const poolNeedsReset = !persisted.aamPool || 
          (persisted.stakingOrders?.length === 0 && 
           Math.abs(aamPool.afPrice - expectedInitialPrice) > 0.0001);
        
        if (poolNeedsReset) {
          aamPool = getInitialAAMPool(mergedConfig);
        }
        
        // Ensure staking orders have new fields
        const migratedOrders = (persisted.stakingOrders || []).map(o => ({
          ...o,
          mode: o.mode || 'package' as const,
          startDay: o.startDay ?? 0,
          totalAfToRelease: o.totalAfToRelease ?? 0,
          afWithdrawn: o.afWithdrawn ?? 0,
          afKeptInSystem: o.afKeptInSystem ?? 0,
          withdrawPercent: o.withdrawPercent ?? 60,
        }));

        return {
          ...currentState,
          ...persisted,
          config: mergedConfig,
          aamPool,
          stakingOrders: migratedOrders,
          currentSimulationDay: persisted.currentSimulationDay ?? 0,
        };
      },
    }
  )
);
