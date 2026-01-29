import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useConfigStore } from "@/hooks/use-config";
import { runSimulation, formatNumber, formatCurrency, calculateInitialPrice } from "@/lib/calculations";
import { Droplets, TrendingUp, Flame, RefreshCw, DollarSign, Coins, Activity } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts";

export default function AAMPage() {
  const { config, stakingOrders, aamPool, resetAAMPool } = useConfigStore();

  const simulationResults = useMemo(() => {
    if (stakingOrders.length === 0) return [];
    return runSimulation(stakingOrders, config, 30, aamPool);
  }, [stakingOrders, config, aamPool]);

  const poolHistory = useMemo(() => {
    if (simulationResults.length === 0) {
      return Array.from({ length: 31 }, (_, i) => ({
        day: i,
        price: aamPool.afPrice,
        usdc: aamPool.usdcBalance,
        af: aamPool.afBalance,
      }));
    }

    return [
      { day: 0, price: aamPool.afPrice, usdc: aamPool.usdcBalance, af: aamPool.afBalance },
      ...simulationResults.map(r => ({
        day: r.day,
        price: r.afPrice,
        usdc: aamPool.usdcBalance + r.lpContributionUsdc,
        af: aamPool.afBalance - r.burnAmountAf,
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
      finalPrice: simulationResults[simulationResults.length - 1]?.afPrice || aamPool.afPrice,
    };
  }, [simulationResults, aamPool]);

  const initialPrice = calculateInitialPrice(config);
  const priceChange = totals ? ((totals.finalPrice / initialPrice) - 1) * 100 : 0;

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
          <Button variant="outline" onClick={resetAAMPool} data-testid="button-reset-pool">
            <RefreshCw className="h-4 w-4 mr-2" />
            重置池状态
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              USDC 余额
            </CardDescription>
            <CardTitle className="text-2xl">{formatCurrency(aamPool.usdcBalance)}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Coins className="h-4 w-4" />
              AF 余额
            </CardDescription>
            <CardTitle className="text-2xl">{formatNumber(aamPool.afBalance)}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              AF 当前价格
            </CardDescription>
            <CardTitle className="text-2xl">${aamPool.afPrice.toFixed(4)}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Droplets className="h-4 w-4" />
              LP 代币
            </CardDescription>
            <CardTitle className="text-2xl">{formatNumber(aamPool.lpTokens)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              累计回购
            </CardDescription>
            <CardTitle className="text-xl">{formatNumber(aamPool.totalBuyback)} AF</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Flame className="h-4 w-4" />
              累计销毁
            </CardDescription>
            <CardTitle className="text-xl">{formatNumber(aamPool.totalBurn)} AF</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {totals && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">30天模拟预测</CardTitle>
            <CardDescription>基于当前质押订单的模拟结果</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="p-3 rounded-md border">
                <p className="text-sm text-muted-foreground">预计回购</p>
                <p className="text-lg font-semibold">{formatCurrency(totals.totalBuyback)}</p>
              </div>
              <div className="p-3 rounded-md border">
                <p className="text-sm text-muted-foreground">预计销毁</p>
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
                <p className="text-sm text-muted-foreground">预计币价</p>
                <p className="text-lg font-semibold">${totals.finalPrice.toFixed(4)}</p>
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
          <CardTitle className="text-lg">30天币价走势</CardTitle>
          <CardDescription>基于当前配置的币价变化趋势</CardDescription>
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
