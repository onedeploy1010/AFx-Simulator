import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useConfigStore } from "@/hooks/use-config";
import { BROKER_LEVELS } from "@shared/schema";
import {
  calculateBrokerLayerMsIncome,
  calculateBrokerDividendPool,
  calculateBrokerTradingDividend,
  calculateOrderDailyRelease,
  calculateOrderDailyForexProfit,
  getMaxLayer,
  formatNumber,
  formatCurrency,
} from "@/lib/calculations";
import { Users, TrendingUp, Award, Layers, DollarSign, ArrowRight } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

export default function BrokerPage() {
  const { config, stakingOrders, aamPool } = useConfigStore();
  const [selectedLevel, setSelectedLevel] = useState<string>("V3");
  const [subordinateLevel, setSubordinateLevel] = useState<string>("V1");

  // Manual input fallback when no orders
  const [manualAfPerLayer, setManualAfPerLayer] = useState(500);
  const [manualGrossProfit, setManualGrossProfit] = useState(10000);
  const [manualTradingFee, setManualTradingFee] = useState(1000);
  const [manualProfitShare, setManualProfitShare] = useState(70);

  const hasOrders = stakingOrders.length > 0;

  // ── MS released per layer from actual orders ─────────────────
  const msReleasedPerLayer = useMemo(() => {
    const layers = new Array(20).fill(0);
    if (!hasOrders) {
      // Manual mode: uniform distribution
      for (let i = 0; i < 20; i++) layers[i] = manualAfPerLayer;
      return layers;
    }
    stakingOrders.forEach((order, i) => {
      const layerIdx = i % 20;
      const dailyAf = calculateOrderDailyRelease(order, config, aamPool.msPrice);
      layers[layerIdx] += dailyAf;
    });
    return layers;
  }, [stakingOrders, config, aamPool.msPrice, hasOrders, manualAfPerLayer]);

  // ── Trading profit metrics from actual orders ────────────────
  const tradingMetrics = useMemo(() => {
    if (!hasOrders) {
      const pool = calculateBrokerDividendPool(manualGrossProfit, manualTradingFee, manualProfitShare);
      return {
        totalGross: manualGrossProfit,
        totalFee: manualTradingFee,
        totalUserProfit: pool.userShare,
        brokerPool: pool.brokerDividendPool,
        platformShare: pool.platformShare,
        profitSharePercent: manualProfitShare,
      };
    }
    let totalGross = 0, totalFee = 0, totalUserProfit = 0;
    let weightedProfitShare = 0, totalAmount = 0;
    stakingOrders.forEach(order => {
      const fp = calculateOrderDailyForexProfit(order, config, aamPool.msPrice);
      totalGross += fp.grossProfit;
      totalFee += fp.tradingFee;
      totalUserProfit += fp.userProfit;
      const orderMode = order.mode || 'package';
      if (orderMode === 'days') {
        const dc = config.daysConfigs?.find(d => d.days === order.durationDays);
        weightedProfitShare += (dc?.profitSharePercent ?? 70) * order.amount;
      } else {
        const pkg = config.packageConfigs.find(p => p.tier === order.packageTier);
        weightedProfitShare += (pkg?.profitSharePercent ?? 70) * order.amount;
      }
      totalAmount += order.amount;
    });
    const avgProfitShare = totalAmount > 0 ? weightedProfitShare / totalAmount : 70;
    const remaining = Math.max(0, totalGross - totalFee) - totalUserProfit;
    return {
      totalGross,
      totalFee,
      totalUserProfit,
      brokerPool: remaining * 0.5,
      platformShare: remaining * 0.5,
      profitSharePercent: avgProfitShare,
    };
  }, [stakingOrders, config, aamPool.msPrice, hasOrders, manualGrossProfit, manualTradingFee, manualProfitShare]);

  // ── Layer MS income calculation ──────────────────────────────
  const layerIncome = useMemo(() => {
    return calculateBrokerLayerMsIncome(msReleasedPerLayer, selectedLevel, config);
  }, [msReleasedPerLayer, selectedLevel, config]);

  // ── Trading dividend calculation ─────────────────────────────
  const dividendResult = useMemo(() => {
    return calculateBrokerTradingDividend(
      tradingMetrics.brokerPool,
      selectedLevel,
      subordinateLevel === "none" ? null : subordinateLevel,
      config
    );
  }, [tradingMetrics.brokerPool, selectedLevel, subordinateLevel, config]);

  const totalBrokerIncome = layerIncome.totalEarnings * aamPool.msPrice + dividendResult.earnings;

  // ── V1-V6 comparison data ────────────────────────────────────
  const levelComparisonAf = useMemo(() => {
    return BROKER_LEVELS.map(level => {
      const income = calculateBrokerLayerMsIncome(msReleasedPerLayer, level, config);
      return {
        level,
        maxLayer: getMaxLayer(level, config),
        earnings: income.totalEarnings,
        compressed: income.compressedEarnings,
        earningsUsdc: income.totalEarnings * aamPool.msPrice,
      };
    });
  }, [msReleasedPerLayer, config, aamPool.msPrice]);

  const levelComparisonDividend = useMemo(() => {
    return BROKER_LEVELS.map((level, idx) => {
      const subLevel = idx > 0 ? BROKER_LEVELS[idx - 1] : null;
      const result = calculateBrokerTradingDividend(
        tradingMetrics.brokerPool,
        level,
        subLevel ?? null,
        config
      );
      return {
        level,
        brokerRate: result.brokerRate,
        subRate: result.subRate,
        diffRate: result.differentialRate,
        earnings: result.earnings,
      };
    });
  }, [tradingMetrics.brokerPool, config]);

  // ── Bar chart data for layer MS ──────────────────────────────
  const layerChartData = layerIncome.layers.map(l => ({
    name: `L${l.layer}`,
    earnings: l.accessible ? l.earnings : 0,
    compressed: l.accessible ? 0 : l.earnings,
  }));

  return (
    <div className="p-3 md:p-6 space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">经纪人系统</h1>
          <p className="text-muted-foreground">MS层级收益 + 交易利润分红（级差制度）</p>
        </div>
        <Badge variant="outline" className="text-lg px-4 py-2">{selectedLevel}</Badge>
      </div>

      {/* Parameter Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">参数设置</CardTitle>
          <CardDescription>选择经纪人等级与下级等级</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>经纪人等级</Label>
              <Select value={selectedLevel} onValueChange={setSelectedLevel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BROKER_LEVELS.map(level => (
                    <SelectItem key={level} value={level}>
                      {level} — 最高第 {getMaxLayer(level, config)} 层
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>下级等级</Label>
              <Select value={subordinateLevel} onValueChange={setSubordinateLevel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">无下级</SelectItem>
                  {BROKER_LEVELS.filter((_, i) => i < BROKER_LEVELS.indexOf(selectedLevel as typeof BROKER_LEVELS[number])).map(level => (
                    <SelectItem key={level} value={level}>{level}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Badge variant={hasOrders ? "default" : "secondary"} className="h-10 px-4 flex items-center">
                {hasOrders ? `${stakingOrders.length} 笔订单数据` : "手动输入模式"}
              </Badge>
            </div>
          </div>

          {/* Manual inputs when no orders */}
          {!hasOrders && (
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-md border border-dashed">
              <div className="space-y-2">
                <Label>每层MS释放量</Label>
                <Input
                  type="number"
                  value={manualAfPerLayer}
                  onChange={(e) => setManualAfPerLayer(parseFloat(e.target.value) || 0)}
                  min={0}
                />
              </div>
              <div className="space-y-2">
                <Label>团队日毛利润 (USDC)</Label>
                <Input
                  type="number"
                  value={manualGrossProfit}
                  onChange={(e) => setManualGrossProfit(parseFloat(e.target.value) || 0)}
                  min={0}
                />
              </div>
              <div className="space-y-2">
                <Label>交易手续费 (USDC)</Label>
                <Input
                  type="number"
                  value={manualTradingFee}
                  onChange={(e) => setManualTradingFee(parseFloat(e.target.value) || 0)}
                  min={0}
                />
              </div>
              <div className="space-y-2">
                <Label>用户分成比例 (%)</Label>
                <Input
                  type="number"
                  value={manualProfitShare}
                  onChange={(e) => setManualProfitShare(parseFloat(e.target.value) || 0)}
                  min={0}
                  max={100}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Layers className="h-4 w-4" />
              层级MS收益
            </CardDescription>
            <CardTitle className="text-lg md:text-2xl">{formatNumber(layerIncome.totalEarnings)} MS</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              ≈ {formatCurrency(layerIncome.totalEarnings * aamPool.msPrice)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              交易分红
            </CardDescription>
            <CardTitle className="text-lg md:text-2xl">{formatCurrency(dividendResult.earnings)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              级差 {dividendResult.differentialRate}% of {formatCurrency(tradingMetrics.brokerPool)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Award className="h-4 w-4" />
              总收益
            </CardDescription>
            <CardTitle className="text-lg md:text-2xl text-green-500">{formatCurrency(totalBrokerIncome)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              MS收益 + 交易分红
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              MS 价格
            </CardDescription>
            <CardTitle className="text-lg md:text-2xl">${aamPool.msPrice.toFixed(4)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              紧缩收益: {formatNumber(layerIncome.compressedEarnings)} MS
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="layer-af" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="layer-af" className="text-xs sm:text-sm px-1 sm:px-3">层级MS收益</TabsTrigger>
          <TabsTrigger value="trading-dividend" className="text-xs sm:text-sm px-1 sm:px-3">交易分红</TabsTrigger>
          <TabsTrigger value="estimation" className="text-xs sm:text-sm px-1 sm:px-3">综合估算</TabsTrigger>
        </TabsList>

        {/* Tab 1: Layer MS Income */}
        <TabsContent value="layer-af" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">20层MS释放收益明细 ({selectedLevel})</CardTitle>
              <CardDescription>
                {selectedLevel} 可访问第 1-{getMaxLayer(selectedLevel, config)} 层，
                超出层级收益紧缩给上级
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Desktop: full table */}
              <div className="hidden md:block rounded-md border overflow-auto max-h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[60px]">层级</TableHead>
                      <TableHead className="text-right">MS释放量</TableHead>
                      <TableHead className="text-right">费率</TableHead>
                      <TableHead className="text-right">收益 (MS)</TableHead>
                      <TableHead className="text-right">收益 (USDC)</TableHead>
                      <TableHead className="text-center">可访问</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {layerIncome.layers.map(l => (
                      <TableRow key={l.layer} className={!l.accessible ? "opacity-50" : ""}>
                        <TableCell>
                          <Badge variant={l.accessible ? "default" : "outline"}>L{l.layer}</Badge>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{formatNumber(l.msReleased)}</TableCell>
                        <TableCell className="text-right">{l.rate}%</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {l.accessible ? formatNumber(l.earnings) : <span className="text-muted-foreground">({formatNumber(l.earnings)})</span>}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {l.accessible ? formatCurrency(l.earnings * aamPool.msPrice) : <span className="text-muted-foreground">紧缩</span>}
                        </TableCell>
                        <TableCell className="text-center">
                          {l.accessible ? "✓" : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted font-semibold">
                      <TableCell>合计</TableCell>
                      <TableCell className="text-right">{formatNumber(msReleasedPerLayer.reduce((a, b) => a + b, 0))}</TableCell>
                      <TableCell />
                      <TableCell className="text-right text-green-500">{formatNumber(layerIncome.totalEarnings)}</TableCell>
                      <TableCell className="text-right text-green-500">{formatCurrency(layerIncome.totalEarnings * aamPool.msPrice)}</TableCell>
                      <TableCell />
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
              {/* Mobile: card list */}
              <div className="md:hidden space-y-2 max-h-[500px] overflow-auto">
                {layerIncome.layers.map(l => (
                  <div key={l.layer} className={`p-2.5 rounded-md border text-sm ${!l.accessible ? "opacity-50" : ""}`}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <Badge variant={l.accessible ? "default" : "outline"} className="text-xs">L{l.layer}</Badge>
                        <span className="text-xs text-muted-foreground">{l.rate}%</span>
                      </div>
                      <span className={`text-xs ${l.accessible ? "" : "text-muted-foreground"}`}>
                        {l.accessible ? "可访问" : "紧缩"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>释放: {formatNumber(l.msReleased)} MS</span>
                      <span className={l.accessible ? "text-green-500 font-medium" : "text-muted-foreground"}>
                        {l.accessible ? formatCurrency(l.earnings * aamPool.msPrice) : `(${formatNumber(l.earnings)} MS)`}
                      </span>
                    </div>
                  </div>
                ))}
                <div className="p-2.5 rounded-md bg-muted text-sm font-semibold">
                  <div className="flex items-center justify-between">
                    <span>合计</span>
                    <span className="text-green-500">{formatNumber(layerIncome.totalEarnings)} MS ≈ {formatCurrency(layerIncome.totalEarnings * aamPool.msPrice)}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">各层收益分布图</CardTitle>
              <CardDescription>绿色=可获得收益，灰色=紧缩收益</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[220px] md:h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={layerChartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} className="text-muted-foreground" />
                    <YAxis tick={{ fontSize: 12 }} className="text-muted-foreground" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        borderColor: 'hsl(var(--border))',
                        borderRadius: '6px',
                      }}
                      formatter={(value: number, name: string) => [
                        formatNumber(value) + ' MS',
                        name === 'earnings' ? '可得收益' : '紧缩收益'
                      ]}
                    />
                    <Bar dataKey="earnings" stackId="a" fill="hsl(var(--chart-2))" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="compressed" stackId="a" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">V1-V6 层级MS收益对比</CardTitle>
              <CardDescription>各等级可获得的层级MS收益</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Desktop: table */}
              <div className="hidden md:block rounded-md border overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>等级</TableHead>
                      <TableHead className="text-right">可访问层级</TableHead>
                      <TableHead className="text-right">MS收益</TableHead>
                      <TableHead className="text-right">USDC价值</TableHead>
                      <TableHead className="text-right">紧缩收益</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {levelComparisonAf.map(lc => (
                      <TableRow key={lc.level} className={lc.level === selectedLevel ? "bg-muted" : ""}>
                        <TableCell>
                          <Badge variant={lc.level === selectedLevel ? "default" : "outline"}>{lc.level}</Badge>
                        </TableCell>
                        <TableCell className="text-right">1-{lc.maxLayer} 层</TableCell>
                        <TableCell className="text-right tabular-nums text-green-500">{formatNumber(lc.earnings)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatCurrency(lc.earningsUsdc)}</TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">{formatNumber(lc.compressed)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {/* Mobile: compact cards */}
              <div className="md:hidden space-y-2">
                {levelComparisonAf.map(lc => (
                  <div key={lc.level} className={`p-2.5 rounded-md border text-sm ${lc.level === selectedLevel ? "bg-muted" : ""}`}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <Badge variant={lc.level === selectedLevel ? "default" : "outline"} className="text-xs">{lc.level}</Badge>
                        <span className="text-xs text-muted-foreground">1-{lc.maxLayer} 层</span>
                      </div>
                      <span className="font-medium text-green-500">{formatCurrency(lc.earningsUsdc)}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>MS: {formatNumber(lc.earnings)}</span>
                      <span>紧缩: {formatNumber(lc.compressed)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Trading Dividend */}
        <TabsContent value="trading-dividend" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">利润流转</CardTitle>
              <CardDescription>团队交易利润 → 扣除手续费 → 用户分成 → 经纪人分红池 / 平台</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Desktop: horizontal flow */}
              <div className="hidden md:flex items-center gap-3 p-4 rounded-md bg-muted flex-wrap">
                <div className="text-center">
                  <p className="text-xl font-bold">{formatCurrency(tradingMetrics.totalGross)}</p>
                  <p className="text-xs text-muted-foreground">毛利润</p>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground" />
                <div className="text-center">
                  <p className="text-xl font-bold text-red-500">-{formatCurrency(tradingMetrics.totalFee)}</p>
                  <p className="text-xs text-muted-foreground">手续费</p>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground" />
                <div className="text-center">
                  <p className="text-xl font-bold text-blue-500">-{formatCurrency(tradingMetrics.totalUserProfit)}</p>
                  <p className="text-xs text-muted-foreground">用户分成 ({tradingMetrics.profitSharePercent.toFixed(0)}%)</p>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground" />
                <div className="text-center">
                  <p className="text-xl font-bold text-green-500">{formatCurrency(tradingMetrics.brokerPool)}</p>
                  <p className="text-xs text-muted-foreground">经纪人分红池 (50%)</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold">{formatCurrency(tradingMetrics.platformShare)}</p>
                  <p className="text-xs text-muted-foreground">平台 (50%)</p>
                </div>
              </div>
              {/* Mobile: vertical flow */}
              <div className="md:hidden p-3 rounded-md bg-muted space-y-2">
                <div className="flex justify-between items-center p-2 rounded border">
                  <span className="text-xs text-muted-foreground">毛利润</span>
                  <span className="text-sm font-bold">{formatCurrency(tradingMetrics.totalGross)}</span>
                </div>
                <div className="flex justify-between items-center p-2 rounded border">
                  <span className="text-xs text-muted-foreground">手续费</span>
                  <span className="text-sm font-bold text-red-500">-{formatCurrency(tradingMetrics.totalFee)}</span>
                </div>
                <div className="flex justify-between items-center p-2 rounded border">
                  <span className="text-xs text-muted-foreground">用户分成 ({tradingMetrics.profitSharePercent.toFixed(0)}%)</span>
                  <span className="text-sm font-bold text-blue-500">-{formatCurrency(tradingMetrics.totalUserProfit)}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 rounded border border-green-500/30 text-center">
                    <p className="text-xs text-muted-foreground">经纪人分红池</p>
                    <p className="text-sm font-bold text-green-500">{formatCurrency(tradingMetrics.brokerPool)}</p>
                  </div>
                  <div className="p-2 rounded border text-center">
                    <p className="text-xs text-muted-foreground">平台</p>
                    <p className="text-sm font-bold">{formatCurrency(tradingMetrics.platformShare)}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">级差计算 ({selectedLevel} → {subordinateLevel === "none" ? "无下级" : subordinateLevel})</CardTitle>
              <CardDescription>
                本级比例 - 下级比例 = 差额收益
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="p-4 rounded-md border text-center">
                  <p className="text-lg md:text-2xl font-bold">{dividendResult.brokerRate}%</p>
                  <p className="text-xs text-muted-foreground">{selectedLevel} 分红比例</p>
                </div>
                <div className="p-4 rounded-md border text-center">
                  <p className="text-lg md:text-2xl font-bold">{dividendResult.subRate}%</p>
                  <p className="text-xs text-muted-foreground">{subordinateLevel === "none" ? "无下级" : subordinateLevel} 分红比例</p>
                </div>
                <div className="p-4 rounded-md border text-center">
                  <p className="text-lg md:text-2xl font-bold text-green-500">{dividendResult.differentialRate}%</p>
                  <p className="text-xs text-muted-foreground">差额比例</p>
                </div>
                <div className="p-4 rounded-md border text-center">
                  <p className="text-lg md:text-2xl font-bold text-green-500">{formatCurrency(dividendResult.earnings)}</p>
                  <p className="text-xs text-muted-foreground">分红收益</p>
                </div>
              </div>
              <div className="p-3 rounded-md bg-muted text-sm text-muted-foreground">
                分红池 {formatCurrency(tradingMetrics.brokerPool)} × 差额 {dividendResult.differentialRate}% = {formatCurrency(dividendResult.earnings)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">V1-V6 级差对比表</CardTitle>
              <CardDescription>假设每级的下级为前一级（V1无下级）</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Desktop: table */}
              <div className="hidden md:block rounded-md border overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>等级</TableHead>
                      <TableHead className="text-right">本级比例</TableHead>
                      <TableHead className="text-right">下级比例</TableHead>
                      <TableHead className="text-right">差额</TableHead>
                      <TableHead className="text-right">分红收益</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {levelComparisonDividend.map(lc => (
                      <TableRow key={lc.level} className={lc.level === selectedLevel ? "bg-muted" : ""}>
                        <TableCell>
                          <Badge variant={lc.level === selectedLevel ? "default" : "outline"}>{lc.level}</Badge>
                        </TableCell>
                        <TableCell className="text-right">{lc.brokerRate}%</TableCell>
                        <TableCell className="text-right">{lc.subRate}%</TableCell>
                        <TableCell className="text-right font-medium">{lc.diffRate}%</TableCell>
                        <TableCell className="text-right text-green-500">{formatCurrency(lc.earnings)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {/* Mobile: compact cards */}
              <div className="md:hidden space-y-2">
                {levelComparisonDividend.map(lc => (
                  <div key={lc.level} className={`p-2.5 rounded-md border text-sm ${lc.level === selectedLevel ? "bg-muted" : ""}`}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <Badge variant={lc.level === selectedLevel ? "default" : "outline"} className="text-xs">{lc.level}</Badge>
                        <span className="text-xs text-muted-foreground">{lc.brokerRate}% - {lc.subRate}% = {lc.diffRate}%</span>
                      </div>
                      <span className="font-medium text-green-500">{formatCurrency(lc.earnings)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Comprehensive Estimation */}
        <TabsContent value="estimation" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">订单→层级分布</CardTitle>
              <CardDescription>
                {hasOrders
                  ? `${stakingOrders.length} 笔实际订单依次分布在20层（第1笔→第1层，第2笔→第2层...）`
                  : "手动输入模式：每层均匀分配MS释放量"
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              {hasOrders ? (
                <>
                {/* Desktop: table */}
                <div className="hidden md:block rounded-md border overflow-auto max-h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>层级</TableHead>
                        <TableHead>订单</TableHead>
                        <TableHead className="text-right">铸造金额</TableHead>
                        <TableHead className="text-right">日MS释放</TableHead>
                        <TableHead className="text-right">MS价值 (USDC)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Array.from({ length: 20 }, (_, i) => {
                        const layerOrders = stakingOrders.filter((_, idx) => idx % 20 === i);
                        const layerAf = msReleasedPerLayer[i];
                        return (
                          <TableRow key={i}>
                            <TableCell>
                              <Badge variant={i < getMaxLayer(selectedLevel, config) ? "default" : "outline"}>
                                L{i + 1}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {layerOrders.length > 0
                                ? layerOrders.map(o => `#${o.id.slice(-4)}`).join(', ')
                                : <span className="text-muted-foreground">—</span>
                              }
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(layerOrders.reduce((s, o) => s + o.amount, 0))}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">{formatNumber(layerAf, 4)}</TableCell>
                            <TableCell className="text-right tabular-nums">{formatCurrency(layerAf * aamPool.msPrice)}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
                {/* Mobile: card list */}
                <div className="md:hidden space-y-2 max-h-[400px] overflow-auto">
                  {Array.from({ length: 20 }, (_, i) => {
                    const layerOrders = stakingOrders.filter((_, idx) => idx % 20 === i);
                    const layerAf = msReleasedPerLayer[i];
                    return (
                      <div key={i} className="p-2.5 rounded-md border text-sm">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <Badge variant={i < getMaxLayer(selectedLevel, config) ? "default" : "outline"} className="text-xs">
                              L{i + 1}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {layerOrders.length > 0
                                ? layerOrders.map(o => `#${o.id.slice(-4)}`).join(', ')
                                : "—"
                              }
                            </span>
                          </div>
                          <span className="text-xs font-medium">{formatCurrency(layerOrders.reduce((s, o) => s + o.amount, 0))}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>MS: {formatNumber(layerAf, 4)}</span>
                          <span>{formatCurrency(layerAf * aamPool.msPrice)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                </>
              ) : (
                <div className="p-4 rounded-md bg-muted text-center text-muted-foreground">
                  <Users className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p>暂无订单，使用手动输入模式</p>
                  <p className="text-xs mt-1">每层统一释放 {formatNumber(manualAfPerLayer)} MS</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">综合收益汇总 ({selectedLevel})</CardTitle>
              <CardDescription>MS释放层级收益 + 交易利润分红 合计</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-md border">
                    <div className="flex items-center gap-2 mb-2">
                      <Layers className="h-5 w-5 text-blue-500" />
                      <span className="font-medium">MS层级收益</span>
                    </div>
                    <p className="text-lg md:text-2xl font-bold">{formatNumber(layerIncome.totalEarnings)} MS</p>
                    <p className="text-sm text-muted-foreground">≈ {formatCurrency(layerIncome.totalEarnings * aamPool.msPrice)}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      可访问 {getMaxLayer(selectedLevel, config)} 层 / 20层
                    </p>
                  </div>
                  <div className="p-4 rounded-md border">
                    <div className="flex items-center gap-2 mb-2">
                      <DollarSign className="h-5 w-5 text-green-500" />
                      <span className="font-medium">交易分红</span>
                    </div>
                    <p className="text-lg md:text-2xl font-bold">{formatCurrency(dividendResult.earnings)}</p>
                    <p className="text-sm text-muted-foreground">
                      级差 {dividendResult.differentialRate}%
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {selectedLevel}({dividendResult.brokerRate}%) - {subordinateLevel === "none" ? "无下级" : subordinateLevel}({dividendResult.subRate}%)
                    </p>
                  </div>
                  <div className="p-4 rounded-md border bg-green-500/10">
                    <div className="flex items-center gap-2 mb-2">
                      <Award className="h-5 w-5 text-green-500" />
                      <span className="font-medium">日总收益</span>
                    </div>
                    <p className="text-lg md:text-2xl font-bold text-green-500">{formatCurrency(totalBrokerIncome)}</p>
                    <p className="text-sm text-muted-foreground">
                      MS价值 {formatCurrency(layerIncome.totalEarnings * aamPool.msPrice)} + 分红 {formatCurrency(dividendResult.earnings)}
                    </p>
                  </div>
                </div>

                {/* V1-V6 综合收益对比 */}
                {/* Desktop: table */}
                <div className="hidden md:block rounded-md border overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>等级</TableHead>
                        <TableHead className="text-right">MS层级收益</TableHead>
                        <TableHead className="text-right">交易分红</TableHead>
                        <TableHead className="text-right">日总收益</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {BROKER_LEVELS.map((level, idx) => {
                        const afIncome = levelComparisonAf[idx];
                        const divIncome = levelComparisonDividend[idx];
                        const total = afIncome.earningsUsdc + divIncome.earnings;
                        return (
                          <TableRow key={level} className={level === selectedLevel ? "bg-muted" : ""}>
                            <TableCell>
                              <Badge variant={level === selectedLevel ? "default" : "outline"}>{level}</Badge>
                            </TableCell>
                            <TableCell className="text-right tabular-nums">{formatCurrency(afIncome.earningsUsdc)}</TableCell>
                            <TableCell className="text-right tabular-nums">{formatCurrency(divIncome.earnings)}</TableCell>
                            <TableCell className="text-right tabular-nums font-medium text-green-500">{formatCurrency(total)}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
                {/* Mobile: compact cards */}
                <div className="md:hidden space-y-2">
                  {BROKER_LEVELS.map((level, idx) => {
                    const afIncome = levelComparisonAf[idx];
                    const divIncome = levelComparisonDividend[idx];
                    const total = afIncome.earningsUsdc + divIncome.earnings;
                    return (
                      <div key={level} className={`p-2.5 rounded-md border text-sm ${level === selectedLevel ? "bg-muted" : ""}`}>
                        <div className="flex items-center justify-between mb-1">
                          <Badge variant={level === selectedLevel ? "default" : "outline"} className="text-xs">{level}</Badge>
                          <span className="font-medium text-green-500">{formatCurrency(total)}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>MS: {formatCurrency(afIncome.earningsUsdc)}</span>
                          <span>分红: {formatCurrency(divIncome.earnings)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
