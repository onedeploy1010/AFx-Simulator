# AFx Calculator - 经济模型验证工具

## Overview
AFx 多参数可调模拟计算器，用于验证 AFx 项目的核心经济模型。支持用户收益、AF释放、手续费消耗、平台与经纪人现金流、币价与LP变化的完整模拟。

## Tech Stack
- **Frontend**: React + TypeScript + Vite
- **State Management**: Zustand with localStorage persistence
- **UI Components**: shadcn/ui + Tailwind CSS
- **Charts**: Recharts
- **Backend**: Express.js (minimal - mainly serves static files)
- **Routing**: Wouter

## Project Structure
```
client/
├── src/
│   ├── components/     # UI components (sidebar, theme provider)
│   ├── hooks/          # Custom hooks (use-config store)
│   ├── lib/            # Utility functions (calculations, query client)
│   ├── pages/          # Page components
│   │   ├── config.tsx      # 参数配置页面
│   │   ├── staking.tsx     # 质押模拟页面
│   │   ├── release.tsx     # 释放进度页面
│   │   ├── trading.tsx     # 交易模拟页面
│   │   ├── aam.tsx         # AAM池监控页面
│   │   └── broker.tsx      # 经纪人系统页面
│   └── App.tsx
shared/
└── schema.ts           # Type definitions and default config
server/
├── routes.ts           # API endpoints
└── storage.ts          # In-memory storage
```

## Key Features

### 1. 参数配置 (/config)
- AF 释放模式 (金本位/币本位)
- 配套档位设置 (100/500/1000/3000/5000/10000)
- 质押周期配置 (可启用/禁用)
- 交易模拟参数 (日交易量%、交易利润率%)
- 交易手续费率范围
- 用户分润比例阶梯
- AF 释放出口比例 (提现/销毁/手续费/转换)
- 交易资金流拆分 (LP池USDC/AF、回购、储备金)
- 经纪人系统配置

### 2. 质押模拟 (/staking)
- 添加多笔质押订单
- 按配套档位选择
- 每笔订单独立配置质押周期
- 自动计算交易金
- 质押禁用时显示提示

### 3. 释放进度 (/release)
- N天模拟运行
- AF释放趋势图表
- 币价变化曲线
- 收益与销毁对比
- AF 退出分配详情 (二级市场/销毁/手续费/转换交易金/回购)
- 交易资金流向汇总 (LP USDC/LP AF价值/回购/储备金)

### 4. 交易模拟 (/trading)
- 利润计算 (毛利润 → 手续费 → 净利润)
- 用户/平台/经纪人收益分配
- 交易资金流拆分 (基于交易本金: LP USDC/LP AF/回购/储备金/手续费)
- 手续费率曲线

### 5. AAM池监控 (/aam)
- LP池状态 (USDC/AF余额)
- 币价模拟
- 回购与销毁累计

### 6. 经纪人系统 (/broker)
- V1-V6等级对比
- 20层分配计算
- 推广收益模拟

## Configuration
All configuration is stored in Zustand store with localStorage persistence. Default values are defined in `shared/schema.ts`.

## Economic Model
The simulator implements the AFx economic model with:

### Fund Flow (from Trading Capital)
- 30% USDC → LP Pool
- 30% AF value → LP Pool  
- 20% → Buyback AF
- 50% → Forex Reserve

### Exit Distribution (for Released AF)
- User chooses: Withdraw vs Convert percentage
- Withdrawn AF: Secondary market / Burn / Trading fee split
- Converted AF: Becomes trading capital at configured rate

### Unit Consistency
- Buyback: USDC (converted to AF internally in pool)
- Burn: AF units
- LP contributions: USDC values
- All conversions use current AF price from AMM pool

## Recent Changes (2026-01-29)
- Fixed economic model: Fund flow now correctly based on trading capital (not fees)
- Added exit distribution tracking in simulation results and UI
- Added configurable trading simulation parameters (daily volume %, profit rate %)
- Added per-order staking period configuration
- Added staking enable/disable toggle
- Normalized units across buyback/burn/LP with explicit conversion in pool

## Running the Project
```bash
npm run dev
```
The server runs on port 5000 with Vite handling frontend HMR.
