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
          
          // Debug logging
          console.log('Adding order:', {
            depositAmount,
            lpRatio: state.config.depositLpRatio,
            buybackRatio: state.config.depositBuybackRatio,
            toLp,
            toBuyback,
            currentPool: state.aamPool,
          });
          
          // Update AAM pool
          let newPool = { ...state.aamPool };
          
          // Add USDC to LP pool
          if (toLp > 0) {
            newPool.usdcBalance += toLp;
          }
          
          // Buyback AF (removes USDC from pool, adds AF)
          // Only do buyback if there's meaningful AF in the pool (more than floor value)
          if (toBuyback > 0 && newPool.afPrice > 0 && newPool.afBalance > 1) {
            // Calculate how much AF can actually be bought (limited by pool balance)
            const minAfFloor = 1; // Keep at least 1 AF in pool
            const maxAfCanBuy = Math.max(0, newPool.afBalance - minAfFloor);
            const afWantToBuy = toBuyback / newPool.afPrice;
            const afBought = Math.min(afWantToBuy, maxAfCanBuy);
            
            if (afBought > 0) {
              const actualBuybackUsdc = afBought * newPool.afPrice;
              newPool.usdcBalance += actualBuybackUsdc; // USDC enters pool
              newPool.afBalance -= afBought; // AF exits pool (bought)
              newPool.totalBuyback += actualBuybackUsdc;
            }
          }
          
          // Always recalculate price based on AMM formula (x*y=k model: price = usdc/af)
          newPool.afBalance = Math.max(1, newPool.afBalance); // Safety floor of 1 AF
          newPool.afPrice = newPool.usdcBalance / newPool.afBalance;
          newPool.lpTokens = Math.sqrt(newPool.usdcBalance * newPool.afBalance);
          
          console.log('New pool after order:', newPool);
          
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
        
        return {
          ...currentState,
          ...persisted,
          config: mergedConfig,
          aamPool,
          stakingOrders: persisted.stakingOrders || [],
        };
      },
    }
  )
);
