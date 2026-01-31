import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useConfigStore } from "@/hooks/use-config";
import { runSimulation as runStakingSimulation, formatNumber, formatCurrency } from "@/lib/calculations";
import {
  runCLMMSimulation,
  calculateLiquidity,
  calculateCapitalEfficiency,
  type CLMMDailyResult,
} from "@/lib/clmm-calculations";
import {
  Target,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Activity,
  Zap,
  ArrowUpDown,
  BarChart3,
  AlertCircle,
} from "lucide-react";
import {
  ComposedChart,
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceArea,
} from "recharts";

const FEE_TIERS = [
  { label: "0.05%", value: "0.0005" },
  { label: "0.3%", value: "0.003" },
  { label: "1%", value: "0.01" },
];

const tooltipStyle = {
  backgroundColor: "hsl(var(--card))",
  borderColor: "hsl(var(--border))",
  borderRadius: "6px",
};

export default function CLMMPage() {
  // Only CLMM-specific user controls
  const [feeTier, setFeeTier] = useState("0.003");
  const [rangeWidthPct, setRangeWidthPct] = useState(20);
  const [days, setDays] = useState(30);

  // Core state from store
  const { config, stakingOrders, aamPool, currentSimulationDay } = useConfigStore();

  // Effective simulation days
  const effectiveDays = days || currentSimulationDay || 30;

  // Run staking simulation to get buy/sell data
  const stakingSimData = useMemo(() => {
    if (stakingOrders.length === 0) return [];
    return runStakingSimulation(stakingOrders, config, effectiveDays, aamPool);
  }, [stakingOrders, config, effectiveDays, aamPool]);

  // Derive all CLMM parameters from the FINAL staking simulation state
  const derived = useMemo(() => {
    const lastDay = stakingSimData[stakingSimData.length - 1];

    // Use final simulation pool state (after all LP additions, buybacks, AF sells)
    const poolUsdc = lastDay ? lastDay.poolUsdcBalance : aamPool.usdcBalance;
    const poolAf = lastDay ? lastDay.poolAfBalance : aamPool.afBalance;
    const price = lastDay ? lastDay.afPrice : (aamPool.afPrice > 0 ? aamPool.afPrice : 0.1);

    const priceLower = price * (1 - rangeWidthPct / 100);
    const priceUpper = price * (1 + rangeWidthPct / 100);
    const depositX = poolAf * 0.1;
    const depositY = poolUsdc * 0.1;
    const totalLiquidity = lastDay ? lastDay.poolTotalValue : (poolUsdc + poolAf * price);

    // Per-day volumes from simulation (sell + buy)
    const dailyVolumes = stakingSimData.map(
      (r) => (r.afSellingRevenueUsdc || 0) + (r.buybackAmountUsdc || 0)
    );
    const avgDailyVolume =
      dailyVolumes.length > 0
        ? dailyVolumes.reduce((s, v) => s + v, 0) / dailyVolumes.length
        : 0;

    // Per-day sell / buy
    const dailySells = stakingSimData.map((r) => r.afSellingRevenueUsdc || 0);
    const dailyBuys = stakingSimData.map((r) => r.buybackAmountUsdc || 0);
    const avgDailySell =
      dailySells.length > 0
        ? dailySells.reduce((s, v) => s + v, 0) / dailySells.length
        : 0;
    const avgDailyBuy =
      dailyBuys.length > 0
        ? dailyBuys.reduce((s, v) => s + v, 0) / dailyBuys.length
        : 0;
    const netFlow = avgDailyBuy - avgDailySell;

    // Price trajectory from simulation
    const priceTrajectory = stakingSimData.map((r) => r.afPrice);

    return {
      price,
      priceLower,
      priceUpper,
      depositX,
      depositY,
      totalLiquidity,
      dailyVolumes,
      avgDailyVolume,
      dailySells,
      dailyBuys,
      avgDailySell,
      avgDailyBuy,
      netFlow,
      priceTrajectory,
    };
  }, [aamPool, stakingSimData, rangeWidthPct]);

  // Run CLMM simulation
  const simulationResults = useMemo((): CLMMDailyResult[] => {
    if (stakingOrders.length === 0) return [];
    return runCLMMSimulation({
      depositX: derived.depositX,
      depositY: derived.depositY,
      initialPrice: derived.price,
      priceLower: derived.priceLower,
      priceUpper: derived.priceUpper,
      feeTier: parseFloat(feeTier),
      dailyVolume: derived.avgDailyVolume,
      dailyVolumes: derived.dailyVolumes.length > 0 ? derived.dailyVolumes : undefined,
      totalLiquidity: derived.totalLiquidity,
      days: effectiveDays,
      priceTrajectory: derived.priceTrajectory.length > 0 ? derived.priceTrajectory : undefined,
    });
  }, [derived, feeTier, effectiveDays, stakingOrders.length]);

  // Derived summary values
  const liquidity = useMemo(
    () =>
      calculateLiquidity(
        derived.depositX,
        derived.depositY,
        derived.price,
        derived.priceLower,
        derived.priceUpper
      ),
    [derived]
  );

  const capitalEfficiency = useMemo(
    () => calculateCapitalEfficiency(derived.priceLower, derived.priceUpper),
    [derived.priceLower, derived.priceUpper]
  );

  const lastDay = simulationResults[simulationResults.length - 1];
  const totalFees = lastDay?.cumulativeFees ?? 0;
  const finalIL = lastDay?.impermanentLoss ?? 0;
  const finalILPct = lastDay?.impermanentLossPct ?? 0;
  const finalNetPnl = lastDay?.netPnl ?? 0;
  const finalPositionValue = lastDay?.positionValue ?? 0;
  const finalHodlValue = lastDay?.hodlValue ?? 0;

  // Chart data for CLMM results
  const chartData = useMemo(() => {
    return simulationResults.map((r) => ({
      day: r.day,
      price: r.price,
      positionValue: r.positionValue,
      hodlValue: r.hodlValue,
      tokenXValue: r.tokenX * r.price,
      tokenYValue: r.tokenY,
      cumulativeFees: r.cumulativeFees,
      v3Value: r.positionValue + r.cumulativeFees,
      v2Value: r.v2PositionValue,
      inRange: r.inRange,
    }));
  }, [simulationResults]);

  // Buy/sell trend chart data
  const buySellChartData = useMemo(() => {
    return stakingSimData.map((r, i) => ({
      day: r.day,
      sell: r.afSellingRevenueUsdc || 0,
      buy: r.buybackAmountUsdc || 0,
      net: (r.buybackAmountUsdc || 0) - (r.afSellingRevenueUsdc || 0),
    }));
  }, [stakingSimData]);

  // Last 10 days for table
  const tableData = useMemo(() => {
    if (simulationResults.length <= 10) return simulationResults;
    return simulationResults.slice(-10);
  }, [simulationResults]);

  // Empty state
  if (stakingOrders.length === 0) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">CLMM 集中流动性模拟</h1>
            <p className="text-muted-foreground">
              Uniswap V3 风格集中流动性仓位模拟，自动从质押模拟派生参数
            </p>
          </div>
          <Badge variant="outline" className="text-sm">
            <Target className="h-3 w-3 mr-1" />
            Concentrated Liquidity
          </Badge>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 space-y-4">
            <AlertCircle className="h-12 w-12 text-muted-foreground" />
            <h3 className="text-lg font-semibold">暂无质押订单</h3>
            <p className="text-muted-foreground text-center max-w-md">
              CLMM 模拟参数自动从质押模拟的买盘/卖盘数据派生。
              请先在「质押模拟」页面添加订单，然后返回此页面查看 CLMM 分析。
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">CLMM 集中流动性模拟</h1>
          <p className="text-muted-foreground">
            Uniswap V3 风格集中流动性仓位模拟，自动从质押模拟派生参数
          </p>
        </div>
        <Badge variant="outline" className="text-sm">
          <Target className="h-3 w-3 mr-1" />
          Concentrated Liquidity
        </Badge>
      </div>

      {/* Controls + Derived Parameters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">CLMM 参数设定</CardTitle>
          <CardDescription>
            仅需设定手续费档位、区间宽度和模拟天数，其余参数自动从质押模拟派生
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* User controls */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Fee Tier */}
            <div className="space-y-2">
              <Label>手续费档位</Label>
              <Select value={feeTier} onValueChange={setFeeTier}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FEE_TIERS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Range Width */}
            <div className="space-y-2">
              <Label>
                区间宽度: ±{rangeWidthPct}%
              </Label>
              <Slider
                value={[rangeWidthPct]}
                onValueChange={([v]) => setRangeWidthPct(v)}
                min={5}
                max={50}
                step={1}
              />
              <p className="text-xs text-muted-foreground">
                价格区间 [{derived.priceLower.toFixed(4)}, {derived.priceUpper.toFixed(4)}]
              </p>
            </div>

            {/* Simulation Days */}
            <div className="space-y-2">
              <Label>模拟天数: {effectiveDays} 天</Label>
              <Slider
                value={[days]}
                onValueChange={([v]) => setDays(v)}
                min={7}
                max={365}
                step={1}
              />
            </div>
          </div>

          {/* Derived parameters (read-only display) */}
          <div className="border-t pt-4">
            <Label className="text-sm text-muted-foreground mb-3 block">自动派生参数</Label>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">初始价格: ${derived.price.toFixed(4)}</Badge>
              <Badge variant="secondary">
                区间: ${derived.priceLower.toFixed(4)} — ${derived.priceUpper.toFixed(4)}
              </Badge>
              <Badge variant="secondary">
                AF 存入: {formatNumber(derived.depositX, 0)}
              </Badge>
              <Badge variant="secondary">
                USDC 存入: {formatCurrency(derived.depositY)}
              </Badge>
              <Badge variant="secondary">
                池 TVL: {formatCurrency(derived.totalLiquidity)}
              </Badge>
              <Badge variant="secondary">
                日均交易量: {formatCurrency(derived.avgDailyVolume)}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Buy/Sell Core Data Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-red-500" />
              日均卖盘
            </CardDescription>
            <CardTitle className="text-xl text-red-500">
              {formatCurrency(derived.avgDailySell)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">用户卖 AF (USDC)</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              日均买盘
            </CardDescription>
            <CardTitle className="text-xl text-green-500">
              {formatCurrency(derived.avgDailyBuy)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">平台回购 (USDC)</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <ArrowUpDown className="h-4 w-4" />
              净流向
            </CardDescription>
            <CardTitle
              className={`text-xl ${derived.netFlow >= 0 ? "text-green-500" : "text-red-500"}`}
            >
              {derived.netFlow >= 0 ? "+" : ""}
              {formatCurrency(derived.netFlow)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">买盘 − 卖盘</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              日均池内交易量
            </CardDescription>
            <CardTitle className="text-xl">
              {formatCurrency(derived.avgDailyVolume)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">卖盘 + 买盘</p>
          </CardContent>
        </Card>
      </div>

      {/* CLMM Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              流动性 (L)
            </CardDescription>
            <CardTitle className="text-xl">{formatNumber(liquidity, 0)}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              资本效率
            </CardDescription>
            <CardTitle className="text-xl">{formatNumber(capitalEfficiency, 1)}x</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">vs V2 全范围</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              LP 仓位价值
            </CardDescription>
            <CardTitle className="text-xl">{formatCurrency(finalPositionValue)}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              HODL 价值
            </CardDescription>
            <CardTitle className="text-xl">{formatCurrency(finalHodlValue)}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <ArrowUpDown className="h-4 w-4" />
              无常损失
            </CardDescription>
            <CardTitle className="text-xl text-orange-500">
              {formatCurrency(finalIL)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant={finalILPct > 0 ? "destructive" : "secondary"}>
              {finalILPct > 0 ? "-" : ""}
              {formatNumber(Math.abs(finalILPct), 2)}%
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              手续费收入
            </CardDescription>
            <CardTitle className="text-xl text-green-500">
              {formatCurrency(totalFees)}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              净损益
            </CardDescription>
            <CardTitle
              className={`text-xl ${finalNetPnl >= 0 ? "text-green-500" : "text-red-500"}`}
            >
              {finalNetPnl >= 0 ? "+" : ""}
              {formatCurrency(finalNetPnl)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">费用 − IL</p>
          </CardContent>
        </Card>
      </div>

      {/* Chart 1: Price Trajectory + Range Band */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">价格轨迹与区间</CardTitle>
          <CardDescription>
            蓝色区域为集中流动性区间 [{derived.priceLower.toFixed(4)},{" "}
            {derived.priceUpper.toFixed(4)}]
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 12 }}
                  tickFormatter={(v) => `Day ${v}`}
                  className="text-muted-foreground"
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  domain={["auto", "auto"]}
                  tickFormatter={(v) => `$${v.toFixed(3)}`}
                  className="text-muted-foreground"
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value: number, name: string) => {
                    if (name === "price") return [`$${value.toFixed(6)}`, "价格"];
                    return [value, name];
                  }}
                  labelFormatter={(label) => `Day ${label}`}
                />
                <ReferenceArea
                  y1={derived.priceLower}
                  y2={derived.priceUpper}
                  fill="hsl(var(--primary) / 0.15)"
                  stroke="hsl(var(--primary) / 0.4)"
                  strokeDasharray="3 3"
                  label={{
                    value: "LP 区间",
                    position: "insideTopRight",
                    fontSize: 11,
                    fill: "hsl(var(--primary))",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="price"
                  name="price"
                  stroke="hsl(var(--chart-1))"
                  strokeWidth={2}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Chart: Buy/Sell Trend */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">买卖盘走势</CardTitle>
          <CardDescription>每日卖盘 (红) vs 买盘 (绿) 及净流向 (线)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={buySellChartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 12 }}
                  tickFormatter={(v) => `Day ${v}`}
                  className="text-muted-foreground"
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickFormatter={(v) => `$${formatNumber(v, 0)}`}
                  className="text-muted-foreground"
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value: number, name: string) => {
                    const labels: Record<string, string> = {
                      sell: "卖盘",
                      buy: "买盘",
                      net: "净流向",
                    };
                    return [formatCurrency(value), labels[name] || name];
                  }}
                  labelFormatter={(label) => `Day ${label}`}
                />
                <Legend
                  formatter={(value: string) => {
                    const labels: Record<string, string> = {
                      sell: "卖盘",
                      buy: "买盘",
                      net: "净流向",
                    };
                    return labels[value] || value;
                  }}
                />
                <Bar dataKey="sell" name="sell" fill="#ef4444" opacity={0.8} />
                <Bar dataKey="buy" name="buy" fill="#22c55e" opacity={0.8} />
                <Line
                  type="monotone"
                  dataKey="net"
                  name="net"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Charts Row: Position vs HODL, Token Composition */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Chart 2: Position Value vs HODL */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">仓位价值 vs HODL</CardTitle>
            <CardDescription>LP 仓位与持币不动对比</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 12 }}
                    className="text-muted-foreground"
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    tickFormatter={(v) => `$${formatNumber(v, 0)}`}
                    className="text-muted-foreground"
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value: number) => [formatCurrency(value)]}
                    labelFormatter={(label) => `Day ${label}`}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="positionValue"
                    name="LP 仓位"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="hodlValue"
                    name="HODL"
                    stroke="hsl(var(--chart-2))"
                    strokeWidth={2}
                    dot={false}
                    strokeDasharray="5 5"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Chart 3: Token Composition (Stacked Area) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">代币组成</CardTitle>
            <CardDescription>AF 价值 + USDC 组成的仓位价值</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 12 }}
                    className="text-muted-foreground"
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    tickFormatter={(v) => `$${formatNumber(v, 0)}`}
                    className="text-muted-foreground"
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value: number) => [formatCurrency(value)]}
                    labelFormatter={(label) => `Day ${label}`}
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="tokenXValue"
                    name="AF 价值"
                    stackId="1"
                    stroke="hsl(var(--chart-1))"
                    fill="hsl(var(--chart-1) / 0.4)"
                  />
                  <Area
                    type="monotone"
                    dataKey="tokenYValue"
                    name="USDC"
                    stackId="1"
                    stroke="hsl(var(--chart-3))"
                    fill="hsl(var(--chart-3) / 0.4)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row: Cumulative Fees, V3 vs V2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Chart 4: Cumulative Fee Income */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">累计手续费收入</CardTitle>
            <CardDescription>仅在价格处于区间内时累积</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 12 }}
                    className="text-muted-foreground"
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    tickFormatter={(v) => `$${formatNumber(v, 0)}`}
                    className="text-muted-foreground"
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value: number) => [formatCurrency(value), "累计费用"]}
                    labelFormatter={(label) => `Day ${label}`}
                  />
                  <Area
                    type="monotone"
                    dataKey="cumulativeFees"
                    name="累计费用"
                    stroke="hsl(var(--chart-2))"
                    fill="hsl(var(--chart-2) / 0.3)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Chart 5: V3 vs V2 Comparison */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">V3 集中流动性 vs V2 全范围</CardTitle>
            <CardDescription>含手续费的仓位总价值对比</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 12 }}
                    className="text-muted-foreground"
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    tickFormatter={(v) => `$${formatNumber(v, 0)}`}
                    className="text-muted-foreground"
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value: number) => [formatCurrency(value)]}
                    labelFormatter={(label) => `Day ${label}`}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="v3Value"
                    name="V3 集中流动性"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="v2Value"
                    name="V2 全范围"
                    stroke="hsl(var(--chart-4))"
                    strokeWidth={2}
                    dot={false}
                    strokeDasharray="5 5"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Daily Detail Table (last 10 days) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            每日明细 (最后 {Math.min(10, simulationResults.length)} 天)
          </CardTitle>
          <CardDescription>逐日价格、仓位、费用与损益</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Day</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>In Range</TableHead>
                  <TableHead>AF</TableHead>
                  <TableHead>USDC</TableHead>
                  <TableHead>Position</TableHead>
                  <TableHead>HODL</TableHead>
                  <TableHead>IL</TableHead>
                  <TableHead>Fees</TableHead>
                  <TableHead>Net</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tableData.map((r) => (
                  <TableRow key={r.day}>
                    <TableCell className="font-medium">{r.day}</TableCell>
                    <TableCell>${r.price.toFixed(4)}</TableCell>
                    <TableCell>
                      <Badge
                        variant={r.inRange ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {r.inRange ? "Yes" : "No"}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatNumber(r.tokenX, 0)}</TableCell>
                    <TableCell>{formatCurrency(r.tokenY)}</TableCell>
                    <TableCell>{formatCurrency(r.positionValue)}</TableCell>
                    <TableCell>{formatCurrency(r.hodlValue)}</TableCell>
                    <TableCell className="text-orange-500">
                      {formatCurrency(r.impermanentLoss)}
                    </TableCell>
                    <TableCell className="text-green-500">
                      {formatCurrency(r.cumulativeFees)}
                    </TableCell>
                    <TableCell
                      className={r.netPnl >= 0 ? "text-green-500" : "text-red-500"}
                    >
                      {r.netPnl >= 0 ? "+" : ""}
                      {formatCurrency(r.netPnl)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
