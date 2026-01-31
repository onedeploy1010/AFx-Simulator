import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useConfigStore } from "@/hooks/use-config";
import { runSimulation, formatNumber, formatCurrency, calculateInitialPrice } from "@/lib/calculations";
import { Droplets, TrendingUp, Flame, RefreshCw, DollarSign, Coins, Activity } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts";

export default function AAMPage() {
  const { config, stakingOrders, aamPool, resetAAMPool, currentSimulationDay } = useConfigStore();

  // Use max of currentSimulationDay and order-based duration for full projection
  const simDays = useMemo(() => {
    let maxDays = currentSimulationDay;
    for (const order of stakingOrders) {
      const orderMode = order.mode || 'package';
      const startDay = order.startDay || 0;
      if (orderMode === 'days') {
        maxDays = Math.max(maxDays, startDay + (order.durationDays || 30));
      } else {
        maxDays = Math.max(maxDays, startDay + (order.daysStaked || 30));
      }
    }
    return Math.max(1, maxDays);
  }, [stakingOrders, currentSimulationDay]);

  const simulationResults = useMemo(() => {
    if (stakingOrders.length === 0) return [];
    return runSimulation(stakingOrders, config, simDays, aamPool);
  }, [stakingOrders, config, simDays, aamPool]);

  // Derive final pool state from simulation (same treatment as CLMM)
  const lastDay = simulationResults.length > 0 ? simulationResults[simulationResults.length - 1] : null;
  const finalUsdc = lastDay ? lastDay.poolUsdcBalance : aamPool.usdcBalance;
  const finalAf = lastDay ? lastDay.poolAfBalance : aamPool.afBalance;
  const finalPrice = lastDay ? lastDay.afPrice : aamPool.afPrice;
  const finalTvl = lastDay ? lastDay.poolTotalValue : (aamPool.usdcBalance + aamPool.afBalance * aamPool.afPrice);

  const poolHistory = useMemo(() => {
    if (simulationResults.length === 0) {
      const tvl = aamPool.usdcBalance + aamPool.afBalance * aamPool.afPrice;
      return Array.from({ length: 31 }, (_, i) => ({
        day: i,
        price: aamPool.afPrice,
        usdc: aamPool.usdcBalance,
        af: aamPool.afBalance,
        tvl,
      }));
    }

    const initialTvl = aamPool.usdcBalance + aamPool.afBalance * aamPool.afPrice;
    return [
      { day: 0, price: aamPool.afPrice, usdc: aamPool.usdcBalance, af: aamPool.afBalance, tvl: initialTvl },
      ...simulationResults.map(r => ({
        day: r.day,
        price: r.afPrice,
        usdc: r.poolUsdcBalance,
        af: r.poolAfBalance,
        tvl: r.poolTotalValue,
      }))
    ];
  }, [simulationResults, aamPool]);

  const totals = useMemo(() => {
    if (simulationResults.length === 0) return null;
    return {
      totalBuyback: simulationResults.reduce((sum, r) => sum + r.buybackAmountUsdc, 0),
      totalBurn: simulationResults.reduce((sum, r) => sum + r.burnAmountAf, 0),
      totalLpUsdc: simulationResults.reduce((sum, r) => sum + r.lpContributionUsdc, 0),
      totalLpAf: simulationResults.reduce((sum, r) => sum + r.lpContributionAfValue, 0),
      totalSellPressure: simulationResults.reduce((sum, r) => sum + r.afSellingRevenueUsdc, 0),
      avgDailySell: simulationResults.reduce((sum, r) => sum + r.afSellingRevenueUsdc, 0) / simulationResults.length,
      avgDailyBuy: simulationResults.reduce((sum, r) => sum + r.buybackAmountUsdc, 0) / simulationResults.length,
    };
  }, [simulationResults]);

  const initialPrice = calculateInitialPrice(config);
  const priceChange = lastDay ? ((finalPrice / initialPrice) - 1) * 100 : 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">AAM 池监控</h1>
          <p className="text-muted-foreground">LP 池规模、AF 币价变化与回购销毁</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={stakingOrders.length > 0 ? "default" : "secondary"}>
            {stakingOrders.length} 笔订单
          </Badge>
          <Badge variant="outline">Day {simDays}</Badge>
          <Button variant="outline" onClick={resetAAMPool} data-testid="button-reset-pool">
            <RefreshCw className="h-4 w-4 mr-2" />
            重置池状态
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              USDC 余额
            </CardDescription>
            <CardTitle className="text-2xl">{formatCurrency(finalUsdc)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              初始: {formatCurrency(aamPool.usdcBalance)} → 占比 {finalTvl > 0 ? ((finalUsdc / finalTvl) * 100).toFixed(1) : 50}%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Coins className="h-4 w-4" />
              AF 余额
            </CardDescription>
            <CardTitle className="text-2xl">{formatNumber(finalAf)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              初始: {formatNumber(aamPool.afBalance)} → 价值 {formatCurrency(finalAf * finalPrice)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              AF 价格
            </CardDescription>
            <CardTitle className="text-2xl">${finalPrice.toFixed(6)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              初始: ${initialPrice.toFixed(6)}
              {lastDay && (
                <Badge variant={priceChange >= 0 ? "default" : "destructive"} className="ml-2">
                  {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
                </Badge>
              )}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Droplets className="h-4 w-4" />
              池总价值 (TVL)
            </CardDescription>
            <CardTitle className="text-2xl">{formatCurrency(finalTvl)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              初始: {formatCurrency(aamPool.usdcBalance + aamPool.afBalance * aamPool.afPrice)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              USDC / AF 比例
            </CardDescription>
            <CardTitle className="text-2xl">1 : {finalAf > 0 && finalUsdc > 0 ? formatNumber(finalAf / finalUsdc, 0) : '0'}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              初始: 1 : {aamPool.afBalance > 0 && aamPool.usdcBalance > 0 ? formatNumber(aamPool.afBalance / aamPool.usdcBalance, 0) : '0'}
            </p>
          </CardContent>
        </Card>
      </div>

      {totals && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-red-500/30">
            <CardHeader className="pb-2">
              <CardDescription className="text-red-400">日均卖盘 (USDC)</CardDescription>
              <CardTitle className="text-xl text-red-400">{formatCurrency(totals.avgDailySell)}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">累计: {formatCurrency(totals.totalSellPressure)}</p>
            </CardContent>
          </Card>
          <Card className="border-green-500/30">
            <CardHeader className="pb-2">
              <CardDescription className="text-green-400">日均买盘 (USDC)</CardDescription>
              <CardTitle className="text-xl text-green-400">{formatCurrency(totals.avgDailyBuy)}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">累计: {formatCurrency(totals.totalBuyback)}</p>
            </CardContent>
          </Card>
          <Card className={totals.avgDailyBuy - totals.avgDailySell >= 0 ? "border-blue-500/30" : "border-red-500/30"}>
            <CardHeader className="pb-2">
              <CardDescription>净流向 (USDC)</CardDescription>
              <CardTitle className={`text-xl ${totals.avgDailyBuy - totals.avgDailySell >= 0 ? 'text-blue-400' : 'text-red-400'}`}>
                {totals.avgDailyBuy - totals.avgDailySell >= 0 ? '+' : ''}{formatCurrency(totals.avgDailyBuy - totals.avgDailySell)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                {totals.avgDailyBuy - totals.avgDailySell >= 0 ? '买盘 > 卖盘 → 价格上升' : '卖盘 > 买盘 → 价格下降'}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Flame className="h-4 w-4" />
                累计销毁
              </CardDescription>
              <CardTitle className="text-xl">{formatNumber(totals.totalBurn)} AF</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">价值 {formatCurrency(totals.totalBurn * finalPrice)}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {totals && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{simDays}天模拟预测</CardTitle>
            <CardDescription>基于当前质押订单的全周期模拟结果</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="p-3 rounded-md border">
                <p className="text-sm text-muted-foreground">累计回购</p>
                <p className="text-lg font-semibold">{formatCurrency(totals.totalBuyback)}</p>
              </div>
              <div className="p-3 rounded-md border">
                <p className="text-sm text-muted-foreground">累计销毁</p>
                <p className="text-lg font-semibold">{formatNumber(totals.totalBurn)} AF</p>
              </div>
              <div className="p-3 rounded-md border">
                <p className="text-sm text-muted-foreground">LP 注入 USDC</p>
                <p className="text-lg font-semibold">{formatCurrency(totals.totalLpUsdc)}</p>
              </div>
              <div className="p-3 rounded-md border">
                <p className="text-sm text-muted-foreground">LP 注入 AF 价值</p>
                <p className="text-lg font-semibold">{formatCurrency(totals.totalLpAf)}</p>
              </div>
              <div className="p-3 rounded-md border">
                <p className="text-sm text-muted-foreground">最终币价</p>
                <p className="text-lg font-semibold">${finalPrice.toFixed(4)}</p>
                <Badge variant={priceChange >= 0 ? "default" : "destructive"} className="mt-1">
                  {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {stakingOrders.length === 0 && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>暂无质押订单</p>
              <p className="text-sm">添加质押订单后，这里将显示模拟预测</p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{simDays}天币价走势</CardTitle>
          <CardDescription>基于当前配置的币价变化趋势（模拟最终状态）</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={poolHistory}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 12 }}
                  tickFormatter={(v) => `Day ${v}`}
                  className="text-muted-foreground"
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  domain={['auto', 'auto']}
                  tickFormatter={(v) => `$${v.toFixed(3)}`}
                  className="text-muted-foreground"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    borderColor: 'hsl(var(--border))',
                    borderRadius: '6px',
                  }}
                  formatter={(value: number) => [`$${value.toFixed(4)}`, 'AF 价格']}
                  labelFormatter={(label) => `Day ${label}`}
                />
                <Area
                  type="monotone"
                  dataKey="price"
                  stroke="hsl(var(--primary))"
                  fill="hsl(var(--primary) / 0.2)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{simDays}天池总价值 (TVL)</CardTitle>
          <CardDescription>USDC + AF价值 的变化趋势</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={poolHistory}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} tickFormatter={(v) => `Day ${v}`} className="text-muted-foreground" />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} className="text-muted-foreground" />
                <Tooltip
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '6px' }}
                  formatter={(value: number) => [formatCurrency(value), 'TVL']}
                  labelFormatter={(label) => `Day ${label}`}
                />
                <Area type="monotone" dataKey="tvl" stroke="hsl(var(--chart-3))" fill="hsl(var(--chart-3) / 0.2)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">USDC 余额变化</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={poolHistory}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="day" tick={{ fontSize: 12 }} className="text-muted-foreground" />
                  <YAxis tick={{ fontSize: 12 }} className="text-muted-foreground" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      borderColor: 'hsl(var(--border))',
                      borderRadius: '6px',
                    }}
                    formatter={(value: number) => [formatCurrency(value), 'USDC']}
                  />
                  <Line
                    type="monotone"
                    dataKey="usdc"
                    stroke="hsl(var(--chart-2))"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">AF 余额变化</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={poolHistory}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="day" tick={{ fontSize: 12 }} className="text-muted-foreground" />
                  <YAxis tick={{ fontSize: 12 }} className="text-muted-foreground" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      borderColor: 'hsl(var(--border))',
                      borderRadius: '6px',
                    }}
                    formatter={(value: number) => [formatNumber(value), 'AF']}
                  />
                  <Line
                    type="monotone"
                    dataKey="af"
                    stroke="hsl(var(--chart-4))"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
