import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useConfigStore } from "@/hooks/use-config";
import { calculateTradingSimulation, formatNumber, formatCurrency, formatPercent } from "@/lib/calculations";
import { Calculator, TrendingUp, Users, Building, Coins, ArrowRight } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { PACKAGE_TIERS } from "@shared/schema";

export default function TradingPage() {
  const { config, stakingOrders } = useConfigStore();
  const [tradingCapital, setTradingCapital] = useState(10000);
  const [selectedTier, setSelectedTier] = useState<string>("1000");

  const totalStaked = stakingOrders.reduce((sum, o) => sum + o.amount, 0);
  const totalTradingCapital = stakingOrders.reduce((sum, o) => sum + o.tradingCapital, 0);

  const selectedPackage = config.packageConfigs.find(p => p.tier === parseInt(selectedTier));
  const feeRate = selectedPackage?.tradingFeeRate || 5;
  const profitRate = selectedPackage?.tradingProfitRate || 3;
  const profitSharePercent = selectedPackage?.profitSharePercent || 60;

  const simulation = useMemo(() => {
    return calculateTradingSimulation(
      tradingCapital,
      profitRate / 100,
      feeRate,
      profitSharePercent,
      config
    );
  }, [tradingCapital, profitRate, feeRate, profitSharePercent, config]);
  
  const grossProfit = tradingCapital * (profitRate / 100);
  const netProfit = grossProfit - simulation.tradingFee;

  const profitDistribution = [
    { name: "用户收益", value: simulation.userProfit, color: "hsl(var(--chart-2))" },
    { name: "平台收益", value: simulation.platformProfit, color: "hsl(var(--chart-1))" },
    { name: "经纪人收益", value: simulation.brokerProfit, color: "hsl(var(--chart-4))" },
  ];

  const fundFlow = [
    { name: "LP 池 (USDC+AF)", value: simulation.lpContribution, color: "hsl(var(--chart-1))" },
    { name: "回购 AF", value: simulation.buybackAmount, color: "hsl(var(--chart-2))" },
    { name: "外汇储备金", value: simulation.reserveAmount, color: "hsl(var(--chart-3))" },
  ];

  const packageFeeData = config.packageConfigs.map(pkg => ({
    tier: `${pkg.tier}`,
    feeRate: pkg.tradingFeeRate,
    profitRate: pkg.tradingProfitRate,
    profitShare: pkg.profitSharePercent,
  }));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">交易模拟</h1>
          <p className="text-muted-foreground">手续费消耗、利润分配与资金流向</p>
        </div>
        {totalStaked > 0 && (
          <Badge variant="outline">
            当前质押: {formatCurrency(totalStaked)}
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">模拟参数</CardTitle>
            <CardDescription>选择配套档位和交易金额</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Label>配套档位</Label>
              <Select value={selectedTier} onValueChange={setSelectedTier}>
                <SelectTrigger data-testid="select-package-tier">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PACKAGE_TIERS.map((tier) => {
                    const pkg = config.packageConfigs.find(p => p.tier === tier);
                    return (
                      <SelectItem key={tier} value={tier.toString()}>
                        {tier} USDC (手续费{pkg?.tradingFeeRate}%, 利润{pkg?.tradingProfitRate}%)
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <Label>交易本金</Label>
              <Input
                type="number"
                value={tradingCapital}
                onChange={(e) => setTradingCapital(parseFloat(e.target.value) || 0)}
                min={0}
                data-testid="input-trading-capital"
              />
              <div className="flex gap-2 flex-wrap">
                {[1000, 5000, 10000, 50000, 100000].map(v => (
                  <Button
                    key={v}
                    variant={tradingCapital === v ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTradingCapital(v)}
                  >
                    {formatCurrency(v)}
                  </Button>
                ))}
              </div>
            </div>

            <div className="p-4 rounded-md bg-muted space-y-2">
              <div className="flex justify-between text-sm">
                <span>手续费率</span>
                <span className="font-medium">{formatPercent(feeRate)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>利润率</span>
                <span className="font-medium">{formatPercent(profitRate)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>手续费金额</span>
                <span className="font-medium">{formatCurrency(simulation.tradingFee)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>用户分润比例</span>
                <span className="font-medium">{profitSharePercent}%</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
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
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              用户收益
            </CardDescription>
            <CardTitle className="text-2xl text-green-500">{formatCurrency(simulation.userProfit)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {profitSharePercent}% 分润 | 净利润的 {netProfit > 0 ? formatPercent(simulation.userProfit / netProfit * 100) : '0%'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Building className="h-4 w-4" />
              平台收益
            </CardDescription>
            <CardTitle className="text-2xl">{formatCurrency(simulation.platformProfit)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              剩余利润的 50%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              经纪人收益
            </CardDescription>
            <CardTitle className="text-2xl">{formatCurrency(simulation.brokerProfit)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              剩余利润的 50%
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">利润分配</CardTitle>
            <CardDescription>扣除手续费后的利润分配</CardDescription>
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
            <CardDescription>交易资金的分配</CardDescription>
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
          <CardTitle className="text-lg">资金流详情</CardTitle>
          <CardDescription>每笔交易的资金拆分明细</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-4 rounded-md bg-muted flex-wrap">
              <div className="text-center">
                <p className="text-2xl font-bold">{formatCurrency(tradingCapital)}</p>
                <p className="text-xs text-muted-foreground">交易本金</p>
              </div>
              <ArrowRight className="h-6 w-6 text-muted-foreground" />
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-500">+{formatCurrency(grossProfit)}</p>
                <p className="text-xs text-muted-foreground">毛利润 ({profitRate}%)</p>
              </div>
              <ArrowRight className="h-6 w-6 text-muted-foreground" />
              <div className="text-center">
                <p className="text-2xl font-bold text-red-500">-{formatCurrency(simulation.tradingFee)}</p>
                <p className="text-xs text-muted-foreground">手续费 (毛利润×{formatPercent(feeRate)})</p>
              </div>
              <ArrowRight className="h-6 w-6 text-muted-foreground" />
              <div className="text-center">
                <p className="text-2xl font-bold text-green-500">{formatCurrency(netProfit)}</p>
                <p className="text-xs text-muted-foreground">净利润</p>
              </div>
            </div>

            <div className="mb-3">
              <p className="text-sm text-muted-foreground mb-2">交易资金流拆分 (基于交易本金 {formatCurrency(tradingCapital)})</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="p-3 rounded-md border">
                <p className="text-sm text-muted-foreground">LP 池 (USDC)</p>
                <p className="text-lg font-semibold">{formatCurrency(tradingCapital * config.lpPoolUsdcRatio / 100)}</p>
                <p className="text-xs text-muted-foreground">{config.lpPoolUsdcRatio}% 交易金</p>
              </div>
              <div className="p-3 rounded-md border">
                <p className="text-sm text-muted-foreground">LP 池 (AF)</p>
                <p className="text-lg font-semibold">{formatCurrency(tradingCapital * config.lpPoolAfRatio / 100)}</p>
                <p className="text-xs text-muted-foreground">{config.lpPoolAfRatio}% 交易金</p>
              </div>
              <div className="p-3 rounded-md border">
                <p className="text-sm text-muted-foreground">回购 AF</p>
                <p className="text-lg font-semibold">{formatCurrency(simulation.buybackAmount)}</p>
                <p className="text-xs text-muted-foreground">{config.buybackRatio}% 交易金</p>
              </div>
              <div className="p-3 rounded-md border">
                <p className="text-sm text-muted-foreground">外汇储备金</p>
                <p className="text-lg font-semibold">{formatCurrency(simulation.reserveAmount)}</p>
                <p className="text-xs text-muted-foreground">{config.reserveRatio}% 交易金</p>
              </div>
              <div className="p-3 rounded-md border">
                <p className="text-sm text-muted-foreground">手续费总计</p>
                <p className="text-lg font-semibold">{formatCurrency(simulation.tradingFee)}</p>
                <p className="text-xs text-muted-foreground">毛利润×{formatPercent(feeRate)}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
