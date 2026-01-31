import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useConfigStore } from "@/hooks/use-config";
import { runSimulationWithDetails, formatNumber, formatCurrency, formatPercent, calculateOrderReleaseProgress } from "@/lib/calculations";
import { type OrderDailyDetail } from "@shared/schema";
import { DollarSign, Coins, TrendingUp, Receipt, Wallet, PiggyBank, BarChart3, ArrowRight } from "lucide-react";

export default function SummaryPage() {
  const { config, stakingOrders, aamPool, currentSimulationDay } = useConfigStore();
  const simulationDays = Math.max(1, currentSimulationDay);

  const simulationData = useMemo(() => {
    if (stakingOrders.length === 0) return null;
    return runSimulationWithDetails(stakingOrders, config, simulationDays, aamPool);
  }, [stakingOrders, config, simulationDays, aamPool]);

  const orderDailyDetails = simulationData?.orderDailyDetails || new Map<string, OrderDailyDetail[]>();
  const simulationResults = simulationData?.dailySimulations || [];

  const currentAfPrice = simulationResults.length > 0
    ? simulationResults[simulationResults.length - 1].afPrice
    : aamPool.afPrice;

  const orderProgress = useMemo(() => {
    if (stakingOrders.length === 0) return [];
    return calculateOrderReleaseProgress(stakingOrders, config, simulationDays, currentAfPrice);
  }, [stakingOrders, config, simulationDays, currentAfPrice]);

  const orderSummaries = useMemo(() => {
    return stakingOrders.map(order => {
      const details = orderDailyDetails.get(order.id) || [];
      const progress = orderProgress.find(p => p.orderId === order.id);

      let totalForexIncome = 0;
      let totalWithdrawnAf = 0;
      let totalWithdrawFee = 0;
      let lastAfInSystem = 0;

      for (const d of details) {
        totalForexIncome += d.forexIncome;
        totalWithdrawnAf += d.withdrawnAf;
        totalWithdrawFee += d.withdrawFee;
        lastAfInSystem = d.afInSystem;
      }

      const afSellingRevenue = totalWithdrawnAf * currentAfPrice;
      const retainedAfValue = lastAfInSystem * currentAfPrice;
      const totalRevenue = afSellingRevenue + retainedAfValue + totalForexIncome;
      const netProfit = totalRevenue - order.amount - totalWithdrawFee;

      return {
        orderId: order.id,
        packageTier: order.packageTier,
        amount: order.amount,
        mode: order.mode || 'package',
        durationDays: order.durationDays,
        startDay: order.startDay ?? 0,
        forexIncome: totalForexIncome,
        afSellingRevenue,
        withdrawnAf: totalWithdrawnAf,
        retainedAf: lastAfInSystem,
        retainedAfValue,
        withdrawFee: totalWithdrawFee,
        totalRevenue,
        netProfit,
        roi: order.amount > 0 ? (netProfit / order.amount) * 100 : 0,
        isComplete: progress?.isComplete ?? false,
        currentDay: progress?.currentDay ?? 0,
        totalDays: progress?.totalDays ?? 0,
      };
    });
  }, [stakingOrders, orderDailyDetails, orderProgress, currentAfPrice]);

  const grandTotals = useMemo(() => {
    const totals = orderSummaries.reduce(
      (acc, o) => ({
        totalInvestment: acc.totalInvestment + o.amount,
        afSellingRevenue: acc.afSellingRevenue + o.afSellingRevenue,
        retainedAfValue: acc.retainedAfValue + o.retainedAfValue,
        forexIncome: acc.forexIncome + o.forexIncome,
        withdrawFee: acc.withdrawFee + o.withdrawFee,
        withdrawnAf: acc.withdrawnAf + o.withdrawnAf,
        retainedAf: acc.retainedAf + o.retainedAf,
      }),
      { totalInvestment: 0, afSellingRevenue: 0, retainedAfValue: 0, forexIncome: 0, withdrawFee: 0, withdrawnAf: 0, retainedAf: 0 }
    );
    const totalRevenue = totals.afSellingRevenue + totals.retainedAfValue + totals.forexIncome;
    const netProfit = totalRevenue - totals.totalInvestment - totals.withdrawFee;
    const roi = totals.totalInvestment > 0 ? (netProfit / totals.totalInvestment) * 100 : 0;
    return { ...totals, totalRevenue, netProfit, roi };
  }, [orderSummaries]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">总收益统计</h1>
          <p className="text-muted-foreground">
            各订单总收益汇总 — 当前 Day {currentSimulationDay}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">AF ${formatNumber(currentAfPrice, 4)}</Badge>
          <Badge variant={stakingOrders.length > 0 ? "default" : "secondary"}>
            {stakingOrders.length} 笔质押订单
          </Badge>
        </div>
      </div>

      {stakingOrders.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <Coins className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>暂无质押订单</p>
              <p className="text-sm">请先在质押模拟页面添加订单</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Key metrics: Investment, Revenue, Net Profit, ROI */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="border-slate-500/30 bg-slate-500/5">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2">
                  <Wallet className="h-4 w-4" />
                  总投入
                </CardDescription>
                <CardTitle className="text-xl">
                  {formatCurrency(grandTotals.totalInvestment)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">{stakingOrders.length} 笔订单质押合计</p>
              </CardContent>
            </Card>

            <Card className="border-blue-500/30 bg-blue-500/5">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2">
                  <PiggyBank className="h-4 w-4" />
                  总收益
                </CardDescription>
                <CardTitle className="text-xl text-blue-500">
                  {formatCurrency(grandTotals.totalRevenue)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">AF卖出 + 保留价值 + 外汇收益</p>
              </CardContent>
            </Card>

            <Card className={`${grandTotals.netProfit >= 0 ? 'border-green-500/30 bg-green-500/5' : 'border-red-500/30 bg-red-500/5'}`}>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  净利润
                </CardDescription>
                <CardTitle className={`text-xl ${grandTotals.netProfit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {grandTotals.netProfit >= 0 ? '+' : ''}{formatCurrency(grandTotals.netProfit)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">总收益 - 总投入 - 手续费</p>
              </CardContent>
            </Card>

            <Card className={`${grandTotals.roi >= 0 ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-red-500/30 bg-red-500/5'}`}>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  投资回报率
                </CardDescription>
                <CardTitle className={`text-xl ${grandTotals.roi >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                  {grandTotals.roi >= 0 ? '+' : ''}{formatPercent(grandTotals.roi)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">净利润 / 总投入</p>
              </CardContent>
            </Card>
          </div>

          {/* Revenue flow breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">收益构成</CardTitle>
              <CardDescription>总收益的来源拆分（截至 Day {currentSimulationDay}）</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 p-4 rounded-md bg-muted flex-wrap">
                <div className="text-center">
                  <p className="text-lg font-bold">{formatCurrency(grandTotals.totalInvestment)}</p>
                  <p className="text-xs text-muted-foreground">总投入</p>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground" />
                <div className="text-center">
                  <p className="text-lg font-bold text-blue-500">{formatCurrency(grandTotals.afSellingRevenue)}</p>
                  <p className="text-xs text-muted-foreground">AF卖出收益</p>
                  <p className="text-xs text-muted-foreground">{formatNumber(grandTotals.withdrawnAf)} AF</p>
                </div>
                <span className="text-muted-foreground">+</span>
                <div className="text-center">
                  <p className="text-lg font-bold text-purple-500">{formatCurrency(grandTotals.retainedAfValue)}</p>
                  <p className="text-xs text-muted-foreground">保留AF价值</p>
                  <p className="text-xs text-muted-foreground">{formatNumber(grandTotals.retainedAf)} AF</p>
                </div>
                <span className="text-muted-foreground">+</span>
                <div className="text-center">
                  <p className="text-lg font-bold text-green-500">{formatCurrency(grandTotals.forexIncome)}</p>
                  <p className="text-xs text-muted-foreground">外汇收益</p>
                </div>
                <span className="text-muted-foreground">-</span>
                <div className="text-center">
                  <p className="text-lg font-bold text-red-500">{formatCurrency(grandTotals.withdrawFee)}</p>
                  <p className="text-xs text-muted-foreground">手续费</p>
                </div>
                <span className="text-muted-foreground">=</span>
                <div className="text-center">
                  <p className={`text-lg font-bold ${grandTotals.netProfit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {grandTotals.netProfit >= 0 ? '+' : ''}{formatCurrency(grandTotals.netProfit)}
                  </p>
                  <p className="text-xs text-muted-foreground">净利润</p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                <div className="p-3 rounded-md border border-blue-500/20">
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <DollarSign className="h-3 w-3" /> AF卖出收益
                  </p>
                  <p className="text-lg font-semibold text-blue-500">{formatCurrency(grandTotals.afSellingRevenue)}</p>
                  <p className="text-xs text-muted-foreground">提取并卖出 {formatNumber(grandTotals.withdrawnAf)} AF</p>
                </div>
                <div className="p-3 rounded-md border border-purple-500/20">
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Coins className="h-3 w-3" /> 保留AF价值
                  </p>
                  <p className="text-lg font-semibold text-purple-500">{formatCurrency(grandTotals.retainedAfValue)}</p>
                  <p className="text-xs text-muted-foreground">系统内 {formatNumber(grandTotals.retainedAf)} AF</p>
                </div>
                <div className="p-3 rounded-md border border-green-500/20">
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" /> 外汇交易收益
                  </p>
                  <p className="text-lg font-semibold text-green-500">{formatCurrency(grandTotals.forexIncome)}</p>
                  <p className="text-xs text-muted-foreground">累计交易利润分成</p>
                </div>
                <div className="p-3 rounded-md border border-red-500/20">
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Receipt className="h-3 w-3" /> 提现手续费
                  </p>
                  <p className="text-lg font-semibold text-red-500">{formatCurrency(grandTotals.withdrawFee)}</p>
                  <p className="text-xs text-muted-foreground">AF提取手续费合计</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Per-order breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">每订单收益明细</CardTitle>
              <CardDescription>各订单的投入、收益、净利润及ROI（截至 Day {currentSimulationDay}）</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>订单</TableHead>
                      <TableHead>模式</TableHead>
                      <TableHead className="text-right">投入(USDC)</TableHead>
                      <TableHead className="text-right">AF卖出(USDC)</TableHead>
                      <TableHead className="text-right">保留AF价值</TableHead>
                      <TableHead className="text-right">外汇收益</TableHead>
                      <TableHead className="text-right">手续费</TableHead>
                      <TableHead className="text-right">净利润</TableHead>
                      <TableHead className="text-right">ROI</TableHead>
                      <TableHead className="text-center">状态</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orderSummaries.map((o) => (
                      <TableRow key={o.orderId}>
                        <TableCell className="font-medium">#{o.orderId.slice(-6)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Badge variant="outline" className="text-xs">
                              {o.mode === 'days' ? '天数' : '配套'}
                            </Badge>
                            <span className="text-sm">
                              {o.mode === 'days' ? `${o.durationDays}天` : `${o.packageTier} USDC`}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(o.amount)}</TableCell>
                        <TableCell className="text-right text-blue-500">
                          {formatCurrency(o.afSellingRevenue)}
                          <p className="text-xs text-muted-foreground">{formatNumber(o.withdrawnAf)} AF</p>
                        </TableCell>
                        <TableCell className="text-right text-purple-500">
                          {formatCurrency(o.retainedAfValue)}
                          <p className="text-xs text-muted-foreground">{formatNumber(o.retainedAf)} AF</p>
                        </TableCell>
                        <TableCell className="text-right text-green-500">{formatCurrency(o.forexIncome)}</TableCell>
                        <TableCell className="text-right text-red-500">{formatCurrency(o.withdrawFee)}</TableCell>
                        <TableCell className={`text-right font-medium ${o.netProfit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {o.netProfit >= 0 ? '+' : ''}{formatCurrency(o.netProfit)}
                        </TableCell>
                        <TableCell className={`text-right font-medium ${o.roi >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {o.roi >= 0 ? '+' : ''}{formatPercent(o.roi)}
                        </TableCell>
                        <TableCell className="text-center">
                          {o.isComplete ? (
                            <Badge variant="default" className="bg-green-500">已完成</Badge>
                          ) : (
                            <Badge variant="outline" className="border-amber-500 text-amber-500">
                              Day {o.currentDay}/{o.totalDays}
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell className="font-bold" colSpan={2}>合计</TableCell>
                      <TableCell className="text-right font-bold">
                        {formatCurrency(grandTotals.totalInvestment)}
                      </TableCell>
                      <TableCell className="text-right font-bold text-blue-500">
                        {formatCurrency(grandTotals.afSellingRevenue)}
                      </TableCell>
                      <TableCell className="text-right font-bold text-purple-500">
                        {formatCurrency(grandTotals.retainedAfValue)}
                      </TableCell>
                      <TableCell className="text-right font-bold text-green-500">
                        {formatCurrency(grandTotals.forexIncome)}
                      </TableCell>
                      <TableCell className="text-right font-bold text-red-500">
                        {formatCurrency(grandTotals.withdrawFee)}
                      </TableCell>
                      <TableCell className={`text-right font-bold ${grandTotals.netProfit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {grandTotals.netProfit >= 0 ? '+' : ''}{formatCurrency(grandTotals.netProfit)}
                      </TableCell>
                      <TableCell className={`text-right font-bold ${grandTotals.roi >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {grandTotals.roi >= 0 ? '+' : ''}{formatPercent(grandTotals.roi)}
                      </TableCell>
                      <TableCell />
                    </TableRow>
                  </TableFooter>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
