import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { useConfigStore } from "@/hooks/use-config";
import { calculateTradingSimulation, formatNumber, formatCurrency, formatPercent, calculateOrderTradingCapital, calculateOrderDailyVolume, calculateOrderDailyForexProfit } from "@/lib/calculations";
import { Calculator, TrendingUp, Users, Building, Coins, ArrowRight, Package, RefreshCw } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";

export default function TradingPage() {
  const { config, stakingOrders, aamPool, clearStakingOrders, resetAAMPool } = useConfigStore();
  const [simulationDays, setSimulationDays] = useState(30);

  const orderSimulations = useMemo(() => {
    return stakingOrders.map(order => {
      const packageConfig = config.packageConfigs.find(p => p.tier === order.packageTier);
      if (!packageConfig) return null;

      const dynamicTradingCapital = calculateOrderTradingCapital(order, config);
      const dailyTradingVolume = calculateOrderDailyVolume(order, config);
      const forexDetail = calculateOrderDailyForexProfit(order, config);

      const simulation = calculateTradingSimulation(
        dailyTradingVolume,
        packageConfig.tradingProfitRate / 100,
        packageConfig.tradingFeeRate,
        packageConfig.profitSharePercent,
        config
      );

      return {
        orderId: order.id,
        packageTier: order.packageTier,
        stakingAmount: order.amount,
        tradingCapital: dynamicTradingCapital,
        dailyVolume: dailyTradingVolume,
        feeRate: packageConfig.tradingFeeRate,
        profitRate: packageConfig.tradingProfitRate,
        profitSharePercent: packageConfig.profitSharePercent,
        grossProfit: forexDetail.grossProfit,
        netProfit: forexDetail.netProfit,
        ...simulation,
      };
    }).filter(Boolean);
  }, [stakingOrders, config]);

  const totals = useMemo(() => {
    if (orderSimulations.length === 0) return null;

    const dailyTotals = orderSimulations.reduce((acc, sim) => ({
      tradingCapital: acc.tradingCapital + (sim?.tradingCapital || 0),
      dailyVolume: acc.dailyVolume + (sim?.dailyVolume || 0),
      grossProfit: acc.grossProfit + (sim?.grossProfit || 0),
      tradingFee: acc.tradingFee + (sim?.tradingFee || 0),
      netProfit: acc.netProfit + (sim?.netProfit || 0),
      userProfit: acc.userProfit + (sim?.userProfit || 0),
      platformProfit: acc.platformProfit + (sim?.platformProfit || 0),
      brokerProfit: acc.brokerProfit + (sim?.brokerProfit || 0),
      lpContribution: acc.lpContribution + (sim?.lpContribution || 0),
      reserveAmount: acc.reserveAmount + (sim?.reserveAmount || 0),
    }), {
      tradingCapital: 0,
      dailyVolume: 0,
      grossProfit: 0,
      tradingFee: 0,
      netProfit: 0,
      userProfit: 0,
      platformProfit: 0,
      brokerProfit: 0,
      lpContribution: 0,
      reserveAmount: 0,
    });

    return {
      daily: dailyTotals,
      period: {
        tradingCapital: dailyTotals.tradingCapital,
        totalVolume: dailyTotals.dailyVolume * simulationDays,
        grossProfit: dailyTotals.grossProfit * simulationDays,
        tradingFee: dailyTotals.tradingFee * simulationDays,
        netProfit: dailyTotals.netProfit * simulationDays,
        userProfit: dailyTotals.userProfit * simulationDays,
        platformProfit: dailyTotals.platformProfit * simulationDays,
        brokerProfit: dailyTotals.brokerProfit * simulationDays,
        lpContribution: dailyTotals.lpContribution * simulationDays,
        reserveAmount: dailyTotals.reserveAmount * simulationDays,
      },
    };
  }, [orderSimulations, simulationDays]);

  const profitDistribution = totals ? [
    { name: "用户收益", value: totals.period.userProfit, color: "hsl(var(--chart-2))" },
    { name: "平台收益", value: totals.period.platformProfit, color: "hsl(var(--chart-1))" },
    { name: "经纪人收益", value: totals.period.brokerProfit, color: "hsl(var(--chart-4))" },
  ] : [];

  const fundFlow = totals ? [
    { name: "LP 池 (USDC+AF)", value: totals.period.lpContribution, color: "hsl(var(--chart-1))" },
    { name: "外汇储备金", value: totals.period.reserveAmount, color: "hsl(var(--chart-3))" },
  ] : [];

  const packageFeeData = config.packageConfigs.map(pkg => ({
    tier: `${pkg.tier}`,
    feeRate: pkg.tradingFeeRate,
    profitRate: pkg.tradingProfitRate,
    profitShare: pkg.profitSharePercent,
  }));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">交易模拟</h1>
          <p className="text-muted-foreground">基于所有质押订单的交易收益模拟</p>
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
            data-testid="button-reset-trading"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            重置
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
                min={1}
                max={365}
                step={1}
                data-testid="slider-sim-days"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              {[7, 30, 60, 90, 180].map(days => (
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
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>总交易本金</CardDescription>
                  <CardTitle className="text-2xl">{formatCurrency(totals.daily.tradingCapital)}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    日交易量: {formatCurrency(totals.daily.dailyVolume)}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    {simulationDays}天用户收益
                  </CardDescription>
                  <CardTitle className="text-2xl text-green-500">{formatCurrency(totals.period.userProfit)}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    日均: {formatCurrency(totals.daily.userProfit)}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2">
                    <Building className="h-4 w-4" />
                    {simulationDays}天平台收益
                  </CardDescription>
                  <CardTitle className="text-2xl">{formatCurrency(totals.period.platformProfit)}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    日均: {formatCurrency(totals.daily.platformProfit)}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    {simulationDays}天经纪人收益
                  </CardDescription>
                  <CardTitle className="text-2xl">{formatCurrency(totals.period.brokerProfit)}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    日均: {formatCurrency(totals.daily.brokerProfit)}
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Package className="h-5 w-5" />
                各订单交易详情
              </CardTitle>
              <CardDescription>每笔订单的交易参数和收益</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {orderSimulations.map((sim) => sim && (
                  <div key={sim.orderId} className="p-4 rounded-md border space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="default">
                          {sim.packageTier} USDC
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          订单 #{sim.orderId.slice(-6)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">手续费 {sim.feeRate}%</Badge>
                        <Badge variant="outline">利润率 {sim.profitRate}%</Badge>
                        <Badge variant="outline">分润 {sim.profitSharePercent}%</Badge>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-2 border-t">
                      <div>
                        <p className="text-xs text-muted-foreground">质押金额</p>
                        <p className="text-sm font-medium">{formatCurrency(sim.stakingAmount)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">交易本金</p>
                        <p className="text-sm font-medium">{formatCurrency(sim.tradingCapital)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">日交易量</p>
                        <p className="text-sm font-medium">{formatCurrency(sim.dailyVolume)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">日用户收益</p>
                        <p className="text-sm font-medium text-green-500">{formatCurrency(sim.userProfit)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">{simulationDays}天收益</p>
                        <p className="text-sm font-medium text-green-500">{formatCurrency(sim.userProfit * simulationDays)}</p>
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
                <CardTitle className="text-lg">资金流详情</CardTitle>
                <CardDescription>{simulationDays}天交易周期的资金拆分明细（交易不触发回购）</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center gap-4 p-4 rounded-md bg-muted flex-wrap">
                    <div className="text-center">
                      <p className="text-2xl font-bold">{formatCurrency(totals.period.totalVolume)}</p>
                      <p className="text-xs text-muted-foreground">总交易量</p>
                    </div>
                    <ArrowRight className="h-6 w-6 text-muted-foreground" />
                    <div className="text-center">
                      <p className="text-2xl font-bold text-blue-500">+{formatCurrency(totals.period.grossProfit)}</p>
                      <p className="text-xs text-muted-foreground">毛利润</p>
                    </div>
                    <ArrowRight className="h-6 w-6 text-muted-foreground" />
                    <div className="text-center">
                      <p className="text-2xl font-bold text-red-500">-{formatCurrency(totals.period.tradingFee)}</p>
                      <p className="text-xs text-muted-foreground">手续费</p>
                    </div>
                    <ArrowRight className="h-6 w-6 text-muted-foreground" />
                    <div className="text-center">
                      <p className="text-2xl font-bold text-green-500">{formatCurrency(totals.period.netProfit)}</p>
                      <p className="text-xs text-muted-foreground">净利润</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="p-3 rounded-md border">
                      <p className="text-sm text-muted-foreground">LP 池 (USDC)</p>
                      <p className="text-lg font-semibold">{formatCurrency(totals.period.totalVolume * config.lpPoolUsdcRatio / 100)}</p>
                      <p className="text-xs text-muted-foreground">{config.lpPoolUsdcRatio}% 交易金</p>
                    </div>
                    <div className="p-3 rounded-md border">
                      <p className="text-sm text-muted-foreground">LP 池 (AF)</p>
                      <p className="text-lg font-semibold">{formatCurrency(totals.period.totalVolume * config.lpPoolAfRatio / 100)}</p>
                      <p className="text-xs text-muted-foreground">{config.lpPoolAfRatio}% 交易金</p>
                    </div>
                    <div className="p-3 rounded-md border">
                      <p className="text-sm text-muted-foreground">外汇储备金</p>
                      <p className="text-lg font-semibold">{formatCurrency(totals.period.reserveAmount)}</p>
                      <p className="text-xs text-muted-foreground">{config.reserveRatio}% 交易金</p>
                    </div>
                    <div className="p-3 rounded-md border">
                      <p className="text-sm text-muted-foreground">手续费总计</p>
                      <p className="text-lg font-semibold">{formatCurrency(totals.period.tradingFee)}</p>
                      <p className="text-xs text-muted-foreground">毛利润扣除</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">利润分配</CardTitle>
                <CardDescription>{simulationDays}天扣除手续费后的利润分配</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={profitDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={2}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {profitDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          borderColor: 'hsl(var(--border))',
                          borderRadius: '6px',
                        }}
                        formatter={(value: number) => formatCurrency(value)}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">资金流向</CardTitle>
                <CardDescription>交易资金的分配（不含回购）</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={fundFlow}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={2}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {fundFlow.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          borderColor: 'hsl(var(--border))',
                          borderRadius: '6px',
                        }}
                        formatter={(value: number) => formatCurrency(value)}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">各配套交易参数</CardTitle>
              <CardDescription>不同配套档位的手续费率和利润率</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={packageFeeData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis
                      dataKey="tier"
                      tick={{ fontSize: 12 }}
                      tickFormatter={(v) => `$${v}`}
                      className="text-muted-foreground"
                    />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      tickFormatter={(v) => `${v}%`}
                      domain={[0, 15]}
                      className="text-muted-foreground"
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        borderColor: 'hsl(var(--border))',
                        borderRadius: '6px',
                      }}
                      formatter={(value: number, name: string) => [
                        `${value.toFixed(1)}%`,
                        name === 'feeRate' ? '手续费率' : name === 'profitRate' ? '利润率' : '分润比例'
                      ]}
                      labelFormatter={(label) => `配套 $${label}`}
                    />
                    <Legend formatter={(value) => value === 'feeRate' ? '手续费率' : value === 'profitRate' ? '利润率' : '分润比例'} />
                    <Bar dataKey="feeRate" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="profitRate" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
