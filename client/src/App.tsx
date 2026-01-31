import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";
import { useConfigStore } from "@/hooks/use-config";
import NotFound from "@/pages/not-found";
import ConfigPage from "@/pages/config";
import StakingPage from "@/pages/staking";
import ReleasePage from "@/pages/release";
import TradingPage from "@/pages/trading";
import AAMPage from "@/pages/aam";
import BrokerPage from "@/pages/broker";
import CLMMPage from "@/pages/clmm";
import SummaryPage from "@/pages/summary";

function Router() {
  return (
    <Switch>
      <Route path="/" component={ConfigPage} />
      <Route path="/staking" component={StakingPage} />
      <Route path="/release" component={ReleasePage} />
      <Route path="/trading" component={TradingPage} />
      <Route path="/aam" component={AAMPage} />
      <Route path="/broker" component={BrokerPage} />
      <Route path="/clmm" component={CLMMPage} />
      <Route path="/summary" component={SummaryPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3.5rem",
  };

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="dark" storageKey="nms-ui-theme">
        <TooltipProvider>
          <SidebarProvider style={sidebarStyle as React.CSSProperties}>
            <div className="flex h-screen w-full">
              <AppSidebar />
              <div className="flex flex-col flex-1 overflow-hidden">
                <header className="flex items-center justify-between p-3 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                  <div className="flex items-center gap-3">
                    <SidebarTrigger data-testid="button-sidebar-toggle" />
                    <h1 className="text-sm font-medium text-muted-foreground hidden sm:block">NMS 经济模型计算器</h1>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-muted-foreground"
                      onClick={() => {
                        if (window.confirm("确定要重置所有数据吗？包括配置、订单、AAM池和模拟天数。")) {
                          useConfigStore.getState().resetAll();
                        }
                      }}
                    >
                      <RotateCcw className="h-4 w-4 mr-1" />
                      完全重置
                    </Button>
                    <ThemeToggle />
                  </div>
                </header>
                <main className="flex-1 overflow-auto">
                  <Router />
                </main>
              </div>
            </div>
          </SidebarProvider>
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
