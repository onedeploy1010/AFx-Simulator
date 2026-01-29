import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useConfigStore } from "@/hooks/use-config";
import { BROKER_LEVELS } from "@shared/schema";
import { calculateBrokerLayerEarnings, formatNumber, formatCurrency, calculateInitialPrice } from "@/lib/calculations";
import { Users, TrendingUp, Award, Layers } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

export default function BrokerPage() {
  const { config, aamPool } = useConfigStore();
  const [selectedLevel, setSelectedLevel] = useState<string>("V1");
  const [afReleased, setAfReleased] = useState(1000);
  const [teamSize, setTeamSize] = useState(100);

  const layerEarnings = useMemo(() => {
    return calculateBrokerLayerEarnings(afReleased, selectedLevel, config);
  }, [afReleased, selectedLevel, config]);

  const totalLayerEarnings = layerEarnings.reduce((sum, l) => sum + l.earnings, 0);

  const levelConfig = config.brokerLayerDistribution.find(l => l.level === selectedLevel);
  const levelIndex = BROKER_LEVELS.indexOf(selectedLevel as typeof BROKER_LEVELS[number]);
  const promotionRatio = config.brokerPromotionRatios[levelIndex] || 0;

  const promotionEarnings = afReleased * (promotionRatio / 100);

  const levelComparisonData = BROKER_LEVELS.map((level, idx) => {
    const dist = config.brokerLayerDistribution.find(l => l.level === level);
    const layerCount = dist?.layers.length || 0;
    const ratePerLayer = dist?.ratePerLayer || 0;
    return {
      level,
      promotionRatio: config.brokerPromotionRatios[idx],
      layerCount,
      totalLayerRate: layerCount * ratePerLayer,
      earnings: afReleased * (config.brokerPromotionRatios[idx] / 100),
    };
  });

  const layerDistributionData = config.brokerLayerDistribution.map(dist => ({
    level: dist.level,
    layers: dist.layers.length,
    rate: dist.ratePerLayer,
    total: dist.layers.length * dist.ratePerLayer,
  }));

  const pieColors = [
    "hsl(var(--chart-1))",
    "hsl(var(--chart-2))",
    "hsl(var(--chart-3))",
    "hsl(var(--chart-4))",
    "hsl(var(--chart-5))",
    "hsl(var(--primary))",
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">经纪人系统</h1>
          <p className="text-muted-foreground">V1-V6 推广收益与层级分配</p>
        </div>
        <Badge variant="outline" className="text-lg px-4 py-2">
          {selectedLevel}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">模拟参数</CardTitle>
            <CardDescription>设置经纪人等级和下级释放量</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>经纪人等级</Label>
              <Select value={selectedLevel} onValueChange={setSelectedLevel}>
                <SelectTrigger data-testid="select-level">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BROKER_LEVELS.map((level, idx) => (
                    <SelectItem key={level} value={level}>
                      {level} - 推广收益 {config.brokerPromotionRatios[idx]}%
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>下级 AF 释放量: {formatNumber(afReleased)}</Label>
              <Slider
                value={[afReleased]}
                onValueChange={([v]) => setAfReleased(v)}
                min={100}
                max={100000}
                step={100}
                data-testid="slider-af-released"
              />
            </div>

            <div className="space-y-2">
              <Label>团队人数: {teamSize}</Label>
              <Slider
                value={[teamSize]}
                onValueChange={([v]) => setTeamSize(v)}
                min={10}
                max={1000}
                step={10}
                data-testid="slider-team-size"
              />
            </div>

            <div className="p-4 rounded-md bg-muted space-y-2">
              <div className="flex justify-between text-sm">
                <span>推广收益比例</span>
                <span className="font-medium">{promotionRatio}%</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>管理层级</span>
                <span className="font-medium">
                  {levelConfig?.layers[0]}-{levelConfig?.layers[levelConfig.layers.length - 1]} 层
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span>每层分配率</span>
                <span className="font-medium">{levelConfig?.ratePerLayer}%</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">收益计算</CardTitle>
            <CardDescription>基于当前参数的收益估算</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-md border text-center">
                <TrendingUp className="h-8 w-8 mx-auto mb-2 text-primary" />
                <p className="text-2xl font-bold">{formatNumber(promotionEarnings)}</p>
                <p className="text-xs text-muted-foreground">推广收益 (AF)</p>
              </div>
              <div className="p-4 rounded-md border text-center">
                <Layers className="h-8 w-8 mx-auto mb-2 text-chart-2" />
                <p className="text-2xl font-bold">{formatNumber(totalLayerEarnings)}</p>
                <p className="text-xs text-muted-foreground">层级收益 (AF)</p>
              </div>
              <div className="p-4 rounded-md border text-center">
                <Award className="h-8 w-8 mx-auto mb-2 text-chart-3" />
                <p className="text-2xl font-bold">{formatNumber(promotionEarnings + totalLayerEarnings)}</p>
                <p className="text-xs text-muted-foreground">总收益 (AF)</p>
              </div>
              <div className="p-4 rounded-md border text-center">
                <Users className="h-8 w-8 mx-auto mb-2 text-chart-4" />
                <p className="text-2xl font-bold">{formatNumber((promotionEarnings + totalLayerEarnings) / teamSize)}</p>
                <p className="text-xs text-muted-foreground">人均收益 (AF)</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">各等级推广收益对比</CardTitle>
            <CardDescription>基于当前 AF 释放量的各等级收益</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={levelComparisonData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="level" tick={{ fontSize: 12 }} className="text-muted-foreground" />
                  <YAxis tick={{ fontSize: 12 }} className="text-muted-foreground" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      borderColor: 'hsl(var(--border))',
                      borderRadius: '6px',
                    }}
                    formatter={(value: number) => [formatNumber(value) + ' AF', '推广收益']}
                  />
                  <Bar dataKey="earnings" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">层级分配占比</CardTitle>
            <CardDescription>20 层分配给各等级经纪人的比例</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={layerDistributionData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="total"
                    label={({ level, total }) => `${level}: ${total}%`}
                  >
                    {layerDistributionData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={pieColors[index % pieColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      borderColor: 'hsl(var(--border))',
                      borderRadius: '6px',
                    }}
                    formatter={(value: number, name: string, props: any) => [
                      `${value}% (${props.payload.layers}层 × ${props.payload.rate}%)`,
                      props.payload.level
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">层级收益明细 ({selectedLevel})</CardTitle>
          <CardDescription>当前等级各层的 AF 收益分配</CardDescription>
        </CardHeader>
        <CardContent>
          {layerEarnings.length > 0 ? (
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>层级</TableHead>
                    <TableHead>分配比例</TableHead>
                    <TableHead>AF 收益</TableHead>
                    <TableHead>USDC 价值 (按 ${aamPool.afPrice.toFixed(4)})</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {layerEarnings.map((earning) => (
                    <TableRow key={earning.layer}>
                      <TableCell>
                        <Badge variant="outline">第 {earning.layer} 层</Badge>
                      </TableCell>
                      <TableCell>{levelConfig?.ratePerLayer}%</TableCell>
                      <TableCell>{formatNumber(earning.earnings)} AF</TableCell>
                      <TableCell>{formatCurrency(earning.earnings * aamPool.afPrice)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted">
                    <TableCell colSpan={2} className="font-medium">合计</TableCell>
                    <TableCell className="font-medium">{formatNumber(totalLayerEarnings)} AF</TableCell>
                    <TableCell className="font-medium">{formatCurrency(totalLayerEarnings * aamPool.afPrice)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="p-8 text-center text-muted-foreground">
              <Layers className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>暂无层级数据</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">经纪人等级总览</CardTitle>
          <CardDescription>各等级的推广比例与层级分配</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>等级</TableHead>
                  <TableHead>推广收益比例</TableHead>
                  <TableHead>管理层级</TableHead>
                  <TableHead>每层分配</TableHead>
                  <TableHead>层级总计</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {config.brokerLayerDistribution.map((dist, idx) => (
                  <TableRow key={dist.level} className={dist.level === selectedLevel ? "bg-muted" : ""}>
                    <TableCell>
                      <Badge variant={dist.level === selectedLevel ? "default" : "outline"}>
                        {dist.level}
                      </Badge>
                    </TableCell>
                    <TableCell>{config.brokerPromotionRatios[idx]}%</TableCell>
                    <TableCell>第 {dist.layers[0]}-{dist.layers[dist.layers.length - 1]} 层</TableCell>
                    <TableCell>{dist.ratePerLayer}%/层</TableCell>
                    <TableCell>{(dist.layers.length * dist.ratePerLayer).toFixed(1)}%</TableCell>
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
