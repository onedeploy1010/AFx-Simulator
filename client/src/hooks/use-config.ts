import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AFxConfig, StakingOrder, AAMPool } from "@shared/schema";
import { defaultConfig, PACKAGE_TIERS } from "@shared/schema";

interface ConfigStore {
  config: AFxConfig;
  stakingOrders: StakingOrder[];
  aamPool: AAMPool;
  setConfig: (config: Partial<AFxConfig>) => void;
  resetConfig: () => void;
  addStakingOrder: (order: Omit<StakingOrder, "id">) => void;
  removeStakingOrder: (id: string) => void;
  clearStakingOrders: () => void;
  updateAAMPool: (pool: Partial<AAMPool>) => void;
  resetAAMPool: () => void;
}

const initialAAMPool: AAMPool = {
  usdcBalance: 1000000,
  afBalance: 10000000,
  lpTokens: Math.sqrt(1000000 * 10000000),
  afPrice: 0.1,
  totalBuyback: 0,
  totalBurn: 0,
};

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
      
      resetAAMPool: () => set({ aamPool: initialAAMPool }),
    }),
    {
      name: "afx-config-storage",
    }
  )
);
