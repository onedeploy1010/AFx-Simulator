import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useConfigStore } from "@/hooks/use-config";
import { PACKAGE_TIERS, PROFIT_SHARE_TIERS } from "@shared/schema";
import { RotateCcw, Save, Settings, Coins, TrendingUp, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function ConfigPage() {
  const { config, setConfig, resetConfig } = useConfigStore();
  const { toast } = useToast();

  const handleReset = () => {
    resetConfig();
    toast({
      title: "配置已重置",
      description: "所有参数已恢复为默认值",
    });
  };

  const handleSave = () => {
    toast({
      title: "配置已保存",
      description: "参数配置已更新并自动保存",
    });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">参数配置</h1>
          <p className="text-muted-foreground">统一修改所有参数与公式来源</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleReset} data-testid="button-reset-config">
            <RotateCcw className="h-4 w-4 mr-2" />
            重置
          </Button>
          <Button onClick={handleSave} data-testid="button-save-config">
            <Save className="h-4 w-4 mr-2" />
            保存
          </Button>
        </div>
      </div>

      <Tabs defaultValue="core" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 gap-2">
          <TabsTrigger value="core" data-testid="tab-core">
            <Settings className="h-4 w-4 mr-2" />
            核心参数
          </TabsTrigger>
          <TabsTrigger value="packages" data-testid="tab-packages">
            <Coins className="h-4 w-4 mr-2" />
            配套设置
          </TabsTrigger>
          <TabsTrigger value="trading" data-testid="tab-trading">
            <TrendingUp className="h-4 w-4 mr-2" />
            交易流向
          </TabsTrigger>
          <TabsTrigger value="broker" data-testid="tab-broker">
            <Users className="h-4 w-4 mr-2" />
            经纪人系统
          </TabsTrigger>
        </TabsList>

        <TabsContent value="core" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">AF 释放模式</CardTitle>
                <CardDescription>选择 AF 释放的计算方式</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Select
                  value={config.afReleaseMode}
                  onValueChange={(value: 'gold_standard' | 'coin_standard') =>
                    setConfig({ afReleaseMode: value })
                  }
                >
                  <SelectTrigger data-testid="select-release-mode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gold_standard">金本位（按 USDC 价值释放 AF）</SelectItem>
                    <SelectItem value="coin_standard">币本位（按固定 AF 数量释放）</SelectItem>
                  </SelectContent>
                </Select>
                <div className="p-3 rounded-md bg-muted">
                  <p className="text-sm text-muted-foreground">
                    {config.afReleaseMode === 'gold_standard'
                      ? "金本位模式：根据 USDC 价值计算释放的 AF 数量，币价越高释放越少"
                      : "币本位模式：每日释放固定数量的 AF，不受币价影响"}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">质押周期</CardTitle>
                <CardDescription>设置质押锁定期</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="staking-enabled">启用质押周期</Label>
                  <Switch
                    id="staking-enabled"
                    checked={config.stakingEnabled}
                    onCheckedChange={(checked) => setConfig({ stakingEnabled: checked })}
                    data-testid="switch-staking-enabled"
                  />
                </div>
                <div className="space-y-2">
                  <Label>周期天数: {config.stakingPeriodDays} 天</Label>
                  <Slider
                    value={[config.stakingPeriodDays]}
                    onValueChange={([value]) => setConfig({ stakingPeriodDays: value })}
                    min={7}
                    max={365}
                    step={1}
                    disabled={!config.stakingEnabled}
                    data-testid="slider-staking-days"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">交易手续费率</CardTitle>
                <CardDescription>随质押量变化的费率范围</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>最低费率 (%)</Label>
                    <Input
                      type="number"
                      value={config.tradingFeeRateMin}
                      onChange={(e) => setConfig({ tradingFeeRateMin: parseFloat(e.target.value) || 0 })}
                      min={0}
                      max={100}
                      data-testid="input-fee-min"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>最高费率 (%)</Label>
                    <Input
                      type="number"
                      value={config.tradingFeeRateMax}
                      onChange={(e) => setConfig({ tradingFeeRateMax: parseFloat(e.target.value) || 0 })}
                      min={0}
                      max={100}
                      data-testid="input-fee-max"
                    />
                  </div>
                </div>
                <div className="p-3 rounded-md bg-muted">
                  <p className="text-sm text-muted-foreground">
                    质押越多，手续费率越低。范围: {config.tradingFeeRateMin}% - {config.tradingFeeRateMax}%
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">交易模拟参数</CardTitle>
                <CardDescription>模拟计算使用的交易假设</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>日交易量 (%)</Label>
                    <Input
                      type="number"
                      value={config.dailyTradingVolumePercent}
                      onChange={(e) => setConfig({ dailyTradingVolumePercent: parseFloat(e.target.value) || 0 })}
                      min={0}
                      max={100}
                      data-testid="input-daily-volume"
                    />
                    <p className="text-xs text-muted-foreground">每日交易金占交易本金的比例</p>
                  </div>
                  <div className="space-y-2">
                    <Label>交易利润率 (%)</Label>
                    <Input
                      type="number"
                      value={config.tradingProfitRatePercent}
                      onChange={(e) => setConfig({ tradingProfitRatePercent: parseFloat(e.target.value) || 0 })}
                      min={-100}
                      max={100}
                      data-testid="input-profit-rate"
                    />
                    <p className="text-xs text-muted-foreground">每笔交易预期利润率</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">用户分润比例</CardTitle>
                <CardDescription>选择用户的利润分成比例</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Select
                  value={config.userProfitShareTier.toString()}
                  onValueChange={(value) => setConfig({ userProfitShareTier: parseInt(value) })}
                >
                  <SelectTrigger data-testid="select-profit-share">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROFIT_SHARE_TIERS.map((tier) => (
                      <SelectItem key={tier} value={tier.toString()}>
                        {tier}% 用户分润
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-2 flex-wrap">
                  {PROFIT_SHARE_TIERS.map((tier) => (
                    <Badge
                      key={tier}
                      variant={config.userProfitShareTier === tier ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => setConfig({ userProfitShareTier: tier })}
                    >
                      {tier}%
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">AF 释放出口比例</CardTitle>
              <CardDescription>设置 AF 释放后的分配比例</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>提现到二级市场 (%)</Label>
                  <Input
                    type="number"
                    value={config.afExitWithdrawRatio}
                    onChange={(e) => setConfig({ afExitWithdrawRatio: parseFloat(e.target.value) || 0 })}
                    min={0}
                    max={100}
                    data-testid="input-exit-withdraw"
                  />
                </div>
                <div className="space-y-2">
                  <Label>销毁 (%)</Label>
                  <Input
                    type="number"
                    value={config.afExitBurnRatio}
                    onChange={(e) => setConfig({ afExitBurnRatio: parseFloat(e.target.value) || 0 })}
                    min={0}
                    max={100}
                    data-testid="input-exit-burn"
                  />
                </div>
                <div className="space-y-2">
                  <Label>保留为手续费 (%)</Label>
                  <Input
                    type="number"
                    value={config.afExitTradingFeeRatio}
                    onChange={(e) => setConfig({ afExitTradingFeeRatio: parseFloat(e.target.value) || 0 })}
                    min={0}
                    max={100}
                    data-testid="input-exit-fee"
                  />
                </div>
                <div className="space-y-2">
                  <Label>兑换交易金 (%)</Label>
                  <Input
                    type="number"
                    value={config.afExitConvertRatio}
                    onChange={(e) => setConfig({ afExitConvertRatio: parseFloat(e.target.value) || 0 })}
                    min={0}
                    max={100}
                    data-testid="input-exit-convert"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">用户释放选择</CardTitle>
              <CardDescription>用户选择提现或转交易金的比例</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>选择提现 (%): {config.userWithdrawChoicePercent}%</Label>
                  <Slider
                    value={[config.userWithdrawChoicePercent]}
                    onValueChange={([value]) => {
                      setConfig({
                        userWithdrawChoicePercent: value,
                        userConvertChoicePercent: 100 - value,
                      });
                    }}
                    min={0}
                    max={100}
                    step={5}
                    data-testid="slider-withdraw-choice"
                  />
                </div>
                <div className="space-y-2">
                  <Label>选择转交易金 (%): {config.userConvertChoicePercent}%</Label>
                  <Slider
                    value={[config.userConvertChoicePercent]}
                    onValueChange={([value]) => {
                      setConfig({
                        userConvertChoicePercent: value,
                        userWithdrawChoicePercent: 100 - value,
                      });
                    }}
                    min={0}
                    max={100}
                    step={5}
                    data-testid="slider-convert-choice"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="packages" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {config.packageConfigs.map((pkg, index) => (
              <Card key={pkg.tier}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{pkg.tier} USDC</CardTitle>
                    <Badge variant="outline">档位 {index + 1}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>AF 释放利率 (%/日)</Label>
                    <Input
                      type="number"
                      value={pkg.afReleaseRate}
                      onChange={(e) => {
                        const newConfigs = [...config.packageConfigs];
                        newConfigs[index] = {
                          ...newConfigs[index],
                          afReleaseRate: parseFloat(e.target.value) || 0,
                        };
                        setConfig({ packageConfigs: newConfigs });
                      }}
                      step={0.1}
                      min={0}
                      max={10}
                      data-testid={`input-release-rate-${pkg.tier}`}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>交易金倍数</Label>
                    <Input
                      type="number"
                      value={pkg.tradingCapitalMultiplier}
                      onChange={(e) => {
                        const newConfigs = [...config.packageConfigs];
                        newConfigs[index] = {
                          ...newConfigs[index],
                          tradingCapitalMultiplier: parseFloat(e.target.value) || 1,
                        };
                        setConfig({ packageConfigs: newConfigs });
                      }}
                      step={0.5}
                      min={1}
                      max={10}
                      data-testid={`input-multiplier-${pkg.tier}`}
                    />
                  </div>
                  <div className="p-3 rounded-md bg-muted text-sm">
                    <p className="text-muted-foreground">
                      交易金 = {pkg.tier} × {pkg.tradingCapitalMultiplier} = <strong>{pkg.tier * pkg.tradingCapitalMultiplier}</strong> USDC
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="trading" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">交易资金流拆分</CardTitle>
              <CardDescription>每笔交易手续费的分配比例</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>USDC 添加 LP (%)</Label>
                  <Input
                    type="number"
                    value={config.lpPoolUsdcRatio}
                    onChange={(e) => setConfig({ lpPoolUsdcRatio: parseFloat(e.target.value) || 0 })}
                    min={0}
                    max={100}
                    data-testid="input-lp-usdc"
                  />
                </div>
                <div className="space-y-2">
                  <Label>AF 添加 LP (%)</Label>
                  <Input
                    type="number"
                    value={config.lpPoolAfRatio}
                    onChange={(e) => setConfig({ lpPoolAfRatio: parseFloat(e.target.value) || 0 })}
                    min={0}
                    max={100}
                    data-testid="input-lp-af"
                  />
                </div>
                <div className="space-y-2">
                  <Label>回购 AF (%)</Label>
                  <Input
                    type="number"
                    value={config.buybackRatio}
                    onChange={(e) => setConfig({ buybackRatio: parseFloat(e.target.value) || 0 })}
                    min={0}
                    max={100}
                    data-testid="input-buyback"
                  />
                </div>
                <div className="space-y-2">
                  <Label>外汇储备金 (%)</Label>
                  <Input
                    type="number"
                    value={config.reserveRatio}
                    onChange={(e) => setConfig({ reserveRatio: parseFloat(e.target.value) || 0 })}
                    min={0}
                    max={100}
                    data-testid="input-reserve"
                  />
                </div>
              </div>
              <div className="mt-4 p-4 rounded-md bg-muted">
                <div className="flex items-center justify-between text-sm">
                  <span>总计</span>
                  <span className={
                    config.lpPoolUsdcRatio + config.lpPoolAfRatio + config.buybackRatio + config.reserveRatio === 100
                      ? "text-green-500"
                      : "text-red-500"
                  }>
                    {config.lpPoolUsdcRatio + config.lpPoolAfRatio + config.buybackRatio + config.reserveRatio}%
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">AF 兑换倍率</CardTitle>
              <CardDescription>AF 转换为交易金的汇率</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label>1 AF = {config.afToTradingCapitalRate} 交易金</Label>
                <Slider
                  value={[config.afToTradingCapitalRate]}
                  onValueChange={([value]) => setConfig({ afToTradingCapitalRate: value })}
                  min={0.5}
                  max={5}
                  step={0.1}
                  data-testid="slider-af-rate"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="broker" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">经纪人推广收益比例</CardTitle>
              <CardDescription>V1-V6 级差制推广收益</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
                {config.brokerPromotionRatios.map((ratio, index) => (
                  <div key={index} className="space-y-2">
                    <Label>V{index + 1} (%)</Label>
                    <Input
                      type="number"
                      value={ratio}
                      onChange={(e) => {
                        const newRatios = [...config.brokerPromotionRatios];
                        newRatios[index] = parseFloat(e.target.value) || 0;
                        setConfig({ brokerPromotionRatios: newRatios });
                      }}
                      min={0}
                      max={100}
                      data-testid={`input-broker-v${index + 1}`}
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">AF 释放层级分配 (20层)</CardTitle>
              <CardDescription>各级经纪人的层级范围与分配比例</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {config.brokerLayerDistribution.map((dist, index) => (
                  <div key={dist.level} className="p-4 rounded-md border space-y-2">
                    <div className="flex items-center justify-between">
                      <Badge>{dist.level}</Badge>
                      <span className="text-sm text-muted-foreground">
                        第 {dist.layers[0]}-{dist.layers[dist.layers.length - 1]} 层
                      </span>
                    </div>
                    <div className="space-y-2">
                      <Label>每层分配 (%)</Label>
                      <Input
                        type="number"
                        value={dist.ratePerLayer}
                        onChange={(e) => {
                          const newDist = [...config.brokerLayerDistribution];
                          newDist[index] = {
                            ...newDist[index],
                            ratePerLayer: parseFloat(e.target.value) || 0,
                          };
                          setConfig({ brokerLayerDistribution: newDist });
                        }}
                        min={0}
                        max={10}
                        step={0.5}
                        data-testid={`input-layer-${dist.level}`}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      总计: {dist.layers.length} 层 × {dist.ratePerLayer}% = {(dist.layers.length * dist.ratePerLayer).toFixed(1)}%
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
