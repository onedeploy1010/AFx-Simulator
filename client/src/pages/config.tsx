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
import { PACKAGE_TIERS } from "@shared/schema";
import { RotateCcw, Save, Settings, Coins, TrendingUp, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function ConfigPage() {
  const { config, setConfig, resetConfig, updatePackageConfig } = useConfigStore();
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

  const depositReserveRatio = Math.max(0, 100 - config.depositLpRatio - config.depositBuybackRatio);

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
                <CardTitle className="text-lg">AF 释放周期</CardTitle>
                <CardDescription>全局释放周期设置</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="staking-enabled">启用 AF 释放周期</Label>
                  <Switch
                    id="staking-enabled"
                    checked={config.stakingEnabled}
                    onCheckedChange={(checked) => setConfig({ stakingEnabled: checked })}
                    data-testid="switch-staking-enabled"
                  />
                </div>
                <div className="space-y-2">
                  <Label>释放开始交易周期 (天): {config.releaseStartsTradingDays}</Label>
                  <Slider
                    value={[config.releaseStartsTradingDays]}
                    onValueChange={([value]) => setConfig({ releaseStartsTradingDays: value })}
                    min={0}
                    max={30}
                    step={1}
                    data-testid="slider-release-starts-trading"
                  />
                  <p className="text-xs text-muted-foreground">质押后第 N 天开始可交易</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">初始 LP 底池</CardTitle>
              <CardDescription>设置 AMM 初始流动性池</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>初始 USDC</Label>
                  <Input
                    type="number"
                    value={config.initialLpUsdc}
                    onChange={(e) => setConfig({ initialLpUsdc: parseFloat(e.target.value) || 0 })}
                    min={0}
                    data-testid="input-initial-usdc"
                  />
                </div>
                <div className="space-y-2">
                  <Label>初始 AF</Label>
                  <Input
                    type="number"
                    value={config.initialLpAf}
                    onChange={(e) => setConfig({ initialLpAf: parseFloat(e.target.value) || 0 })}
                    min={0}
                    data-testid="input-initial-af"
                  />
                </div>
              </div>
              <div className="mt-3 p-3 rounded-md bg-muted">
                <p className="text-sm text-muted-foreground">
                  初始币价: ${config.initialLpAf > 0 ? (config.initialLpUsdc / config.initialLpAf).toFixed(4) : 0}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">USDC 入金分配</CardTitle>
              <CardDescription>用户入金的资金分配比例</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label>添加流动池比例: {config.depositLpRatio}%</Label>
                </div>
                <Slider
                  value={[config.depositLpRatio]}
                  onValueChange={([value]) => {
                    const maxValue = 100 - config.depositBuybackRatio;
                    setConfig({ depositLpRatio: Math.min(value, maxValue) });
                  }}
                  min={0}
                  max={100}
                  step={5}
                  data-testid="slider-deposit-lp"
                />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label>回购 AF 比例: {config.depositBuybackRatio}%</Label>
                </div>
                <Slider
                  value={[config.depositBuybackRatio]}
                  onValueChange={([value]) => {
                    const maxValue = 100 - config.depositLpRatio;
                    setConfig({ depositBuybackRatio: Math.min(value, maxValue) });
                  }}
                  min={0}
                  max={100}
                  step={5}
                  data-testid="slider-deposit-buyback"
                />
              </div>
              <div className="p-3 rounded-md bg-muted space-y-1">
                <div className="flex justify-between text-sm">
                  <span>添加流动池</span>
                  <span className="font-medium">{config.depositLpRatio}%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>回购 AF</span>
                  <span className="font-medium">{config.depositBuybackRatio}%</span>
                </div>
                <div className="flex justify-between text-sm border-t pt-1">
                  <span>交易储备金</span>
                  <span className="font-medium">{depositReserveRatio}%</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">交易模拟参数</CardTitle>
                <CardDescription>全局交易参数</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>日交易量 (%): {config.dailyTradingVolumePercent}%</Label>
                  <Slider
                    value={[config.dailyTradingVolumePercent]}
                    onValueChange={([value]) => setConfig({ dailyTradingVolumePercent: value })}
                    min={1}
                    max={100}
                    step={1}
                    data-testid="slider-daily-volume"
                  />
                  <p className="text-xs text-muted-foreground">每日交易金占交易本金的比例</p>
                </div>
                <div className="space-y-2">
                  <Label>AF 转交易金倍率: {config.afToTradingCapitalRate}x</Label>
                  <Slider
                    value={[config.afToTradingCapitalRate * 10]}
                    onValueChange={([value]) => setConfig({ afToTradingCapitalRate: value / 10 })}
                    min={5}
                    max={30}
                    step={1}
                    data-testid="slider-af-convert-rate"
                  />
                  <p className="text-xs text-muted-foreground">AF 兑换交易金时的倍率</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">提现销毁比例</CardTitle>
                <CardDescription>提现 AF 时的销毁比例</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>销毁比例 (%): {config.afExitBurnRatio}%</Label>
                  <Slider
                    value={[config.afExitBurnRatio]}
                    onValueChange={([value]) => setConfig({ afExitBurnRatio: value })}
                    min={0}
                    max={50}
                    step={1}
                    data-testid="slider-burn-ratio"
                  />
                  <p className="text-xs text-muted-foreground">提现 AF 时销毁的比例</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="packages" className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            {config.packageConfigs.map((pkg) => (
              <Card key={pkg.tier}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Badge variant="default">{pkg.tier} USDC</Badge>
                    配套设置
                  </CardTitle>
                  <CardDescription>设置该配套的所有参数</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div className="space-y-2">
                      <Label>AF 释放利率 (%/天)</Label>
                      <Input
                        type="number"
                        value={pkg.afReleaseRate}
                        onChange={(e) => updatePackageConfig(pkg.tier, { afReleaseRate: parseFloat(e.target.value) || 0 })}
                        step="0.1"
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
                        onChange={(e) => updatePackageConfig(pkg.tier, { tradingCapitalMultiplier: parseFloat(e.target.value) || 1 })}
                        step="0.5"
                        min={1}
                        max={10}
                        data-testid={`input-multiplier-${pkg.tier}`}
                      />
                    </div>
                    {config.stakingEnabled && (
                      <div className="space-y-2">
                        <Label>质押周期 (天)</Label>
                        <Input
                          type="number"
                          value={pkg.stakingPeriodDays}
                          onChange={(e) => updatePackageConfig(pkg.tier, { stakingPeriodDays: parseInt(e.target.value) || 30 })}
                          min={1}
                          max={365}
                          data-testid={`input-staking-days-${pkg.tier}`}
                        />
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label>交易手续费率 (%)</Label>
                      <Input
                        type="number"
                        value={pkg.tradingFeeRate}
                        onChange={(e) => updatePackageConfig(pkg.tier, { tradingFeeRate: parseFloat(e.target.value) || 0 })}
                        step="0.5"
                        min={0}
                        max={20}
                        data-testid={`input-fee-rate-${pkg.tier}`}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                    <div className="space-y-2">
                      <Label>交易利润率 (%)</Label>
                      <Input
                        type="number"
                        value={pkg.tradingProfitRate}
                        onChange={(e) => updatePackageConfig(pkg.tier, { tradingProfitRate: parseFloat(e.target.value) || 0 })}
                        step="0.5"
                        min={-50}
                        max={50}
                        data-testid={`input-profit-rate-${pkg.tier}`}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>用户分成比例 (%)</Label>
                      <Input
                        type="number"
                        value={pkg.profitSharePercent}
                        onChange={(e) => updatePackageConfig(pkg.tier, { profitSharePercent: parseFloat(e.target.value) || 60 })}
                        min={0}
                        max={100}
                        data-testid={`input-profit-share-${pkg.tier}`}
                      />
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <Label className="text-sm font-medium mb-3 block">释放选择分配</Label>
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>提现: {pkg.releaseWithdrawPercent}%</span>
                        </div>
                        <Slider
                          value={[pkg.releaseWithdrawPercent]}
                          onValueChange={([value]) => {
                            const remaining = 100 - value;
                            const keepRatio = pkg.releaseKeepPercent / (pkg.releaseKeepPercent + pkg.releaseConvertPercent || 1);
                            updatePackageConfig(pkg.tier, { 
                              releaseWithdrawPercent: value,
                              releaseKeepPercent: Math.round(remaining * keepRatio),
                              releaseConvertPercent: Math.round(remaining * (1 - keepRatio))
                            });
                          }}
                          min={0}
                          max={100}
                          step={5}
                          data-testid={`slider-release-withdraw-${pkg.tier}`}
                        />
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>保留为手续费: {pkg.releaseKeepPercent}%</span>
                        </div>
                        <Slider
                          value={[pkg.releaseKeepPercent]}
                          onValueChange={([value]) => {
                            const maxValue = 100 - pkg.releaseWithdrawPercent;
                            const newKeep = Math.min(value, maxValue);
                            updatePackageConfig(pkg.tier, { 
                              releaseKeepPercent: newKeep,
                              releaseConvertPercent: maxValue - newKeep
                            });
                          }}
                          min={0}
                          max={100 - pkg.releaseWithdrawPercent}
                          step={5}
                          data-testid={`slider-release-keep-${pkg.tier}`}
                        />
                      </div>
                      <div className="p-3 rounded-md bg-muted space-y-1">
                        <div className="flex justify-between text-sm">
                          <span>提现</span>
                          <span>{pkg.releaseWithdrawPercent}%</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>保留手续费</span>
                          <span>{pkg.releaseKeepPercent}%</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>兑换交易金</span>
                          <span>{pkg.releaseConvertPercent}%</span>
                        </div>
                        <div className="flex justify-between text-sm font-medium border-t pt-1">
                          <span>总计</span>
                          <span>{pkg.releaseWithdrawPercent + pkg.releaseKeepPercent + pkg.releaseConvertPercent}%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="trading" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">交易资金流分配</CardTitle>
              <CardDescription>每笔交易资金的分配比例 (基于交易本金)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>LP 池 USDC (%)</Label>
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
                  <Label>LP 池 AF (%)</Label>
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
              <div className="mt-4 p-3 rounded-md bg-muted">
                <p className="text-sm text-muted-foreground">
                  总计: {config.lpPoolUsdcRatio + config.lpPoolAfRatio + config.buybackRatio + config.reserveRatio}%
                  (LP USDC {config.lpPoolUsdcRatio}% + LP AF {config.lpPoolAfRatio}% + 回购 {config.buybackRatio}% + 储备 {config.reserveRatio}%)
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="broker" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">经纪人等级晋升比例</CardTitle>
              <CardDescription>V1-V6 各等级的晋升要求</CardDescription>
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
                      data-testid={`input-broker-ratio-${index}`}
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">层级分配设置</CardTitle>
              <CardDescription>20层推广体系的分配规则</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {config.brokerLayerDistribution.map((dist, index) => (
                  <div key={index} className="flex items-center gap-4 p-3 rounded-md border">
                    <Badge variant="outline" className="w-12">{dist.level}</Badge>
                    <div className="flex-1">
                      <p className="text-sm">层级: {dist.layers.join(', ')}</p>
                    </div>
                    <div className="w-24">
                      <Input
                        type="number"
                        value={dist.ratePerLayer}
                        onChange={(e) => {
                          const newDist = [...config.brokerLayerDistribution];
                          newDist[index] = { ...dist, ratePerLayer: parseFloat(e.target.value) || 0 };
                          setConfig({ brokerLayerDistribution: newDist });
                        }}
                        min={0}
                        max={20}
                        data-testid={`input-layer-rate-${index}`}
                      />
                    </div>
                    <span className="text-sm text-muted-foreground">%/层</span>
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
