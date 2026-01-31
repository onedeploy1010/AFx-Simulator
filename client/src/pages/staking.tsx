import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Slider } from "@/components/ui/slider";
import { useConfigStore } from "@/hooks/use-config";
import { PACKAGE_TIERS, DAYS_MODE_TIERS } from "@shared/schema";
import { Plus, Trash2, Coins, TrendingUp, Calculator, CircleDollarSign, Calendar, Clock, Play, RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatNumber, formatCurrency, calculateInitialPrice, calculateOrderTradingCapital, calculateOrderDailyRelease, calculateAFExitDistribution } from "@/lib/calculations";

export default function StakingPage() {
  const { config, stakingOrders, aamPool, addStakingOrder, removeStakingOrder, clearStakingOrders, resetAAMPool, resetAll, currentSimulationDay, setSimulationDay, advanceToDay } = useConfigStore();
  
  // Calculate initial price for comparison
  const initialPrice = calculateInitialPrice(config);
  const priceChange = aamPool.msPrice - initialPrice;
  const priceChangePercent = initialPrice > 0 ? ((aamPool.msPrice / initialPrice) - 1) * 100 : 0;
  const { toast } = useToast();
  
  const [selectedTier, setSelectedTier] = useState<string>("1000");
  const [amount, setAmount] = useState<string>("1");
  const [daysAmount, setDaysAmount] = useState<string>("5000");
  const [daysDuration, setDaysDuration] = useState<number>(30);
  const [targetDay, setTargetDay] = useState<string>("");
  const [withdrawPercent, setWithdrawPercent] = useState<number>(50);
  
  const selectedPackage = config.packageConfigs.find(p => p.tier === parseInt(selectedTier));
  const defaultStakingDays = selectedPackage?.stakingPeriodDays || 30;
  const [stakingDays, setStakingDays] = useState<string>(defaultStakingDays.toString());

  const handleTierChange = (newTier: string) => {
    setSelectedTier(newTier);
    const pkg = config.packageConfigs.find(p => p.tier === parseInt(newTier));
    if (pkg) {
      setStakingDays(pkg.stakingPeriodDays.toString());
    }
  };

  const handleAddOrder = () => {
    const tier = parseInt(selectedTier);
    const count = parseInt(amount) || 1;
    // When staking is disabled, use 1 day (instant release)
    const days = config.stakingEnabled ? (parseInt(stakingDays) || defaultStakingDays) : 1;
    const packageConfig = config.packageConfigs.find(p => p.tier === tier);

    if (!packageConfig) return;

    for (let i = 0; i < count; i++) {
      addStakingOrder({
        packageTier: tier,
        amount: tier,
        startDate: new Date().toISOString(),
        daysStaked: days,
        msReleased: 0,
        tradingCapital: tier * config.tradingCapitalMultiplier,
        mode: 'package',
        startDay: currentSimulationDay,
        totalMsToRelease: 0,
        msWithdrawn: 0,
        msKeptInSystem: 0,
        withdrawPercent,
      });
    }

    const daysText = config.stakingEnabled ? ` (${days}天)` : ' (即时释放)';
    toast({
      title: "订单已添加",
      description: `成功添加 ${count} 笔 ${tier} USDC 订单${daysText}`,
    });
    setAmount("1");
  };

  const handleAddDaysOrder = () => {
    const amt = parseFloat(daysAmount) || 1000;
    if (amt < 100 || amt % 100 !== 0) {
      toast({ title: "金额无效", description: "金额必须为100的倍数，最低100 USDC", variant: "destructive" });
      return;
    }
    const daysConfig = config.daysConfigs.find(dc => dc.days === daysDuration);
    if (!daysConfig) return;

    const afQuantity = aamPool.msPrice > 0 ? amt / aamPool.msPrice : 0;
    const totalMsToRelease = afQuantity * daysConfig.releaseMultiplier;

    addStakingOrder({
      packageTier: 0,
      amount: amt,
      startDate: new Date().toISOString(),
      daysStaked: daysDuration,
      durationDays: daysDuration,
      msReleased: 0,
      tradingCapital: 0,
      mode: 'days',
      startDay: currentSimulationDay,
      totalMsToRelease,
      msWithdrawn: 0,
      msKeptInSystem: 0,
      withdrawPercent,
    });

    toast({
      title: "天数模式订单已添加",
      description: `${amt} USDC, ${daysDuration}天, 总释放 ${totalMsToRelease.toFixed(2)} MS`,
    });
    setDaysAmount("5000");
  };

  const totalStaked = stakingOrders.reduce((sum, order) => sum + order.amount, 0);
  // Calculate trading capital dynamically based on current config
  const totalTradingCapital = stakingOrders.reduce((sum, order) => {
    return sum + calculateOrderTradingCapital(order, config);
  }, 0);
  const avgDailyRelease = stakingOrders.reduce((sum, order) => {
    return sum + calculateOrderDailyRelease(order, config, aamPool.msPrice);
  }, 0);

  const ordersByTier = PACKAGE_TIERS.map(tier => ({
    tier,
    count: stakingOrders.filter(o => o.packageTier === tier).length,
    total: stakingOrders.filter(o => o.packageTier === tier).reduce((sum, o) => sum + o.amount, 0),
  })).filter(t => t.count > 0);

  return (
    <div className="p-3 md:p-6 space-y-4 md:space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">铸造模拟</h1>
          <p className="text-muted-foreground">支持用户叠加多笔铸造订单</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={() => {
              resetAll();
              toast({
                title: "已还原默认设置",
                description: "所有配置、订单和池状态已恢复为默认值",
              });
            }}
            data-testid="button-reset-all"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            还原默认
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              resetAAMPool();
              toast({
                title: "AAM池已重置",
                description: `价格: $${calculateInitialPrice(config).toFixed(6)} (${formatCurrency(config.initialLpUsdc)} / ${formatNumber(config.initialLpMs)} MS)`
              });
            }}
            data-testid="button-reset-aam"
          >
            重置价格
          </Button>
          <Button variant="destructive" onClick={() => { clearStakingOrders(); resetAAMPool(); }} disabled={stakingOrders.length === 0} data-testid="button-clear-orders">
            <Trash2 className="h-4 w-4 mr-2" />
            清空所有
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>总铸造金额</CardDescription>
            <CardTitle className="text-xl md:text-3xl">{formatCurrency(totalStaked)}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Coins className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">{stakingOrders.length} 笔订单</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>总交易金</CardDescription>
            <CardTitle className="text-xl md:text-3xl">{formatCurrency(totalTradingCapital)}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                平均倍数 {totalStaked > 0 ? (totalTradingCapital / totalStaked).toFixed(2) : 0}x
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>预估日释放 MS</CardDescription>
            <CardTitle className="text-xl md:text-3xl">{formatNumber(avgDailyRelease)} MS</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Calculator className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {config.msReleaseMode === 'gold_standard' ? '金本位模式' : '币本位模式'}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>当前 MS 价格</CardDescription>
            <CardTitle className="text-xl md:text-3xl">${aamPool.msPrice.toFixed(6)}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <CircleDollarSign className="h-4 w-4 text-muted-foreground" />
                <span className={`text-sm font-medium ${priceChangePercent >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {priceChangePercent >= 0 ? '+' : ''}{priceChangePercent.toFixed(4)}%
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                初始: ${initialPrice.toFixed(6)}
              </p>
              <p className="text-xs text-muted-foreground">
                LP池: {formatCurrency(aamPool.usdcBalance)} / {formatNumber(aamPool.msBalance)} MS
              </p>
              <p className="text-xs text-muted-foreground">
                累计回购: {formatCurrency(aamPool.totalBuyback)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Day Simulation Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            模拟日控制
          </CardTitle>
          <CardDescription>控制当前模拟天数，观察不同时间点的状态</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">当前:</span>
              <Badge variant="secondary" className="text-lg px-3 py-1">
                Day {currentSimulationDay}
              </Badge>
            </div>
            <div className="flex items-center gap-1">
              {[1, 5, 10].map((n) => (
                <Button
                  key={n}
                  variant="outline"
                  size="sm"
                  onClick={() => setSimulationDay(currentSimulationDay + n)}
                >
                  +{n}
                </Button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                placeholder="跳转到第N天"
                value={targetDay}
                onChange={(e) => setTargetDay(e.target.value)}
                className="w-28 md:w-36"
                min={0}
                max={365}
              />
              <Button
                size="sm"
                onClick={() => {
                  const day = parseInt(targetDay);
                  if (!isNaN(day) && day >= 0) {
                    setSimulationDay(day);
                    setTargetDay("");
                  }
                }}
              >
                <Play className="h-4 w-4 mr-1" />
                Go
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {[0, 1, 8, 15, 30, 60, 90].map((day) => (
              <Button
                key={day}
                variant={currentSimulationDay === day ? "default" : "outline"}
                size="sm"
                onClick={() => setSimulationDay(day)}
              >
                Day {day}
              </Button>
            ))}
          </div>
          {/* Timeline bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>0</span>
              <span className="hidden sm:inline">Day 30</span>
              <span className="sm:hidden">30</span>
              <span className="hidden sm:inline">Day 60</span>
              <span className="sm:hidden">60</span>
              <span className="hidden sm:inline">Day 90</span>
              <span className="sm:hidden">90</span>
              <span className="hidden sm:inline">Day 180</span>
              <span className="sm:hidden">180</span>
            </div>
            <div className="relative w-full h-3 bg-muted rounded-full overflow-hidden">
              <div
                className="absolute left-0 top-0 h-full bg-primary rounded-full transition-all duration-300"
                style={{ width: `${Math.min((currentSimulationDay / 180) * 100, 100)}%` }}
              />
              <div
                className="absolute top-0 h-full w-0.5 bg-primary-foreground"
                style={{ left: `${Math.min((currentSimulationDay / 180) * 100, 100)}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">添加铸造订单</CardTitle>
          <CardDescription>
            {config.simulationMode === 'days' ? '输入金额和选择周期' : '选择配套档位和数量'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Withdraw Percent Slider — shared by both modes */}
          <div className="space-y-3 p-4 rounded-lg border">
            <div className="flex items-center justify-between">
              <Label>MS 释放提现比例: {withdrawPercent}%</Label>
              <div className="flex gap-3 text-xs">
                <span className="text-red-500">提现 {withdrawPercent}%</span>
                <span className="text-muted-foreground">|</span>
                <span className="text-green-500">持有 {100 - withdrawPercent}%</span>
              </div>
            </div>
            <Slider
              value={[withdrawPercent]}
              onValueChange={([v]) => setWithdrawPercent(v)}
              min={0}
              max={100}
              step={5}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>0% — 全部持有(=交易金)</span>
              <span>100% — 全部提现</span>
            </div>
            {/* MS flow preview */}
            {(() => {
              // Use a sample 100 MS to show proportional flow
              const sample = calculateAFExitDistribution(100, aamPool.msPrice, withdrawPercent, config);
              return (
                <div className="p-3 rounded-md bg-muted/50 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">每 100 MS 释放流向：</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2 rounded border text-center">
                      <p className="text-muted-foreground">提现</p>
                      <p className="font-bold text-red-500">{formatNumber(sample.toWithdrawMs)} MS</p>
                    </div>
                    <div className="p-2 rounded border text-center">
                      <p className="text-muted-foreground">持有(=交易金)</p>
                      <p className="font-bold text-green-500">{formatNumber(sample.toHoldMs)} MS</p>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>

          {config.simulationMode === 'days' ? (
            /* Days Mode Order Creation */
            <div className="space-y-4">
              <div className="flex flex-wrap items-end gap-4">
                <div className="space-y-2 w-full md:w-auto">
                  <Label>铸造金额 (USDC)</Label>
                  <Input
                    type="number"
                    value={daysAmount}
                    onChange={(e) => setDaysAmount(e.target.value)}
                    min={100}
                    step={100}
                    placeholder="100的倍数"
                    className="w-full md:w-40"
                    data-testid="input-days-amount"
                  />
                  <div className="flex flex-wrap gap-1">
                    {[
                      { label: '-10K', value: -10000 },
                      { label: '-1K', value: -1000 },
                      { label: '-100', value: -100 },
                      { label: '+100', value: 100 },
                      { label: '+1K', value: 1000 },
                      { label: '+10K', value: 10000 },
                    ].map((btn) => (
                      <Button
                        key={btn.label}
                        variant="outline"
                        size="sm"
                        className="text-xs h-7 px-2"
                        onClick={() => {
                          const current = parseFloat(daysAmount) || 0;
                          const next = Math.max(100, current + btn.value);
                          setDaysAmount(String(next));
                        }}
                      >
                        {btn.label}
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>铸造周期</Label>
                  <div className="flex gap-2">
                    {DAYS_MODE_TIERS.map((d) => (
                      <Button
                        key={d}
                        variant={daysDuration === d ? "default" : "outline"}
                        size="sm"
                        onClick={() => setDaysDuration(d)}
                      >
                        {d}天
                      </Button>
                    ))}
                  </div>
                </div>
                <Button onClick={handleAddDaysOrder} data-testid="button-add-days-order">
                  <Plus className="h-4 w-4 mr-2" />
                  添加订单
                </Button>
              </div>
              {/* Days mode preview */}
              {(() => {
                const amt = parseFloat(daysAmount) || 0;
                const dc = config.daysConfigs.find(d => d.days === daysDuration);
                if (amt >= 100 && dc && aamPool.msPrice > 0) {
                  const afQty = amt / aamPool.msPrice;
                  const totalRelease = afQty * dc.releaseMultiplier;
                  const dailyRelease = totalRelease / daysDuration;
                  const dailyExit = calculateAFExitDistribution(dailyRelease, aamPool.msPrice, withdrawPercent, config);
                  return (
                    <div className="p-3 rounded-md border bg-muted/50 space-y-2">
                      <p className="text-sm font-medium">预览计算</p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">MS数量: </span>
                          <span className="font-medium">{formatNumber(afQty)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">释放倍数: </span>
                          <span className="font-medium">{dc.releaseMultiplier}x</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">总释放: </span>
                          <span className="font-medium">{formatNumber(totalRelease)} MS</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">日释放: </span>
                          <span className="font-medium">{formatNumber(dailyRelease)} MS</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs border-t pt-2">
                        <div>
                          <span className="text-muted-foreground">日提现: </span>
                          <span className="font-medium text-red-500">{formatNumber(dailyExit.toWithdrawMs, 4)} MS</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">日持有: </span>
                          <span className="font-medium text-green-500">{formatNumber(dailyExit.toHoldMs, 4)} MS</span>
                        </div>
                      </div>
                    </div>
                  );
                }
                return null;
              })()}
            </div>
          ) : (
            /* Package Mode Order Creation (existing) */
            <div className="flex flex-wrap items-end gap-4">
              <div className="space-y-2 flex-1 min-w-[200px]">
                <Label>配套档位</Label>
                <Select value={selectedTier} onValueChange={handleTierChange}>
                  <SelectTrigger data-testid="select-tier">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PACKAGE_TIERS.map((tier) => {
                      const pkg = config.packageConfigs.find(p => p.tier === tier);
                      return (
                        <SelectItem key={tier} value={tier.toString()}>
                          {tier} USDC ({pkg?.releaseMultiplier}x释放, {config.tradingCapitalMultiplier}x交易金)
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 w-24">
                <Label>数量</Label>
                <Input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  min={1}
                  max={100}
                  data-testid="input-amount"
                />
              </div>
              {config.stakingEnabled && (
                <div className="space-y-2 w-28">
                  <Label>铸造周期(天)</Label>
                  <Input
                    type="number"
                    value={stakingDays}
                    onChange={(e) => setStakingDays(e.target.value)}
                    min={1}
                    max={365}
                    data-testid="input-staking-days"
                  />
                </div>
              )}
              <Button onClick={handleAddOrder} data-testid="button-add-order">
                <Plus className="h-4 w-4 mr-2" />
                添加订单
              </Button>
              {!config.stakingEnabled && (
                <div className="mt-4 p-3 rounded-md bg-muted text-muted-foreground text-sm">
                  铸造周期已禁用，MS 将立即释放
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {ordersByTier.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">订单汇总</CardTitle>
            <CardDescription>按配套档位分组</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {ordersByTier.map(({ tier, count, total }) => (
                <div key={tier} className="flex items-center gap-2 p-3 rounded-md border bg-card">
                  <Badge variant="outline">{tier} USDC</Badge>
                  <span className="text-sm">×{count}</span>
                  <span className="text-sm text-muted-foreground">=</span>
                  <span className="text-sm font-medium">{formatCurrency(total)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {stakingOrders.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">订单详情</CardTitle>
            <CardDescription>所有铸造订单列表</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stakingOrders.slice(0, 20).map((order) => {
                const pkg = config.packageConfigs.find(p => p.tier === order.packageTier);
                const daysSinceStart = Math.max(0, currentSimulationDay - (order.startDay ?? 0));
                const dailyAf = calculateOrderDailyRelease(order, config, aamPool.msPrice);
                const exitDist = calculateAFExitDistribution(dailyAf, aamPool.msPrice, order.withdrawPercent ?? 60, config);
                return (
                  <div key={order.id} className="p-4 rounded-md border space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={order.mode === 'days' ? 'default' : 'secondary'}>
                          {order.mode === 'days' ? '天数' : '配套'}
                        </Badge>
                        {order.mode === 'days' ? (
                          <Badge variant="outline">{order.daysStaked}天</Badge>
                        ) : (
                          <Badge variant="outline">{order.packageTier} USDC</Badge>
                        )}
                        <span className="text-sm text-muted-foreground">
                          #{order.id.slice(-6)}
                        </span>
                        <Badge variant="outline">Day {order.startDay ?? 0}</Badge>
                        <span className="text-xs text-muted-foreground">已过 {daysSinceStart} 天</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={order.withdrawPercent === 0 ? "secondary" : order.withdrawPercent === 100 ? "destructive" : "outline"}>
                          提现 {order.withdrawPercent ?? 60}%
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeStakingOrder(order.id)}
                          data-testid={`button-remove-${order.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground">铸造金额</p>
                        <p className="font-medium">{formatCurrency(order.amount)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">日释放</p>
                        <p className="font-medium">{formatNumber(dailyAf, 4)} MS</p>
                      </div>
                      {config.stakingEnabled && (
                        <div>
                          <p className="text-xs text-muted-foreground">铸造周期</p>
                          <p className="font-medium">{order.daysStaked} 天</p>
                        </div>
                      )}
                      {order.mode !== 'days' && (
                        <div>
                          <p className="text-xs text-muted-foreground">释放倍数</p>
                          <p className="font-medium">{pkg?.releaseMultiplier}x</p>
                        </div>
                      )}
                    </div>

                    {/* MS flow breakdown */}
                    <div className="grid grid-cols-2 gap-2 p-3 rounded-md bg-muted/50 text-xs">
                      <div className="text-center">
                        <p className="text-muted-foreground">日提现</p>
                        <p className="font-bold text-red-500">{formatNumber(exitDist.toWithdrawMs, 4)} MS</p>
                      </div>
                      <div className="text-center">
                        <p className="text-muted-foreground">日持有(=交易金)</p>
                        <p className="font-bold text-green-500">{formatNumber(exitDist.toHoldMs, 4)} MS</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {stakingOrders.length > 20 && (
              <p className="mt-2 text-sm text-muted-foreground text-center">
                显示前 20 条，共 {stakingOrders.length} 条订单
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {stakingOrders.length === 0 && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <Coins className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>暂无铸造订单</p>
              <p className="text-sm">添加铸造订单开始模拟</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
