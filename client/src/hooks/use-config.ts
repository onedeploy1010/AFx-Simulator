import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AFxConfig, StakingOrder, AAMPool, PackageConfig } from "@shared/schema";
import { defaultConfig, PACKAGE_TIERS } from "@shared/schema";

// Merge saved config with defaults to handle new fields
const mergeWithDefaults = (savedConfig: Partial<AFxConfig>): AFxConfig => {
  return {
    ...defaultConfig,
    ...savedConfig,
    // Ensure new fields have defaults if missing from localStorage
    initialLpUsdc: savedConfig.initialLpUsdc ?? defaultConfig.initialLpUsdc,
    initialLpAf: savedConfig.initialLpAf ?? defaultConfig.initialLpAf,
    depositLpRatio: savedConfig.depositLpRatio ?? defaultConfig.depositLpRatio,
    depositBuybackRatio: savedConfig.depositBuybackRatio ?? defaultConfig.depositBuybackRatio,
    // Merge package configs properly
    packageConfigs: savedConfig.packageConfigs?.map((pkg, i) => ({
      ...defaultConfig.packageConfigs[i],
      ...pkg,
      // Ensure release choice fields exist
      releaseWithdrawPercent: pkg.releaseWithdrawPercent ?? defaultConfig.packageConfigs[i]?.releaseWithdrawPercent ?? 60,
      releaseKeepPercent: pkg.releaseKeepPercent ?? defaultConfig.packageConfigs[i]?.releaseKeepPercent ?? 20,
      releaseConvertPercent: pkg.releaseConvertPercent ?? defaultConfig.packageConfigs[i]?.releaseConvertPercent ?? 20,
    })) ?? defaultConfig.packageConfigs,
  };
};

interface ConfigStore {
  config: AFxConfig;
  stakingOrders: StakingOrder[];
  aamPool: AAMPool;
  setConfig: (config: Partial<AFxConfig>) => void;
  updatePackageConfig: (tier: number, updates: Partial<PackageConfig>) => void;
  resetConfig: () => void;
  addStakingOrder: (order: Omit<StakingOrder, "id">) => void;
  removeStakingOrder: (id: string) => void;
  clearStakingOrders: () => void;
  updateAAMPool: (pool: Partial<AAMPool>) => void;
  resetAAMPool: () => void;
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
    (set) => ({
      config: defaultConfig,
      stakingOrders: [],
      aamPool: initialAAMPool,
      
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
      
      resetConfig: () => set({ config: defaultConfig }),
      
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
          
          // Add USDC to LP pool
          if (toLp > 0) {
            newPool.usdcBalance += toLp;
          }
          
          // Buyback AF (removes USDC from pool, adds AF)
          if (toBuyback > 0 && newPool.afPrice > 0) {
            const afBought = toBuyback / newPool.afPrice;
            newPool.usdcBalance += toBuyback; // USDC enters pool
            newPool.afBalance -= afBought; // AF exits pool (bought)
            newPool.afBalance = Math.max(0.01, newPool.afBalance); // Prevent zero/negative
            newPool.totalBuyback += toBuyback;
          }
          
          // Recalculate price based on AMM formula
          if (newPool.afBalance > 0.01) {
            newPool.afPrice = newPool.usdcBalance / newPool.afBalance;
          }
          newPool.lpTokens = Math.sqrt(newPool.usdcBalance * newPool.afBalance);
          
          return {
            stakingOrders: [
              ...state.stakingOrders,
              { ...order, id: crypto.randomUUID() },
            ],
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
    }),
    {
      name: "afx-config-storage",
      // Migrate stored config to handle new fields
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<ConfigStore> | undefined;
        if (!persisted) return currentState;
        
        return {
          ...currentState,
          ...persisted,
          config: mergeWithDefaults(persisted.config || {}),
          aamPool: persisted.aamPool || currentState.aamPool,
          stakingOrders: persisted.stakingOrders || [],
        };
      },
    }
  )
);
