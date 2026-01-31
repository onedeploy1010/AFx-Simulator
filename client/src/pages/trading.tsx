import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { useConfigStore } from "@/hooks/use-config";
import { calculateTradingSimulation, calculateDividendPoolProfit, formatNumber, formatCurrency, formatPercent, calculateOrderTradingCapital, calculateOrderDailyVolume, calculateOrderDailyForexProfit, runSimulationWithDetails } from "@/lib/calculations";
import { Calculator, TrendingUp, Users, Building, Coins, ArrowRight, Package, RefreshCw, FileText } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import DailyDetailsDialog from "@/components/daily-details-dialog";

export default function TradingPage() {
  const { config, stakingOrders, aamPool, clearStakingOrders, resetAAMPool } = useConfigStore();
  const [simulationDays, setSimulationDays] = useState(30);
  const [selectedOrderForDetail, setSelectedOrderForDetail] = useState<string | null>(null);

  const orderDailyDetails = useMemo(() => {
    if (stakingOrders.length === 0) return new Map<string, import("@shared/schema").OrderDailyDetail[]>();
    const result = runSimulationWithDetails(stakingOrders, config, simulationDays, aamPool);
    return result.orderDailyDetails;
  }, [stakingOrders, config, simulationDays, aamPool]);

  const orderSimulations = useMemo(() => {
    return stakingOrders.map(order => {
      const orderMode = order.mode || 'package';

      if (orderMode === 'days') {
        const daysConfig = config.daysConfigs?.find(d => d.days === order.durationDays);
        if (!daysConfig) return null;

        // Derive trading capital from simulation results (stored order.afKeptInSystem is always 0)
        const details = orderDailyDetails.get(order.id);
        const lastDetail = details && details.length > 0 ? details[details.length - 1] : null;
        const tradingCapital = lastDetail ? lastDetail.tradingCapital : 0;

        const dailyVolume = tradingCapital * (config.dailyTradingVolumePercent / 100);
        const grossProfit = dailyVolume * (daysConfig.tradingProfitRate / 100);

        const simulation = calculateTradingSimulation(
          dailyVolume,
          daysConfig.tradingProfitRate / 100,
          daysConfig.tradingFeeRate,
          daysConfig.profitSharePercent,
          config
        );

        return {
          orderId: order.id,
          packageTier: order.packageTier,
          mode: 'days' as const,
          durationDays: order.durationDays,
          stakingAmount: order.amount,
          tradingCapital,
          dailyVolume,
          feeRate: daysConfig.tradingFeeRate,
          profitRate: daysConfig.tradingProfitRate,
          profitSharePercent: daysConfig.profitSharePercent,
          grossProfit,
          netProfit: grossProfit - simulation.tradingFee,
          ...simulation,
        };
      }

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
        mode: 'package' as const,
        durationDays: undefined as number | undefined,
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
  }, [stakingOrders, config, aamPool.afPrice, orderDailyDetails]);

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

  const packageFeeData = config.simulationMode === 'days'
    ? (config.daysConfigs || []).map(dc => ({
        tier: `${dc.days}天`,
        feeRate: dc.tradingFeeRate,
        profitRate: dc.tradingProfitRate,
        profitShare: dc.profitSharePercent,
      }))
    : config.packageConfigs.map(pkg => ({
        tier: `${pkg.tier}`,
        feeRate: pkg.tradingFeeRate,
        profitRate: pkg.tradingProfitRate,
        profitShare: pkg.profitSharePercent,
      }));


  return (
    <div className="p-3 md:p-6 space-y-4 md:space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">交易模拟</h1>
          <p className="text-muted-foreground">基于所有铸造订单的交易收益模拟</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={stakingOrders.length > 0 ? "default" : "secondary"}>
            {stakingOrders.length} 笔铸造订单
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
          <div className="space-y-4 md:space-y-0 md:flex md:items-end md:gap-6">
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

      {/* Dividend Pool Overview (shown when trading mode is dividend_pool) */}
      {(config.tradingMode ?? 'individual') === 'dividend_pool' && stakingOrders.length > 0 && (() => {
        const totalDeposit = stakingOrders.reduce((sum, o) => sum + o.amount, 0);
        const poolCapital = totalDeposit * (config.depositTradingPoolRatio / 100);
        const dailyPoolProfit = poolCapital * (config.poolDailyProfitRate / 100);

        // Get per-order unclaimed AF from simulation details
        const lastDetails = new Map<string, number>();
        let totalUnclaimedAf = 0;
        for (const order of stakingOrders) {
          const details = orderDailyDetails.get(order.id);
          const lastDetail = details && details.length > 0 ? details[details.length - 1] : null;
          const unclaimed = lastDetail ? lastDetail.afInSystem : 0;
          lastDetails.set(order.id, unclaimed);
          totalUnclaimedAf += unclaimed;
        }

        return (
          <Card className="border-purple-500/30 bg-purple-500/5">
            <CardHeader>
              <CardTitle className="text-lg">交易分红池总览</CardTitle>
              <CardDescription>全网入金进入量化交易池，按AF持有权重分润</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                <div className="p-2.5 md:p-3 rounded-md border">
                  <p className="text-xs md:text-sm text-muted-foreground">全网总入金</p>
                  <p className="text-base md:text-lg font-semibold">{formatCurrency(totalDeposit)}</p>
                </div>
                <div className="p-2.5 md:p-3 rounded-md border">
                  <p className="text-xs md:text-sm text-muted-foreground">
                    <span className="md:hidden">交易池 ({config.depositTradingPoolRatio}%)</span>
                    <span className="hidden md:inline">交易池本金 ({config.depositTradingPoolRatio}%)</span>
                  </p>
                  <p className="text-base md:text-lg font-semibold">{formatCurrency(poolCapital)}</p>
                </div>
                <div className="p-2.5 md:p-3 rounded-md border">
                  <p className="text-xs md:text-sm text-muted-foreground">
                    <span className="md:hidden">日利润 ({config.poolDailyProfitRate}%)</span>
                    <span className="hidden md:inline">日总利润 ({config.poolDailyProfitRate}%)</span>
                  </p>
                  <p className="text-base md:text-lg font-semibold text-green-500">{formatCurrency(dailyPoolProfit)}</p>
                </div>
                <div className="p-2.5 md:p-3 rounded-md border">
                  <p className="text-xs md:text-sm text-muted-foreground">未提取AF</p>
                  <p className="text-base md:text-lg font-semibold">{formatNumber(totalUnclaimedAf)} AF</p>
                </div>
              </div>
              {/* Per-order weight and share */}
              {totalUnclaimedAf > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="text-sm font-medium">个人权重与分润</p>
                  <div className="space-y-2">
                    {stakingOrders.map((order) => {
                      const unclaimed = lastDetails.get(order.id) || 0;
                      const weight = totalUnclaimedAf > 0 ? unclaimed / totalUnclaimedAf : 0;
                      const share = dailyPoolProfit * weight;
                      return (
                        <div key={order.id} className="p-2 rounded border text-sm space-y-2 md:space-y-0">
                          {/* Desktop: single row */}
                          <div className="hidden md:flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">#{order.id.slice(-6)}</Badge>
                              <span className="text-muted-foreground">{formatCurrency(order.amount)}</span>
                            </div>
                            <div className="flex items-center gap-4">
                              <span className="text-muted-foreground">AF: {formatNumber(unclaimed)}</span>
                              <span className="text-muted-foreground">权重: {(weight * 100).toFixed(1)}%</span>
                              <span className="font-medium text-green-500">日分润: {formatCurrency(share)}</span>
                            </div>
                          </div>
                          {/* Mobile: stacked layout */}
                          <div className="md:hidden">
                            <div className="flex items-center justify-between mb-1.5">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline">#{order.id.slice(-6)}</Badge>
                                <span className="text-muted-foreground">{formatCurrency(order.amount)}</span>
                              </div>
                              <span className="font-medium text-green-500">{formatCurrency(share)}/天</span>
                            </div>
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <span>持有 AF: {formatNumber(unclaimed)}</span>
                              <span>权重: {(weight * 100).toFixed(1)}%</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })()}

      {stakingOrders.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <Coins className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>暂无铸造订单</p>
              <p className="text-sm">请先在铸造模拟页面添加订单</p>
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
                  <CardTitle className="text-lg md:text-2xl">{formatCurrency(totals.daily.tradingCapital)}</CardTitle>
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
                  <CardTitle className="text-lg md:text-2xl text-green-500">{formatCurrency(totals.period.userProfit)}</CardTitle>
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
                  <CardTitle className="text-lg md:text-2xl">{formatCurrency(totals.period.platformProfit)}</CardTitle>
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
                  <CardTitle className="text-lg md:text-2xl">{formatCurrency(totals.period.brokerProfit)}</CardTitle>
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
                        <Badge variant={sim.mode === 'days' ? 'default' : 'secondary'}>
                          {sim.mode === 'days' ? `${sim.durationDays}天` : `${sim.packageTier} USDC`}
                        </Badge>
                        <Badge variant="outline">{sim.mode === 'days' ? '天数' : '配套'}</Badge>
                        <span className="text-sm text-muted-foreground">
                          订单 #{sim.orderId.slice(-6)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline">手续费 {sim.feeRate}%</Badge>
                        <Badge variant="outline">利润率 {sim.profitRate}%</Badge>
                        <Badge variant="outline">分润 {sim.profitSharePercent}%</Badge>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedOrderForDetail(sim.orderId)}
                        >
                          <FileText className="h-3 w-3 mr-1" />
                          每日详情
                        </Button>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-2 border-t">
                      <div>
                        <p className="text-xs text-muted-foreground">铸造金额</p>
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
                  {/* Desktop: horizontal flow */}
                  <div className="hidden md:flex items-center gap-4 p-4 rounded-md bg-muted flex-wrap">
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
                  {/* Mobile: vertical flow */}
                  <div className="md:hidden p-3 rounded-md bg-muted space-y-2">
                    <div className="flex justify-between items-center p-2 rounded border">
                      <span className="text-xs text-muted-foreground">总交易量</span>
                      <span className="text-sm font-bold">{formatCurrency(totals.period.totalVolume)}</span>
                    </div>
                    <div className="flex justify-between items-center p-2 rounded border">
                      <span className="text-xs text-muted-foreground">毛利润</span>
                      <span className="text-sm font-bold text-blue-500">+{formatCurrency(totals.period.grossProfit)}</span>
                    </div>
                    <div className="flex justify-between items-center p-2 rounded border">
                      <span className="text-xs text-muted-foreground">手续费</span>
                      <span className="text-sm font-bold text-red-500">-{formatCurrency(totals.period.tradingFee)}</span>
                    </div>
                    <div className="flex justify-between items-center p-2 rounded border border-green-500/30">
                      <span className="text-xs text-muted-foreground">净利润</span>
                      <span className="text-sm font-bold text-green-500">{formatCurrency(totals.period.netProfit)}</span>
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
                <div className="h-[220px] md:h-[280px]">
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
                <div className="h-[220px] md:h-[280px]">
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
              <CardTitle className="text-lg">{config.simulationMode === 'days' ? '各天数交易参数' : '各配套交易参数'}</CardTitle>
              <CardDescription>{config.simulationMode === 'days' ? '不同天数档位的手续费率和利润率' : '不同配套档位的手续费率和利润率'}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[180px] md:h-[200px]">
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

      {selectedOrderForDetail && (() => {
        const order = stakingOrders.find(o => o.id === selectedOrderForDetail);
        if (!order) return null;
        const singleMap = new Map<string, import("@shared/schema").OrderDailyDetail[]>();
        const details = orderDailyDetails.get(selectedOrderForDetail);
        if (details) singleMap.set(selectedOrderForDetail, details);
        return (
          <DailyDetailsDialog
            open
            onOpenChange={(o) => !o && setSelectedOrderForDetail(null)}
            orders={[order]}
            orderDailyDetails={singleMap}
            simulationDays={simulationDays}
          />
        );
      })()}
    </div>
  );
}
