import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { useConfigStore } from "@/hooks/use-config";
import { runSimulation, formatNumber, formatCurrency, calculateOrderReleaseProgress } from "@/lib/calculations";
import { TrendingUp, Coins, Flame, DollarSign, RefreshCw, Package, Clock, CheckCircle } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from "recharts";

export default function ReleasePage() {
  const { config, stakingOrders, aamPool, clearStakingOrders, resetAAMPool } = useConfigStore();
  const [simulationDays, setSimulationDays] = useState(30);

  const simulationResults = useMemo(() => {
    if (stakingOrders.length === 0) return [];
    return runSimulation(stakingOrders, config, simulationDays, aamPool);
  }, [stakingOrders, config, simulationDays, aamPool]);

  const totals = useMemo(() => {
    if (simulationResults.length === 0) return null;
    return {
      totalAfReleased: simulationResults.reduce((sum, r) => sum + r.afReleased, 0),
      totalUserProfit: simulationResults.reduce((sum, r) => sum + r.userProfit, 0),
      totalBurn: simulationResults.reduce((sum, r) => sum + r.burnAmountAf, 0),
      avgPrice: simulationResults.reduce((sum, r) => sum + r.afPrice, 0) / simulationResults.length,
      finalPrice: simulationResults[simulationResults.length - 1]?.afPrice || 0,
      totalToSecondaryMarket: simulationResults.reduce((sum, r) => sum + r.toSecondaryMarketAf, 0),
      totalToTradingFee: simulationResults.reduce((sum, r) => sum + r.toTradingFeeAf, 0),
      totalToTradingCapital: simulationResults.reduce((sum, r) => sum + r.toTradingCapitalUsdc, 0),
      totalLpUsdc: simulationResults.reduce((sum, r) => sum + r.lpContributionUsdc, 0),
      totalLpAfValue: simulationResults.reduce((sum, r) => sum + r.lpContributionAfValue, 0),
      totalBuyback: simulationResults.reduce((sum, r) => sum + r.buybackAmountUsdc, 0),
      totalReserve: simulationResults.reduce((sum, r) => sum + r.reserveAmountUsdc, 0),
    };
  }, [simulationResults]);

  const chartData = simulationResults.map(r => ({
    day: `Day ${r.day}`,
    afReleased: parseFloat(r.afReleased.toFixed(2)),
    afPrice: parseFloat(r.afPrice.toFixed(4)),
    userProfit: parseFloat(r.userProfit.toFixed(2)),
    burn: parseFloat(r.burnAmountAf.toFixed(2)),
  }));

  // Calculate per-order release progress for current simulation day
  const orderProgress = useMemo(() => {
    if (stakingOrders.length === 0) return [];
    const currentAfPrice = simulationResults.length > 0 
      ? simulationResults[simulationResults.length - 1].afPrice 
      : aamPool.afPrice;
    return calculateOrderReleaseProgress(stakingOrders, config, simulationDays, currentAfPrice);
  }, [stakingOrders, config, simulationDays, simulationResults, aamPool.afPrice]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">释放进度</h1>
          <p className="text-muted-foreground">查看第 N 天 AF 释放情况</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={stakingOrders.length > 0 ? "default" : "secondary"}>
            {stakingOrders.length} 笔质押订单
          </Badge>
          <Button 
            variant="outline" 
            onClick={() => {
              clearStakingOrders();
              resetAAMPool();
            }}
            disabled={stakingOrders.length === 0}
            data-testid="button-reset-simulation"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            重置模拟
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">模拟设置</CardTitle>
          <CardDescription>设置模拟周期</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-6">
            <div className="flex-1 space-y-2">
              <Label>模拟天数: {simulationDays} 天</Label>
              <Slider
                value={[simulationDays]}
                onValueChange={([value]) => setSimulationDays(value)}
                min={7}
                max={365}
                step={1}
                data-testid="slider-sim-days"
              />
            </div>
            <div className="flex gap-2">
              {[30, 60, 90, 180, 365].map(days => (
                <Button
                  key={days}
                  variant={simulationDays === days ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSimulationDays(days)}
                >
                  {days}天
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {stakingOrders.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <Coins className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>暂无质押订单</p>
              <p className="text-sm">请先在质押模拟页面添加订单</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {totals && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2">
                    <Coins className="h-4 w-4" />
                    累计释放 AF
                  </CardDescription>
                  <CardTitle className="text-2xl">{formatNumber(totals.totalAfReleased)}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    日均 {formatNumber(totals.totalAfReleased / simulationDays)} AF
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    累计用户收益
                  </CardDescription>
                  <CardTitle className="text-2xl">{formatCurrency(totals.totalUserProfit)}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    日均 {formatCurrency(totals.totalUserProfit / simulationDays)}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2">
                    <Flame className="h-4 w-4" />
                    累计销毁
                  </CardDescription>
                  <CardTitle className="text-2xl">{formatNumber(totals.totalBurn)} AF</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    销毁率 {totals.totalAfReleased > 0 ? ((totals.totalBurn / totals.totalAfReleased) * 100).toFixed(1) : 0}%
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    AF 币价变化
                  </CardDescription>
                  <CardTitle className="text-2xl">${totals.finalPrice.toFixed(4)}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    初始 ${aamPool.afPrice.toFixed(4)}
                    <span className={totals.finalPrice >= aamPool.afPrice ? " text-green-500" : " text-red-500"}>
                      {" "}({((totals.finalPrice / aamPool.afPrice - 1) * 100).toFixed(2)}%)
                    </span>
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Per-Order Release Progress */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Package className="h-5 w-5" />
                各订单释放进度
              </CardTitle>
              <CardDescription>查看第 {simulationDays} 天每个订单的释放情况</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {orderProgress.map((progress) => (
                  <div key={progress.orderId} className="p-4 rounded-md border space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <Badge variant={progress.isComplete ? "default" : "secondary"}>
                          {progress.packageTier} USDC
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          订单 #{progress.orderId.slice(-6)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {progress.isComplete ? (
                          <Badge variant="default" className="bg-green-500">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            已完成
                          </Badge>
                        ) : (
                          <Badge variant="outline">
                            <Clock className="h-3 w-3 mr-1" />
                            剩余 {progress.daysRemaining} 天
                          </Badge>
                        )}
                      </div>
                    </div>
                    
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>释放进度</span>
                        <span className="font-medium">{progress.progressPercent.toFixed(1)}%</span>
                      </div>
                      <Progress value={progress.progressPercent} className="h-2" />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>第 {progress.currentDay} 天 / 共 {progress.totalDays} 天</span>
                        <span>质押金额: {formatCurrency(progress.amount)}</span>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t">
                      <div>
                        <p className="text-xs text-muted-foreground">日释放 AF</p>
                        <p className="text-sm font-medium">{formatNumber(progress.dailyAfRelease)} AF</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">累计释放 AF</p>
                        <p className="text-sm font-medium">{formatNumber(progress.totalAfReleased)} AF</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">AF 价值</p>
                        <p className="text-sm font-medium">{formatCurrency(progress.totalAfValue)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">交易本金</p>
                        <p className="text-sm font-medium">{formatCurrency(progress.tradingCapital)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {totals && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">AF 退出分配详情</CardTitle>
                <CardDescription>用户选择提现/保留/转换后的 AF 流向 (各配套独立设置)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-3 rounded-md border">
                    <p className="text-sm text-muted-foreground">卖入 LP 池</p>
                    <p className="text-lg font-semibold">{formatNumber(totals.totalToSecondaryMarket)} AF</p>
                    <p className="text-xs text-muted-foreground">提现后卖入池子（价格下降）</p>
                  </div>
                  <div className="p-3 rounded-md border">
                    <p className="text-sm text-muted-foreground">销毁 AF</p>
                    <p className="text-lg font-semibold">{formatNumber(totals.totalBurn)} AF</p>
                    <p className="text-xs text-muted-foreground">{config.afExitBurnRatio}% 提现销毁比例</p>
                  </div>
                  <div className="p-3 rounded-md border">
                    <p className="text-sm text-muted-foreground">保留为手续费</p>
                    <p className="text-lg font-semibold">{formatNumber(totals.totalToTradingFee)} AF</p>
                    <p className="text-xs text-muted-foreground">保留在平台</p>
                  </div>
                  <div className="p-3 rounded-md border">
                    <p className="text-sm text-muted-foreground">转换交易金</p>
                    <p className="text-lg font-semibold">{formatCurrency(totals.totalToTradingCapital)}</p>
                    <p className="text-xs text-muted-foreground">{config.afToTradingCapitalRate}x 倍率</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {totals && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">交易资金流向汇总</CardTitle>
                <CardDescription>基于交易本金的资金拆分（交易不触发回购）</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-3 rounded-md border">
                    <p className="text-sm text-muted-foreground">LP 池 (USDC)</p>
                    <p className="text-lg font-semibold">{formatCurrency(totals.totalLpUsdc)}</p>
                    <p className="text-xs text-muted-foreground">{config.lpPoolUsdcRatio}% 交易金</p>
                  </div>
                  <div className="p-3 rounded-md border">
                    <p className="text-sm text-muted-foreground">LP 池 (AF价值)</p>
                    <p className="text-lg font-semibold">{formatCurrency(totals.totalLpAfValue)}</p>
                    <p className="text-xs text-muted-foreground">{config.lpPoolAfRatio}% 交易金</p>
                  </div>
                  <div className="p-3 rounded-md border">
                    <p className="text-sm text-muted-foreground">外汇储备金</p>
                    <p className="text-lg font-semibold">{formatCurrency(totals.totalReserve)}</p>
                    <p className="text-xs text-muted-foreground">{config.reserveRatio}% 交易金</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">AF 释放趋势</CardTitle>
                <CardDescription>每日 AF 释放数量</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="day" tick={{ fontSize: 12 }} className="text-muted-foreground" />
                      <YAxis tick={{ fontSize: 12 }} className="text-muted-foreground" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          borderColor: 'hsl(var(--border))',
                          borderRadius: '6px',
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="afReleased"
                        name="AF 释放"
                        stroke="hsl(var(--primary))"
                        fill="hsl(var(--primary) / 0.2)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">AF 币价变化</CardTitle>
                <CardDescription>模拟期间币价走势</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="day" tick={{ fontSize: 12 }} className="text-muted-foreground" />
                      <YAxis tick={{ fontSize: 12 }} domain={['auto', 'auto']} className="text-muted-foreground" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          borderColor: 'hsl(var(--border))',
                          borderRadius: '6px',
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="afPrice"
                        name="AF 价格"
                        stroke="hsl(var(--chart-2))"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">收益与销毁对比</CardTitle>
              <CardDescription>用户收益与 AF 销毁趋势</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="day" tick={{ fontSize: 12 }} className="text-muted-foreground" />
                    <YAxis tick={{ fontSize: 12 }} className="text-muted-foreground" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        borderColor: 'hsl(var(--border))',
                        borderRadius: '6px',
                      }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="userProfit"
                      name="用户收益"
                      stroke="hsl(var(--chart-2))"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="burn"
                      name="AF 销毁"
                      stroke="hsl(var(--chart-5))"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {simulationResults.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">每日详情</CardTitle>
                <CardDescription>最近 10 天数据</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {simulationResults.slice(-10).map((result) => (
                    <div key={result.day} className="p-3 rounded-md border bg-card space-y-1">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="text-xs">Day {result.day}</Badge>
                      </div>
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">释放</span>
                          <span>{formatNumber(result.afReleased)} AF</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">币价</span>
                          <span>${result.afPrice.toFixed(4)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">收益</span>
                          <span className="text-green-500">{formatCurrency(result.userProfit)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
