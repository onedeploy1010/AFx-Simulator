import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useConfigStore } from "@/hooks/use-config";
import { PACKAGE_TIERS } from "@shared/schema";
import { Plus, Trash2, Coins, TrendingUp, Calculator, CircleDollarSign } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatNumber, formatCurrency } from "@/lib/calculations";

export default function StakingPage() {
  const { config, stakingOrders, aamPool, addStakingOrder, removeStakingOrder, clearStakingOrders } = useConfigStore();
  const { toast } = useToast();
  
  const [selectedTier, setSelectedTier] = useState<string>("1000");
  const [amount, setAmount] = useState<string>("1");
  
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
        afReleased: 0,
        tradingCapital: tier * packageConfig.tradingCapitalMultiplier,
      });
    }

    const daysText = config.stakingEnabled ? ` (${days}天)` : ' (即时释放)';
    toast({
      title: "订单已添加",
      description: `成功添加 ${count} 笔 ${tier} USDC 订单${daysText}`,
    });
    setAmount("1");
  };

  const totalStaked = stakingOrders.reduce((sum, order) => sum + order.amount, 0);
  const totalTradingCapital = stakingOrders.reduce((sum, order) => sum + order.tradingCapital, 0);
  const avgDailyRelease = stakingOrders.reduce((sum, order) => {
    const pkg = config.packageConfigs.find(p => p.tier === order.packageTier);
    return sum + (order.amount * (pkg?.afReleaseRate || 0) / 100);
  }, 0);

  const ordersByTier = PACKAGE_TIERS.map(tier => ({
    tier,
    count: stakingOrders.filter(o => o.packageTier === tier).length,
    total: stakingOrders.filter(o => o.packageTier === tier).reduce((sum, o) => sum + o.amount, 0),
  })).filter(t => t.count > 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">质押模拟</h1>
          <p className="text-muted-foreground">支持用户叠加多笔质押订单</p>
        </div>
        <Button variant="destructive" onClick={clearStakingOrders} disabled={stakingOrders.length === 0} data-testid="button-clear-orders">
          <Trash2 className="h-4 w-4 mr-2" />
          清空所有
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>总质押金额</CardDescription>
            <CardTitle className="text-3xl">{formatCurrency(totalStaked)}</CardTitle>
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
            <CardTitle className="text-3xl">{formatCurrency(totalTradingCapital)}</CardTitle>
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
            <CardDescription>预估日释放 AF</CardDescription>
            <CardTitle className="text-3xl">{formatNumber(avgDailyRelease)} AF</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Calculator className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {config.afReleaseMode === 'gold_standard' ? '金本位模式' : '币本位模式'}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>当前 AF 价格</CardDescription>
            <CardTitle className="text-3xl">${aamPool.afPrice.toFixed(4)}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <CircleDollarSign className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                LP池: {formatCurrency(aamPool.usdcBalance)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">添加质押订单</CardTitle>
          <CardDescription>选择配套档位和数量</CardDescription>
        </CardHeader>
        <CardContent>
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
                        {tier} USDC ({pkg?.afReleaseRate}%/日, {pkg?.tradingCapitalMultiplier}x交易金)
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
                <Label>质押周期(天)</Label>
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
              质押周期已禁用，AF 将立即释放
            </div>
          )}
          </div>
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
            <CardDescription>所有质押订单列表</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>档位</TableHead>
                    <TableHead>质押金额</TableHead>
                    <TableHead>交易金</TableHead>
                    <TableHead>日释放率</TableHead>
                    {config.stakingEnabled && <TableHead>质押周期</TableHead>}
                    <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stakingOrders.slice(0, 20).map((order) => {
                    const pkg = config.packageConfigs.find(p => p.tier === order.packageTier);
                    return (
                      <TableRow key={order.id}>
                        <TableCell>
                          <Badge variant="outline">{order.packageTier} USDC</Badge>
                        </TableCell>
                        <TableCell>{formatCurrency(order.amount)}</TableCell>
                        <TableCell>{formatCurrency(order.tradingCapital)}</TableCell>
                        <TableCell>{pkg?.afReleaseRate}%</TableCell>
                        {config.stakingEnabled && <TableCell>{order.daysStaked} 天</TableCell>}
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeStakingOrder(order.id)}
                            data-testid={`button-remove-${order.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
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
              <p>暂无质押订单</p>
              <p className="text-sm">添加质押订单开始模拟</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
