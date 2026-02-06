import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useConfigStore } from "@/hooks/use-config";
import { runSimulationWithDetails, formatNumber, formatCurrency, calculateOrderReleaseProgress, calculateInitialPrice, calculateOrderDailyForexProfit, calculateOrderMsSellingRevenue, isMultiplierCapReached } from "@/lib/calculations";
import DailyDetailsDialog from "@/components/daily-details-dialog";
import { type OrderDailyDetail } from "@shared/schema";
import { TrendingUp, Coins, Flame, DollarSign, RefreshCw, Package, Clock, CheckCircle, FileText } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from "recharts";

export default function ReleasePage() {
  const { config, stakingOrders, aamPool, clearStakingOrders, resetAAMPool, currentSimulationDay } = useConfigStore();
  const simulationDays = Math.max(1, currentSimulationDay);
  const [selectedOrderId, setSelectedOrderId] = useState<string>("all");
  const [showDailyDetails, setShowDailyDetails] = useState(false);
  const [detailOrderId, setDetailOrderId] = useState<string | null>(null);

  // Filter orders based on selection
  const filteredOrders = useMemo(() => {
    if (selectedOrderId === "all") return stakingOrders;
    return stakingOrders.filter(o => o.id === selectedOrderId);
  }, [stakingOrders, selectedOrderId]);

  const simulationData = useMemo(() => {
    if (filteredOrders.length === 0) return null;
    return runSimulationWithDetails(filteredOrders, config, simulationDays, aamPool);
  }, [filteredOrders, config, simulationDays, aamPool]);

  const simulationResults = simulationData?.dailySimulations || [];
  const orderDailyDetails = simulationData?.orderDailyDetails || new Map<string, OrderDailyDetail[]>();

  const totals = useMemo(() => {
    if (simulationResults.length === 0) return null;
    return {
      totalMsReleased: simulationResults.reduce((sum, r) => sum + r.msReleased, 0),
      totalUserProfit: simulationResults.reduce((sum, r) => sum + r.userProfit, 0),
      totalPlatformProfit: simulationResults.reduce((sum, r) => sum + r.platformProfit, 0),
      totalBrokerProfit: simulationResults.reduce((sum, r) => sum + r.brokerProfit, 0),
      totalBurn: simulationResults.reduce((sum, r) => sum + r.burnAmountMs, 0),
      avgPrice: simulationResults.reduce((sum, r) => sum + r.msPrice, 0) / simulationResults.length,
      initialPrice: calculateInitialPrice(config),
      finalPrice: simulationResults[simulationResults.length - 1]?.msPrice || 0,
      totalToSecondaryMarket: simulationResults.reduce((sum, r) => sum + r.toSecondaryMarketMs, 0),
      totalLpUsdc: simulationResults.reduce((sum, r) => sum + r.lpContributionUsdc, 0),
      totalLpAfValue: simulationResults.reduce((sum, r) => sum + r.lpContributionMsValue, 0),
      totalBuyback: simulationResults.reduce((sum, r) => sum + r.buybackAmountUsdc, 0),
      totalReserve: simulationResults.reduce((sum, r) => sum + r.reserveAmountUsdc, 0),
      // Revenue breakdown
      totalAfSellingRevenue: simulationResults.reduce((sum, r) => sum + r.msSellingRevenueUsdc, 0),
      totalForexProfit: simulationResults.reduce((sum, r) => sum + r.userProfit, 0),
    };
  }, [simulationResults, config, aamPool.msPrice]);

  // Build chart data with cumulative values and initial price at day 0
  const chartData = useMemo(() => {
    if (simulationResults.length === 0) return [];
    
    let cumMsReleased = 0;
    let cumUserProfit = 0;
    let cumPlatformProfit = 0;
    let cumBrokerProfit = 0;
    let cumWithdrawAf = 0;
    let cumRewardAf = 0;
    let cumAfSellingRevenue = 0;
    let cumForexProfit = 0;

    const lpInitialPrice = calculateInitialPrice(config);

    // Start with day 0 (initial state)
    const data = [{
      day: 0,
      dayLabel: 'Day 0',
      msPrice: lpInitialPrice,
      msReleased: 0,
      userProfit: 0,
      cumMsReleased: 0,
      cumUserProfit: 0,
      cumPlatformProfit: 0,
      cumBrokerProfit: 0,
      cumWithdrawAf: 0,
      cumRewardAf: 0,
      cumAfSellingRevenue: 0,
      cumForexProfit: 0,
      cumTotalRevenue: 0,
    }];
    
    for (const r of simulationResults) {
      cumMsReleased += r.msReleased;
      cumUserProfit += r.userProfit;
      cumPlatformProfit += r.platformProfit;
      cumBrokerProfit += r.brokerProfit;
      cumWithdrawAf += r.toSecondaryMarketMs;
      // Reward MS = total released - burned - kept as fee
      cumRewardAf += r.msReleased - r.burnAmountMs;
      cumAfSellingRevenue += r.msSellingRevenueUsdc;
      cumForexProfit += r.userProfit;

      data.push({
        day: r.day,
        dayLabel: `Day ${r.day}`,
        msPrice: r.msPrice,
        msReleased: r.msReleased,
        userProfit: r.userProfit,
        cumMsReleased,
        cumUserProfit,
        cumPlatformProfit,
        cumBrokerProfit,
        cumWithdrawAf,
        cumRewardAf,
        cumAfSellingRevenue,
        cumForexProfit,
        cumTotalRevenue: cumForexProfit + cumAfSellingRevenue,
      });
    }

    return data;
  }, [simulationResults, config, aamPool.msPrice]);

  // Calculate per-order release progress for current simulation day (filtered by selection)
  const orderProgress = useMemo(() => {
    if (filteredOrders.length === 0) return [];
    const currentAfPrice = simulationResults.length > 0 
      ? simulationResults[simulationResults.length - 1].msPrice 
      : aamPool.msPrice;
    return calculateOrderReleaseProgress(filteredOrders, config, simulationDays, currentAfPrice);
  }, [filteredOrders, config, simulationDays, simulationResults, aamPool.msPrice]);

  return (
    <div className="p-3 md:p-6 space-y-4 md:space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">释放进度</h1>
          <p className="text-muted-foreground">当前 Day {currentSimulationDay}，在铸造模拟页面前进天数</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant={stakingOrders.length > 0 ? "default" : "secondary"}>
            {stakingOrders.length} 笔铸造订单
          </Badge>
          <Badge variant="outline">
            Day {currentSimulationDay}
          </Badge>
          <Select value={selectedOrderId} onValueChange={setSelectedOrderId}>
            <SelectTrigger className="w-full md:w-[200px]" data-testid="select-order-filter">
              <SelectValue placeholder="选择订单" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部订单 ({stakingOrders.length}笔)</SelectItem>
              {stakingOrders.map((order, idx) => (
                <SelectItem key={order.id} value={order.id}>
                  #{idx + 1} {order.mode === 'days' ? `${order.durationDays}天` : `${order.packageTier} USDC`} ({formatCurrency(order.amount)})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            onClick={() => setShowDailyDetails(true)}
            disabled={stakingOrders.length === 0 || simulationResults.length === 0}
          >
            <FileText className="h-4 w-4 mr-2" />
            每日详情
          </Button>
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

      {currentSimulationDay === 0 && (
        <Card>
          <CardContent className="py-6">
            <div className="text-center text-muted-foreground">
              <p>当前 Day 0，请先在铸造模拟页面前进天数来查看释放进度</p>
            </div>
          </CardContent>
        </Card>
      )}

      {selectedOrderId !== "all" && (() => {
        const orderIdx = stakingOrders.findIndex(o => o.id === selectedOrderId);
        const order = filteredOrders[0];
        return (
          <Card>
            <CardContent className="py-3">
              <p className="text-sm">
                当前查看: <Badge variant="default">{formatCurrency(order?.amount ?? 0)}</Badge>
                <span className="text-muted-foreground ml-2">
                  订单 #{orderIdx + 1} | {order?.mode === 'days' ? `${order.durationDays}天模式` : `${order?.daysStaked}天铸造`} | Day {order?.startDay ?? 0} 入单
                </span>
              </p>
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
            <>
              {/* Customer Revenue Breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="border-green-500/30 bg-green-500/5">
                  <CardHeader className="pb-2">
                    <CardDescription className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4" />
                      外汇交易收益
                    </CardDescription>
                    <CardTitle className="text-xl text-green-500">{formatCurrency(totals.totalForexProfit)}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">
                      日均 {formatCurrency(totals.totalForexProfit / simulationDays)}
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-blue-500/30 bg-blue-500/5">
                  <CardHeader className="pb-2">
                    <CardDescription className="flex items-center gap-2">
                      <Coins className="h-4 w-4" />
                      卖MS代币收益
                    </CardDescription>
                    <CardTitle className="text-xl text-blue-500">{formatCurrency(totals.totalAfSellingRevenue)}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">
                      日均 {formatCurrency(totals.totalAfSellingRevenue / simulationDays)} | 提取 {formatNumber(totals.totalToSecondaryMarket)} MS
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-yellow-500/30 bg-yellow-500/5">
                  <CardHeader className="pb-2">
                    <CardDescription className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" />
                      客户总收益
                    </CardDescription>
                    <CardTitle className="text-xl text-yellow-500">{formatCurrency(totals.totalForexProfit + totals.totalAfSellingRevenue)}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">
                      日均 {formatCurrency((totals.totalForexProfit + totals.totalAfSellingRevenue) / simulationDays)}
                    </p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription className="flex items-center gap-2">
                      <Coins className="h-4 w-4" />
                      累计释放 MS
                    </CardDescription>
                    <CardTitle className="text-xl">{formatNumber(totals.totalMsReleased)}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">
                      日均 {formatNumber(totals.totalMsReleased / simulationDays)} MS
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription className="flex items-center gap-2">
                      <Coins className="h-4 w-4" />
                      累计拨出奖励 MS
                    </CardDescription>
                    <CardTitle className="text-xl">{formatNumber(totals.totalMsReleased - totals.totalBurn)}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">
                      释放 - 销毁
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" />
                      累计客户提取 MS
                    </CardDescription>
                    <CardTitle className="text-xl">{formatNumber(totals.totalToSecondaryMarket)}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">
                      卖入 LP 池
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4" />
                      累计平台分润
                    </CardDescription>
                    <CardTitle className="text-xl">{formatCurrency(totals.totalPlatformProfit)}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">
                      日均 {formatCurrency(totals.totalPlatformProfit / simulationDays)}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4" />
                      累计经纪人分润
                    </CardDescription>
                    <CardTitle className="text-xl">{formatCurrency(totals.totalBrokerProfit)}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">
                      日均 {formatCurrency(totals.totalBrokerProfit / simulationDays)}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription className="flex items-center gap-2">
                      <Flame className="h-4 w-4" />
                      累计销毁 MS
                    </CardDescription>
                    <CardTitle className="text-xl">{formatNumber(totals.totalBurn)}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">
                      销毁率 {totals.totalMsReleased > 0 ? ((totals.totalBurn / totals.totalMsReleased) * 100).toFixed(1) : 0}%
                    </p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>初始币价 (LP设置)</CardDescription>
                    <CardTitle className="text-xl">${totals.initialPrice.toFixed(6)}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">Day 0 | {formatCurrency(config.initialLpUsdc)} / {formatNumber(config.initialLpMs, 0)} MS</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>最终币价</CardDescription>
                    <CardTitle className="text-xl">${totals.finalPrice.toFixed(6)}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">
                      <span className={totals.finalPrice >= totals.initialPrice ? "text-green-500" : "text-red-500"}>
                        {totals.finalPrice >= totals.initialPrice ? "+" : ""}{((totals.finalPrice / totals.initialPrice - 1) * 100).toFixed(2)}%
                      </span>
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>平均币价</CardDescription>
                    <CardTitle className="text-xl">${totals.avgPrice.toFixed(6)}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">{simulationDays}天均价</p>
                  </CardContent>
                </Card>
              </div>
            </>
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
                {orderProgress.map((progress, idx) => {
                  const globalIdx = stakingOrders.findIndex(o => o.id === progress.orderId);
                  const orderNum = globalIdx >= 0 ? globalIdx + 1 : idx + 1;
                  return (
                  <div key={progress.orderId} className="p-4 rounded-md border space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={progress.isComplete ? "default" : "secondary"}>
                          #{orderNum}
                        </Badge>
                        <Badge variant="outline">
                          {formatCurrency(progress.amount)}
                        </Badge>
                        <Badge variant="outline">{progress.mode === 'days' ? `${progress.totalDays}天` : '配套'}</Badge>
                        <span className="text-sm text-muted-foreground">
                          Day {progress.startDay} 入单
                        </span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
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
                        {/* Multiplier cap status badge for days mode */}
                        {progress.mode === 'days' && config.multiplierCapEnabled && (() => {
                          const daysConfig = config.daysConfigs?.find(d => d.days === progress.totalDays);
                          if (!daysConfig) return null;
                          const capValue = progress.amount * daysConfig.releaseMultiplier;
                          const currentValue = progress.totalMsReleased * (simulationResults.length > 0 ? simulationResults[simulationResults.length - 1].msPrice : aamPool.msPrice);
                          const capped = currentValue >= capValue;
                          const capProgress = capValue > 0 ? Math.min((currentValue / capValue) * 100, 100) : 0;
                          return (
                            <Badge variant={capped ? "destructive" : "outline"} className={capped ? "" : "border-amber-500 text-amber-500"}>
                              {capped ? "已封顶" : `封顶 ${capProgress.toFixed(0)}%`}
                            </Badge>
                          );
                        })()}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDetailOrderId(progress.orderId)}
                          disabled={simulationResults.length === 0}
                        >
                          <FileText className="h-3 w-3 mr-1" />
                          每日详情
                        </Button>
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
                        <span>铸造金额: {formatCurrency(progress.amount)}</span>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pt-2 border-t">
                      <div>
                        <p className="text-xs text-muted-foreground">日释放 MS</p>
                        <p className="text-sm font-medium">{formatNumber(progress.dailyMsRelease)} MS</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">累计释放 MS</p>
                        <p className="text-sm font-medium">{formatNumber(progress.totalMsReleased)} MS</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">MS 价值 (USDC)</p>
                        <p className="text-sm font-medium">{formatCurrency(progress.totalMsValue)}</p>
                      </div>
                      {progress.mode === 'days' && config.multiplierCapEnabled && (() => {
                        const daysConfig = config.daysConfigs?.find(d => d.days === progress.totalDays);
                        if (!daysConfig) return null;
                        const capValue = progress.amount * daysConfig.releaseMultiplier;
                        const currentAfPrice = simulationResults.length > 0 ? simulationResults[simulationResults.length - 1].msPrice : aamPool.msPrice;
                        const currentValue = progress.totalMsReleased * currentAfPrice;
                        return (
                          <div>
                            <p className="text-xs text-muted-foreground">封顶进度</p>
                            <p className="text-sm font-medium">{formatCurrency(currentValue)} / {formatCurrency(capValue)}</p>
                          </div>
                        );
                      })()}
                      {progress.msKeptInSystem > 0 && (
                        <div>
                          <p className="text-xs text-muted-foreground">系统内保留 MS</p>
                          <p className="text-sm font-medium">{formatNumber(progress.msKeptInSystem)} MS</p>
                        </div>
                      )}
                      {progress.msWithdrawn > 0 && (
                        <div>
                          <p className="text-xs text-muted-foreground">已提取 MS</p>
                          <p className="text-sm font-medium">{formatNumber(progress.msWithdrawn)} MS</p>
                        </div>
                      )}
                    </div>
                    
                    {(() => {
                      const pkg = config.packageConfigs.find(p => p.tier === progress.packageTier);
                      if (!pkg) return null;
                      const multiplier = config.tradingCapitalMultiplier;

                      // Use shared calculation for forex profit
                      const order = filteredOrders.find(o => o.id === progress.orderId);
                      const forexDetail = order
                        ? calculateOrderDailyForexProfit(order, config)
                        : { dailyVolume: 0, userProfit: 0 };
                      const dailyVolume = forexDetail.dailyVolume;
                      const userDailyProfit = forexDetail.userProfit;
                      const periodForexProfit = userDailyProfit * progress.currentDay;

                      // Use shared calculation for MS selling revenue
                      const currentAfPrice = simulationResults.length > 0
                        ? simulationResults[Math.min(progress.currentDay - 1, simulationResults.length - 1)]?.msPrice || aamPool.msPrice
                        : aamPool.msPrice;
                      const afSelling = calculateOrderMsSellingRevenue(progress.totalMsReleased, currentAfPrice, order?.withdrawPercent ?? 60, config);
                      const soldAf = afSelling.soldAf;
                      const afSellingRevenue = afSelling.revenueUsdc;

                      const totalRevenue = periodForexProfit + afSellingRevenue;

                      return (
                        <>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t bg-muted/50 p-3 rounded-md">
                            <div>
                              <p className="text-xs text-muted-foreground">交易本金倍数</p>
                              <p className="text-sm font-medium text-primary">{multiplier}x</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">交易本金</p>
                              <p className="text-sm font-medium">{formatCurrency(progress.tradingCapital)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">日交易量</p>
                              <p className="text-sm font-medium">{formatCurrency(dailyVolume)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">日外汇收益</p>
                              <p className="text-sm font-medium text-green-500">{formatCurrency(userDailyProfit)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">利润率</p>
                              <p className="text-sm font-medium">{pkg.tradingProfitRate}%</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">手续费率</p>
                              <p className="text-sm font-medium">{pkg.tradingFeeRate}%</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">分润比例</p>
                              <p className="text-sm font-medium">{pkg.profitSharePercent}%</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">提取MS数量</p>
                              <p className="text-sm font-medium">{formatNumber(soldAf)} MS</p>
                            </div>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t">
                            <div className="p-2 rounded bg-green-500/10 border border-green-500/20">
                              <p className="text-xs text-muted-foreground">外汇交易收益</p>
                              <p className="text-sm font-bold text-green-500">{formatCurrency(periodForexProfit)}</p>
                            </div>
                            <div className="p-2 rounded bg-blue-500/10 border border-blue-500/20">
                              <p className="text-xs text-muted-foreground">卖MS代币收益</p>
                              <p className="text-sm font-bold text-blue-500">{formatCurrency(afSellingRevenue)}</p>
                            </div>
                            <div className="p-2 rounded bg-yellow-500/10 border border-yellow-500/20">
                              <p className="text-xs text-muted-foreground">{progress.currentDay}天客户总收益</p>
                              <p className="text-sm font-bold text-yellow-500">{formatCurrency(totalRevenue)}</p>
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {totals && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">MS 退出分配详情</CardTitle>
                <CardDescription>用户选择提现/保留/转换后的 MS 流向 (各配套独立设置)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-3 rounded-md border">
                    <p className="text-sm text-muted-foreground">卖入 LP 池</p>
                    <p className="text-lg font-semibold">{formatNumber(totals.totalToSecondaryMarket)} MS</p>
                    <p className="text-xs text-muted-foreground">提现后卖入池子（价格下降）</p>
                  </div>
                  <div className="p-3 rounded-md border">
                    <p className="text-sm text-muted-foreground">销毁 MS</p>
                    <p className="text-lg font-semibold">{formatNumber(totals.totalBurn)} MS</p>
                    <p className="text-xs text-muted-foreground">{config.msExitBurnRatio}% 提现销毁比例</p>
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
                    <p className="text-sm text-muted-foreground">LP 池 (MS价值)</p>
                    <p className="text-lg font-semibold">{formatCurrency(totals.totalLpAfValue)}</p>
                    <p className="text-xs text-muted-foreground">{config.lpPoolMsRatio}% 交易金</p>
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

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{simulationDays}天币价走势</CardTitle>
              <CardDescription>从第0天初始价格开始的币价变化</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[220px] md:h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="day" tick={{ fontSize: 12 }} className="text-muted-foreground" />
                    <YAxis 
                      tick={{ fontSize: 12 }} 
                      domain={['auto', 'auto']} 
                      className="text-muted-foreground"
                      tickFormatter={(v) => `$${v.toFixed(2)}`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        borderColor: 'hsl(var(--border))',
                        borderRadius: '6px',
                      }}
                      formatter={(value: number) => [`$${value.toFixed(6)}`, 'MS 价格']}
                      labelFormatter={(label) => `Day ${label}`}
                    />
                    <Line
                      type="monotone"
                      dataKey="msPrice"
                      name="MS 价格"
                      stroke="hsl(var(--chart-2))"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">累计 MS 释放与拨出</CardTitle>
                <CardDescription>累计释放 MS 和累计拨出奖励 MS</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[220px] md:h-[300px]">
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
                        labelFormatter={(label) => `Day ${label}`}
                      />
                      <Legend />
                      <Area
                        type="monotone"
                        dataKey="cumMsReleased"
                        name="累计释放 MS"
                        stroke="hsl(var(--primary))"
                        fill="hsl(var(--primary) / 0.3)"
                      />
                      <Area
                        type="monotone"
                        dataKey="cumRewardAf"
                        name="累计拨出奖励 MS"
                        stroke="hsl(var(--chart-2))"
                        fill="hsl(var(--chart-2) / 0.3)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">累计客户提取 MS</CardTitle>
                <CardDescription>客户提现后卖入 LP 池的 MS 数量</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[220px] md:h-[300px]">
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
                        labelFormatter={(label) => `Day ${label}`}
                      />
                      <Area
                        type="monotone"
                        dataKey="cumWithdrawAf"
                        name="累计客户提取 MS"
                        stroke="hsl(var(--chart-4))"
                        fill="hsl(var(--chart-4) / 0.3)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">累计客户收益拆分</CardTitle>
                <CardDescription>外汇交易收益 + 卖MS代币收益 = 客户总收益</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[220px] md:h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="day" tick={{ fontSize: 12 }} className="text-muted-foreground" />
                      <YAxis
                        tick={{ fontSize: 12 }}
                        className="text-muted-foreground"
                        tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          borderColor: 'hsl(var(--border))',
                          borderRadius: '6px',
                        }}
                        formatter={(value: number) => formatCurrency(value)}
                        labelFormatter={(label) => `Day ${label}`}
                      />
                      <Legend />
                      <Area
                        type="monotone"
                        dataKey="cumTotalRevenue"
                        name="客户总收益"
                        stroke="#eab308"
                        fill="rgba(234, 179, 8, 0.15)"
                      />
                      <Area
                        type="monotone"
                        dataKey="cumForexProfit"
                        name="外汇交易收益"
                        stroke="hsl(var(--chart-2))"
                        fill="hsl(var(--chart-2) / 0.3)"
                      />
                      <Area
                        type="monotone"
                        dataKey="cumAfSellingRevenue"
                        name="卖MS代币收益"
                        stroke="#3b82f6"
                        fill="rgba(59, 130, 246, 0.2)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">每日 MS 释放</CardTitle>
                <CardDescription>每日 MS 释放数量</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[220px] md:h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData.slice(1)}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="day" tick={{ fontSize: 12 }} className="text-muted-foreground" />
                      <YAxis tick={{ fontSize: 12 }} className="text-muted-foreground" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          borderColor: 'hsl(var(--border))',
                          borderRadius: '6px',
                        }}
                        labelFormatter={(label) => `Day ${label}`}
                      />
                      <Area
                        type="monotone"
                        dataKey="msReleased"
                        name="每日 MS 释放"
                        stroke="hsl(var(--primary))"
                        fill="hsl(var(--primary) / 0.2)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">累计平台与经纪人分润</CardTitle>
              <CardDescription>平台和经纪人累计利润</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[220px] md:h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="day" tick={{ fontSize: 12 }} className="text-muted-foreground" />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      className="text-muted-foreground"
                      tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        borderColor: 'hsl(var(--border))',
                        borderRadius: '6px',
                      }}
                      formatter={(value: number) => formatCurrency(value)}
                      labelFormatter={(label) => `Day ${label}`}
                    />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="cumPlatformProfit"
                      name="累计平台分润"
                      stroke="hsl(var(--chart-1))"
                      fill="hsl(var(--chart-1) / 0.3)"
                    />
                    <Area
                      type="monotone"
                      dataKey="cumBrokerProfit"
                      name="累计经纪人分润"
                      stroke="hsl(var(--chart-4))"
                      fill="hsl(var(--chart-4) / 0.3)"
                    />
                  </AreaChart>
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
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
                  {simulationResults.slice(-10).map((result) => (
                    <div key={result.day} className="p-3 rounded-md border bg-card space-y-1">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="text-xs">Day {result.day}</Badge>
                      </div>
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">释放</span>
                          <span>{formatNumber(result.msReleased)} MS</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">币价</span>
                          <span>${result.msPrice.toFixed(4)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">外汇收益</span>
                          <span className="text-green-500">{formatCurrency(result.userProfit)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">卖MS收益</span>
                          <span className="text-blue-500">{formatCurrency(result.msSellingRevenueUsdc)}</span>
                        </div>
                        <div className="flex justify-between font-medium">
                          <span className="text-muted-foreground">总收益</span>
                          <span className="text-yellow-500">{formatCurrency(result.userProfit + result.msSellingRevenueUsdc)}</span>
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
      <DailyDetailsDialog
        open={showDailyDetails}
        onOpenChange={setShowDailyDetails}
        orders={filteredOrders}
        orderDailyDetails={orderDailyDetails}
        simulationDays={simulationDays}
      />
      {detailOrderId && (() => {
        const order = stakingOrders.find(o => o.id === detailOrderId);
        if (!order) return null;
        // Run a dedicated simulation for this single order, from its own day 0
        const singleOrder = { ...order, startDay: 0 };
        const orderElapsed = Math.max(1, currentSimulationDay - (order.startDay ?? 0));
        const singleResult = runSimulationWithDetails([singleOrder], config, orderElapsed, aamPool);
        return (
          <DailyDetailsDialog
            open
            onOpenChange={(o) => !o && setDetailOrderId(null)}
            orders={[singleOrder]}
            orderDailyDetails={singleResult.orderDailyDetails}
            simulationDays={orderElapsed}
          />
        );
      })()}
    </div>
  );
}
