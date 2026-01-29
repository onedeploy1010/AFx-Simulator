import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AFxConfig, StakingOrder, AAMPool, PackageConfig } from "@shared/schema";
import { defaultConfig, PACKAGE_TIERS } from "@shared/schema";

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
        set((state) => ({
          config: { ...state.config, ...newConfig },
        })),
      
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
        set((state) => ({
          stakingOrders: [
            ...state.stakingOrders,
            { ...order, id: crypto.randomUUID() },
          ],
        })),
      
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
    }
  )
);
