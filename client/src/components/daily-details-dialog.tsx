import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatNumber, formatCurrency } from "@/lib/calculations";
import type { StakingOrder, OrderDailyDetail } from "@shared/schema";

const PAGE_SIZE = 20;

interface DailyDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orders: StakingOrder[];
  orderDailyDetails: Map<string, OrderDailyDetail[]>;
  simulationDays: number;
}

/** Aggregate all orders' daily details by day number. */
function aggregateAllOrders(
  orderDailyDetails: Map<string, OrderDailyDetail[]>,
  simulationDays: number
): OrderDailyDetail[] {
  const dayMap = new Map<number, OrderDailyDetail>();

  for (let day = 1; day <= simulationDays; day++) {
    dayMap.set(day, {
      day,
      orderId: "all",
      principalRelease: 0,
      interestRelease: 0,
      dailyAfRelease: 0,
      afPrice: 0,
      cumAfReleased: 0,
      afInSystem: 0,
      tradingCapital: 0,
      forexIncome: 0,
      withdrawnAf: 0,
      withdrawFee: 0,
    });
  }

  orderDailyDetails.forEach((details) => {
    for (let i = 0; i < details.length; i++) {
      const d = details[i];
      const agg = dayMap.get(d.day);
      if (!agg) continue;
      agg.principalRelease += d.principalRelease;
      agg.interestRelease += d.interestRelease;
      agg.dailyAfRelease += d.dailyAfRelease;
      agg.afPrice = d.afPrice; // price is the same across orders on a given day
      agg.cumAfReleased += d.cumAfReleased;
      agg.afInSystem += d.afInSystem;
      agg.tradingCapital += d.tradingCapital;
      agg.forexIncome += d.forexIncome;
      agg.withdrawnAf += d.withdrawnAf;
      agg.withdrawFee += d.withdrawFee;
    }
  });

  return Array.from(dayMap.values()).sort((a, b) => a.day - b.day);
}

/** Compute summary totals for a slice of daily details. */
function computeSummary(rows: OrderDailyDetail[]) {
  return rows.reduce(
    (acc, r) => ({
      principalRelease: acc.principalRelease + r.principalRelease,
      interestRelease: acc.interestRelease + r.interestRelease,
      dailyAfRelease: acc.dailyAfRelease + r.dailyAfRelease,
      cumAfReleased: r.cumAfReleased, // last row's cumulative is the running total
      afInSystem: r.afInSystem,
      tradingCapital: acc.tradingCapital + r.tradingCapital,
      forexIncome: acc.forexIncome + r.forexIncome,
      withdrawnAf: acc.withdrawnAf + r.withdrawnAf,
      withdrawFee: acc.withdrawFee + r.withdrawFee,
    }),
    {
      principalRelease: 0,
      interestRelease: 0,
      dailyAfRelease: 0,
      cumAfReleased: 0,
      afInSystem: 0,
      tradingCapital: 0,
      forexIncome: 0,
      withdrawnAf: 0,
      withdrawFee: 0,
    }
  );
}

function PaginatedTable({ details }: { details: OrderDailyDetail[] }) {
  const [page, setPage] = useState(0);

  const totalPages = Math.max(1, Math.ceil(details.length / PAGE_SIZE));
  const start = page * PAGE_SIZE;
  const pageRows = details.slice(start, start + PAGE_SIZE);
  const summary = computeSummary(pageRows);

  // Reset page if details change and page is out of range
  if (page >= totalPages && totalPages > 0) {
    setPage(totalPages - 1);
  }

  return (
    <div className="space-y-3">
      <div className="rounded-md border overflow-auto max-h-[60vh]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-center whitespace-nowrap px-2">天</TableHead>
              <TableHead className="text-right whitespace-nowrap px-2">本金释放</TableHead>
              <TableHead className="text-right whitespace-nowrap px-2">利息释放</TableHead>
              <TableHead className="text-right whitespace-nowrap px-2">日释放AF</TableHead>
              <TableHead className="text-right whitespace-nowrap px-2">AF价格</TableHead>
              <TableHead className="text-right whitespace-nowrap px-2">累计释放AF</TableHead>
              <TableHead className="text-right whitespace-nowrap px-2">系统AF</TableHead>
              <TableHead className="text-right whitespace-nowrap px-2">交易金</TableHead>
              <TableHead className="text-right whitespace-nowrap px-2">外汇收益</TableHead>
              <TableHead className="text-right whitespace-nowrap px-2">提取AF</TableHead>
              <TableHead className="text-right whitespace-nowrap px-2">提取费用</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center text-muted-foreground py-8">
                  暂无数据
                </TableCell>
              </TableRow>
            ) : (
              <>
                {pageRows.map((row) => (
                  <TableRow key={row.day}>
                    <TableCell className="text-center px-2 font-medium">{row.day}</TableCell>
                    <TableCell className="text-right px-2 tabular-nums">{formatCurrency(row.principalRelease)}</TableCell>
                    <TableCell className="text-right px-2 tabular-nums">{formatCurrency(row.interestRelease)}</TableCell>
                    <TableCell className="text-right px-2 tabular-nums">{formatNumber(row.dailyAfRelease, 4)}</TableCell>
                    <TableCell className="text-right px-2 tabular-nums">${row.afPrice.toFixed(4)}</TableCell>
                    <TableCell className="text-right px-2 tabular-nums">{formatNumber(row.cumAfReleased, 2)}</TableCell>
                    <TableCell className="text-right px-2 tabular-nums">{formatNumber(row.afInSystem, 2)}</TableCell>
                    <TableCell className="text-right px-2 tabular-nums">{formatCurrency(row.tradingCapital)}</TableCell>
                    <TableCell className="text-right px-2 tabular-nums text-green-500">{formatCurrency(row.forexIncome)}</TableCell>
                    <TableCell className="text-right px-2 tabular-nums">{formatNumber(row.withdrawnAf, 2)}</TableCell>
                    <TableCell className="text-right px-2 tabular-nums text-red-400">{formatCurrency(row.withdrawFee)}</TableCell>
                  </TableRow>
                ))}

                {/* Summary row */}
                <TableRow className="bg-muted/50 font-semibold border-t-2">
                  <TableCell className="text-center px-2">
                    <Badge variant="secondary" className="text-xs">
                      小计
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right px-2 tabular-nums">{formatCurrency(summary.principalRelease)}</TableCell>
                  <TableCell className="text-right px-2 tabular-nums">{formatCurrency(summary.interestRelease)}</TableCell>
                  <TableCell className="text-right px-2 tabular-nums">{formatNumber(summary.dailyAfRelease, 4)}</TableCell>
                  <TableCell className="text-right px-2 tabular-nums">-</TableCell>
                  <TableCell className="text-right px-2 tabular-nums">{formatNumber(summary.cumAfReleased, 2)}</TableCell>
                  <TableCell className="text-right px-2 tabular-nums">{formatNumber(summary.afInSystem, 2)}</TableCell>
                  <TableCell className="text-right px-2 tabular-nums">{formatCurrency(summary.tradingCapital)}</TableCell>
                  <TableCell className="text-right px-2 tabular-nums text-green-500">{formatCurrency(summary.forexIncome)}</TableCell>
                  <TableCell className="text-right px-2 tabular-nums">{formatNumber(summary.withdrawnAf, 2)}</TableCell>
                  <TableCell className="text-right px-2 tabular-nums text-red-400">{formatCurrency(summary.withdrawFee)}</TableCell>
                </TableRow>
              </>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            共 {details.length} 天 / {totalPages} 页
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              上一页
            </Button>
            <span className="text-sm font-medium min-w-[4rem] text-center">
              {page + 1} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
            >
              下一页
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DailyDetailsDialog({
  open,
  onOpenChange,
  orders,
  orderDailyDetails,
  simulationDays,
}: DailyDetailsDialogProps) {
  const allOrdersAggregated = useMemo(
    () => aggregateAllOrders(orderDailyDetails, simulationDays),
    [orderDailyDetails, simulationDays]
  );

  const defaultTab = orders.length > 0 ? "all" : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-full xl:max-w-[1400px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>每日释放详情</DialogTitle>
          <DialogDescription>
            查看每个订单或全部订单的每日释放数据（共 {simulationDays} 天，每页 {PAGE_SIZE} 行）
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue={defaultTab} className="w-full">
          <TabsList className="flex flex-wrap h-auto gap-1 mb-2">
            <TabsTrigger value="all" className="text-xs">
              全部订单
            </TabsTrigger>
            {orders.map((order) => (
              <TabsTrigger key={order.id} value={order.id} className="text-xs">
                <span className="mr-1">
                  ...{order.id.slice(-6)}
                </span>
                <Badge variant="outline" className="text-[10px] px-1 py-0">
                  {order.mode === "days"
                    ? `${order.durationDays || "?"}天`
                    : `$${order.packageTier}`}
                </Badge>
              </TabsTrigger>
            ))}
          </TabsList>

          {/* All orders aggregate tab */}
          <TabsContent value="all">
            <PaginatedTable details={allOrdersAggregated} />
          </TabsContent>

          {/* Per-order tabs */}
          {orders.map((order) => {
            const details = orderDailyDetails.get(order.id) || [];
            return (
              <TabsContent key={order.id} value={order.id}>
                <div className="mb-3 flex items-center gap-2 flex-wrap text-sm text-muted-foreground">
                  <span>订单 ID: <code className="text-foreground">{order.id}</code></span>
                  <Badge variant="secondary">
                    {order.mode === "days"
                      ? `天数模式 (${order.durationDays || "?"}天)`
                      : `配套 $${order.packageTier}`}
                  </Badge>
                  <span>金额: <strong className="text-foreground">${formatNumber(order.amount)}</strong></span>
                  {order.startDay > 0 && <span>起始天: Day {order.startDay}</span>}
                </div>
                <PaginatedTable details={details} />
              </TabsContent>
            );
          })}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
