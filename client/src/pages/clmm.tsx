import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useConfigStore } from "@/hooks/use-config";
import { runSimulation as runStakingSimulation, formatNumber, formatCurrency } from "@/lib/calculations";
import {
  runCLMMSimulation,
  calculateLiquidity,
  calculateCapitalEfficiency,
  type CLMMSimulationParams,
  type CLMMDailyResult,
} from "@/lib/clmm-calculations";
import {
  Target,
  TrendingUp,
  DollarSign,
  Activity,
  Zap,
  ArrowUpDown,
  BarChart3,
} from "lucide-react";
import {
  ComposedChart,
  LineChart,
  Line,
  AreaChart,
  Area,
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

const DAY_PRESETS = [7, 14, 30, 60, 90];

const tooltipStyle = {
  backgroundColor: "hsl(var(--card))",
  borderColor: "hsl(var(--border))",
  borderRadius: "6px",
};

export default function CLMMPage() {
  // Inputs
  const [depositX, setDepositX] = useState(10000);
  const [depositY, setDepositY] = useState(1000);
  const [priceLower, setPriceLower] = useState(0.08);
  const [priceUpper, setPriceUpper] = useState(0.12);
  const [feeTier, setFeeTier] = useState("0.003");
  const [dailyVolume, setDailyVolume] = useState(500000);
  const [totalLiquidity, setTotalLiquidity] = useState(5000000);
  const [days, setDays] = useState(30);
  const [manualPriceChangePct, setManualPriceChangePct] = useState(0);
  const [useStakingPrices, setUseStakingPrices] = useState(false);

  // Get staking simulation data for price trajectory
  const { config, stakingOrders, aamPool } = useConfigStore();

  const initialPrice = useMemo(() => {
    return aamPool.afPrice > 0 ? aamPool.afPrice : 0.1;
  }, [aamPool.afPrice]);

  // Build price trajectory from staking simulation
  const stakingPriceTrajectory = useMemo(() => {
    if (!useStakingPrices || stakingOrders.length === 0) return undefined;
    const results = runStakingSimulation(stakingOrders, config, days, aamPool);
    return results.map((r) => r.afPrice);
  }, [useStakingPrices, stakingOrders, config, days, aamPool]);

  // Run CLMM simulation
  const simulationResults = useMemo((): CLMMDailyResult[] => {
    const params: CLMMSimulationParams = {
      depositX,
      depositY,
      initialPrice,
      priceLower,
      priceUpper,
      feeTier: parseFloat(feeTier),
      dailyVolume,
      totalLiquidity,
      days,
      priceTrajectory: useStakingPrices ? stakingPriceTrajectory : undefined,
      manualPriceChangePct: useStakingPrices ? undefined : manualPriceChangePct,
    };
    return runCLMMSimulation(params);
  }, [
    depositX, depositY, initialPrice, priceLower, priceUpper,
    feeTier, dailyVolume, totalLiquidity, days,
    useStakingPrices, stakingPriceTrajectory, manualPriceChangePct,
  ]);

  // Derived summary values
  const liquidity = useMemo(
    () => calculateLiquidity(depositX, depositY, initialPrice, priceLower, priceUpper),
    [depositX, depositY, initialPrice, priceLower, priceUpper]
  );

  const capitalEfficiency = useMemo(
    () => calculateCapitalEfficiency(priceLower, priceUpper),
    [priceLower, priceUpper]
  );

  const lastDay = simulationResults[simulationResults.length - 1];
  const totalFees = lastDay?.cumulativeFees ?? 0;
  const finalIL = lastDay?.impermanentLoss ?? 0;
  const finalILPct = lastDay?.impermanentLossPct ?? 0;
  const finalNetPnl = lastDay?.netPnl ?? 0;
  const finalPositionValue = lastDay?.positionValue ?? 0;
  const finalHodlValue = lastDay?.hodlValue ?? 0;

  // Chart data
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

  // Last 10 days for table
  const tableData = useMemo(() => {
    if (simulationResults.length <= 10) return simulationResults;
    return simulationResults.slice(-10);
  }, [simulationResults]);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">CLMM 集中流动性模拟</h1>
          <p className="text-muted-foreground">
            Uniswap V3 风格集中流动性仓位模拟，对比全范围 AMM
          </p>
        </div>
        <Badge variant="outline" className="text-sm">
          <Target className="h-3 w-3 mr-1" />
          Concentrated Liquidity
        </Badge>
      </div>

      {/* Input Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">仓位参数</CardTitle>
          <CardDescription>设定存入量、价格区间与费率</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* AF Deposit */}
            <div className="space-y-2">
              <Label htmlFor="depositX">AF 存入量</Label>
              <Input
                id="depositX"
                type="number"
                value={depositX}
                onChange={(e) => setDepositX(parseFloat(e.target.value) || 0)}
              />
            </div>

            {/* USDC Deposit */}
            <div className="space-y-2">
              <Label htmlFor="depositY">USDC 存入量</Label>
              <Input
                id="depositY"
                type="number"
                value={depositY}
                onChange={(e) => setDepositY(parseFloat(e.target.value) || 0)}
              />
            </div>

            {/* Price Lower */}
            <div className="space-y-2">
              <Label htmlFor="priceLower">价格下界 (Pa)</Label>
              <Input
                id="priceLower"
                type="number"
                step="0.001"
                value={priceLower}
                onChange={(e) => setPriceLower(parseFloat(e.target.value) || 0)}
              />
            </div>

            {/* Price Upper */}
            <div className="space-y-2">
              <Label htmlFor="priceUpper">价格上界 (Pb)</Label>
              <Input
                id="priceUpper"
                type="number"
                step="0.001"
                value={priceUpper}
                onChange={(e) => setPriceUpper(parseFloat(e.target.value) || 0)}
              />
            </div>

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

            {/* Daily Volume */}
            <div className="space-y-2">
              <Label htmlFor="dailyVolume">日交易量 (USDC)</Label>
              <Input
                id="dailyVolume"
                type="number"
                value={dailyVolume}
                onChange={(e) => setDailyVolume(parseFloat(e.target.value) || 0)}
              />
            </div>

            {/* Total Liquidity */}
            <div className="space-y-2">
              <Label htmlFor="totalLiquidity">池总流动性</Label>
              <Input
                id="totalLiquidity"
                type="number"
                value={totalLiquidity}
                onChange={(e) => setTotalLiquidity(parseFloat(e.target.value) || 0)}
              />
            </div>

            {/* Initial Price (read-only from pool) */}
            <div className="space-y-2">
              <Label>初始价格 (来自 AAM 池)</Label>
              <Input value={`$${initialPrice.toFixed(6)}`} readOnly className="bg-muted" />
            </div>
          </div>

          {/* Simulation days slider */}
          <div className="mt-6 space-y-3">
            <div className="flex items-center justify-between">
              <Label>模拟天数: {days} 天</Label>
              <div className="flex gap-1">
                {DAY_PRESETS.map((d) => (
                  <Button
                    key={d}
                    variant={days === d ? "default" : "outline"}
                    size="sm"
                    onClick={() => setDays(d)}
                  >
                    {d}天
                  </Button>
                ))}
              </div>
            </div>
            <Slider
              value={[days]}
              onValueChange={([v]) => setDays(v)}
              min={7}
              max={365}
              step={1}
            />
          </div>

          {/* Price trajectory toggle */}
          <div className="mt-4 flex items-center justify-between p-4 rounded-lg border">
            <div className="space-y-0.5">
              <Label>价格轨迹来源</Label>
              <p className="text-xs text-muted-foreground">
                {useStakingPrices
                  ? "使用质押订单模拟的价格轨迹"
                  : "使用手动设定的日涨跌幅"
                }
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">手动</span>
              <Switch
                checked={useStakingPrices}
                onCheckedChange={setUseStakingPrices}
              />
              <span className="text-sm text-muted-foreground">质押模拟</span>
            </div>
          </div>

          {/* Manual price change slider (shown when not using staking prices) */}
          {!useStakingPrices && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between">
                <Label>日价格变化: {manualPriceChangePct > 0 ? "+" : ""}{manualPriceChangePct.toFixed(1)}%</Label>
              </div>
              <Slider
                value={[manualPriceChangePct]}
                onValueChange={([v]) => setManualPriceChangePct(v)}
                min={-5}
                max={5}
                step={0.1}
              />
            </div>
          )}

          {useStakingPrices && stakingOrders.length === 0 && (
            <p className="mt-2 text-sm text-orange-500">
              暂无质押订单，请先在质押模拟页面添加订单
            </p>
          )}
        </CardContent>
      </Card>

      {/* Summary Cards */}
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
              {finalILPct > 0 ? "-" : ""}{formatNumber(Math.abs(finalILPct), 2)}%
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
            <CardTitle className={`text-xl ${finalNetPnl >= 0 ? "text-green-500" : "text-red-500"}`}>
              {finalNetPnl >= 0 ? "+" : ""}{formatCurrency(finalNetPnl)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">费用 - IL</p>
          </CardContent>
        </Card>
      </div>

      {/* Chart 1: Price Trajectory + Range Band */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">价格轨迹与区间</CardTitle>
          <CardDescription>
            蓝色区域为集中流动性区间 [{priceLower}, {priceUpper}]
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
                  y1={priceLower}
                  y2={priceUpper}
                  fill="hsl(var(--primary) / 0.15)"
                  stroke="hsl(var(--primary) / 0.4)"
                  strokeDasharray="3 3"
                  label={{ value: "LP 区间", position: "insideTopRight", fontSize: 11, fill: "hsl(var(--primary))" }}
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
          <CardTitle className="text-lg">每日明细 (最后 {Math.min(10, simulationResults.length)} 天)</CardTitle>
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
                      <Badge variant={r.inRange ? "default" : "secondary"} className="text-xs">
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
                    <TableCell className={r.netPnl >= 0 ? "text-green-500" : "text-red-500"}>
                      {r.netPnl >= 0 ? "+" : ""}{formatCurrency(r.netPnl)}
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
