import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { useConfigStore } from "@/hooks/use-config";
import { simulateAAMPool, formatNumber, formatCurrency } from "@/lib/calculations";
import { Droplets, TrendingUp, Flame, RefreshCw, DollarSign, Coins } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts";

export default function AAMPage() {
  const { aamPool, updateAAMPool, resetAAMPool } = useConfigStore();
  const [usdcToAdd, setUsdcToAdd] = useState(10000);
  const [afToAdd, setAfToAdd] = useState(100000);
  const [buybackAmount, setBuybackAmount] = useState(5000);
  const [burnAmount, setBurnAmount] = useState(2000);

  const simulatedPool = useMemo(() => {
    return simulateAAMPool(aamPool, usdcToAdd, afToAdd, buybackAmount, burnAmount);
  }, [aamPool, usdcToAdd, afToAdd, buybackAmount, burnAmount]);

  const priceChange = ((simulatedPool.afPrice / aamPool.afPrice) - 1) * 100;

  const priceSimulation = useMemo(() => {
    const data = [];
    let currentPool = { ...aamPool };
    
    for (let i = 0; i <= 30; i++) {
      data.push({
        day: i,
        price: currentPool.afPrice,
        usdc: currentPool.usdcBalance,
        af: currentPool.afBalance,
      });
      
      if (i < 30) {
        currentPool = simulateAAMPool(
          currentPool,
          usdcToAdd / 30,
          afToAdd / 30,
          buybackAmount / 30,
          burnAmount / 30
        );
      }
    }
    
    return data;
  }, [aamPool, usdcToAdd, afToAdd, buybackAmount, burnAmount]);

  const handleApplySimulation = () => {
    updateAAMPool(simulatedPool);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">AAM 池监控</h1>
          <p className="text-muted-foreground">LP 池规模、AF 币价变化与回购销毁</p>
        </div>
        <Button variant="outline" onClick={resetAAMPool} data-testid="button-reset-pool">
          <RefreshCw className="h-4 w-4 mr-2" />
          重置池状态
        </Button>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">模拟操作</CardTitle>
            <CardDescription>模拟添加流动性、回购和销毁</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>添加 USDC: {formatCurrency(usdcToAdd)}</Label>
              <Slider
                value={[usdcToAdd]}
                onValueChange={([v]) => setUsdcToAdd(v)}
                min={0}
                max={100000}
                step={1000}
                data-testid="slider-usdc"
              />
            </div>

            <div className="space-y-2">
              <Label>添加 AF: {formatNumber(afToAdd)}</Label>
              <Slider
                value={[afToAdd]}
                onValueChange={([v]) => setAfToAdd(v)}
                min={0}
                max={1000000}
                step={10000}
                data-testid="slider-af"
              />
            </div>

            <div className="space-y-2">
              <Label>回购 AF: {formatNumber(buybackAmount)}</Label>
              <Slider
                value={[buybackAmount]}
                onValueChange={([v]) => setBuybackAmount(v)}
                min={0}
                max={50000}
                step={1000}
                data-testid="slider-buyback"
              />
            </div>

            <div className="space-y-2">
              <Label>销毁 AF: {formatNumber(burnAmount)}</Label>
              <Slider
                value={[burnAmount]}
                onValueChange={([v]) => setBurnAmount(v)}
                min={0}
                max={50000}
                step={1000}
                data-testid="slider-burn"
              />
            </div>

            <Button className="w-full" onClick={handleApplySimulation} data-testid="button-apply">
              应用模拟结果
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">模拟结果预览</CardTitle>
            <CardDescription>操作后的池状态</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-md border">
                <p className="text-sm text-muted-foreground">新 USDC 余额</p>
                <p className="text-lg font-semibold">{formatCurrency(simulatedPool.usdcBalance)}</p>
                <p className="text-xs text-green-500">+{formatCurrency(usdcToAdd)}</p>
              </div>
              <div className="p-3 rounded-md border">
                <p className="text-sm text-muted-foreground">新 AF 余额</p>
                <p className="text-lg font-semibold">{formatNumber(simulatedPool.afBalance)}</p>
                <p className={`text-xs ${afToAdd - buybackAmount - burnAmount >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {afToAdd - buybackAmount - burnAmount >= 0 ? '+' : ''}{formatNumber(afToAdd - buybackAmount - burnAmount)}
                </p>
              </div>
            </div>

            <div className="p-4 rounded-md bg-muted">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm">新 AF 价格</span>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-bold">${simulatedPool.afPrice.toFixed(4)}</span>
                  <Badge variant={priceChange >= 0 ? "default" : "destructive"}>
                    {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
                  </Badge>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">新 LP 代币</span>
                <span className="font-medium">{formatNumber(simulatedPool.lpTokens)}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-md border">
                <p className="text-sm text-muted-foreground">累计回购</p>
                <p className="text-lg font-semibold">{formatNumber(simulatedPool.totalBuyback)} AF</p>
              </div>
              <div className="p-3 rounded-md border">
                <p className="text-sm text-muted-foreground">累计销毁</p>
                <p className="text-lg font-semibold">{formatNumber(simulatedPool.totalBurn)} AF</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">30天币价走势模拟</CardTitle>
          <CardDescription>按当前参数模拟 30 天的币价变化</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={priceSimulation}>
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
                <LineChart data={priceSimulation}>
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
                <LineChart data={priceSimulation}>
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
