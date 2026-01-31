import { useLocation, Link } from "wouter";
import {
  Settings,
  Coins,
  TrendingUp,
  BarChart3,
  Droplets,
  Users,
  Target,
  ClipboardList,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { useConfigStore } from "@/hooks/use-config";

const menuItems = [
  {
    title: "铸造模拟",
    url: "/staking",
    icon: Coins,
    description: "叠加多笔铸造订单",
  },
  {
    title: "释放进度",
    url: "/release",
    icon: TrendingUp,
    description: "查看 AF 释放情况",
  },
  {
    title: "交易模拟",
    url: "/trading",
    icon: BarChart3,
    description: "手续费与利润分配",
  },
  {
    title: "AAM 池监控",
    url: "/aam",
    icon: Droplets,
    description: "LP 池与币价变化",
  },
  {
    title: "CLMM 模拟",
    url: "/clmm",
    icon: Target,
    description: "集中流动性策略模拟",
  },
  {
    title: "经纪人系统",
    url: "/broker",
    icon: Users,
    description: "V1-V6 推广收益",
  },
  {
    title: "总收益统计",
    url: "/summary",
    icon: ClipboardList,
    description: "各订单总收益汇总",
  },
  {
    title: "参数配置",
    url: "/",
    icon: Settings,
    description: "统一修改所有参数",
  },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { config } = useConfigStore();

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary">
            <span className="text-lg font-bold text-primary-foreground">AF</span>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-sidebar-foreground">AFx Calculator</h2>
            <p className="text-xs text-sidebar-foreground/60">经济模型验证工具</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/50">模拟模块</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => {
                const isActive = location === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.description}
                    >
                      <Link href={item.url} data-testid={`nav-${item.url.replace("/", "") || "config"}`}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs text-sidebar-foreground/50">当前模式</span>
          <Badge variant={config.simulationMode === 'days' ? 'default' : 'secondary'} className="text-xs">
            {config.simulationMode === 'days' ? '天数模式' : '配套模式'}
          </Badge>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
