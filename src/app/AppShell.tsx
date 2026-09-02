import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Clock3,
  History,
  Inbox,
  ListTodo,
  Plus,
  RotateCcw,
  Settings,
  Target,
} from 'lucide-react';
import { useState, type ComponentType } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router';

import logoUrl from '../../logo/concentric-ring-master-metal.svg';
import { Button } from '@/components/ui/button';
import { SYSTEM_INBOX_ID } from '@/domain';
import { useTodoSnapshot } from '@/features/todos/useTodoSnapshot';
import { cn } from '@/lib/utils';

import { PwaUpdatePrompt } from './PwaUpdatePrompt';
import { ReminderRuntimeHost } from './ReminderRuntimeHost';
import { TimeZoneChangePrompt } from './TimeZoneChangePrompt';

interface NavigationItem {
  readonly label: string;
  readonly to: string;
  readonly icon: ComponentType<{ className?: string }>;
  readonly count?: number;
}

export function AppShell() {
  const snapshot = useTodoSnapshot();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const pending = snapshot?.tasks.filter((task) => task.state === 'pending') ?? [];
  const primaryNavigation: readonly NavigationItem[] = [
    { label: '今天', to: '/today', icon: CircleDot },
    { label: '即将到来', to: '/upcoming', icon: Clock3 },
    {
      label: '收件箱',
      to: '/inbox',
      icon: Inbox,
      count: pending.filter((task) => task.listId === SYSTEM_INBOX_ID).length,
    },
    { label: '错过计划', to: '/recovery?kind=missed', icon: RotateCcw },
    { label: '已逾期', to: '/recovery?kind=overdue', icon: AlertTriangle },
  ];
  const secondaryNavigation: readonly NavigationItem[] = [
    { label: '已完成', to: '/completed', icon: CheckCircle2 },
    { label: '日历', to: '/calendar/agenda', icon: CalendarDays },
    { label: '长期目标', to: '/goals', icon: Target },
    { label: '回顾', to: '/review?period=day', icon: History },
    { label: '设置', to: '/settings', icon: Settings },
  ];

  const renderNavigationItem = (item: NavigationItem) => {
    const Icon = item.icon;
    return (
      <NavLink
        key={item.label}
        to={item.to}
        title={collapsed ? item.label : undefined}
        className={({ isActive }) => cn('nav-link', isActive && 'active')}
      >
        <span className="nav-icon" aria-hidden="true">
          <Icon />
        </span>
        <span className="nav-label">{item.label}</span>
        {item.count !== undefined ? (
          <span className="nav-count">{item.count}</span>
        ) : null}
      </NavLink>
    );
  };

  return (
    <div className={cn('app-shell', collapsed && 'sidebar-collapsed')}>
      <aside className="sidebar" aria-label="主要导航">
        <div className="brand-row">
          <img className="brand-logo" src={logoUrl} alt="One Day" />
          <div className="brand-copy">
            <strong>One Day</strong>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            className="sidebar-toggle"
            aria-label={collapsed ? '展开侧栏' : '收起侧栏'}
            aria-expanded={!collapsed}
            onClick={() => setCollapsed((value) => !value)}
          >
            {collapsed ? <ChevronRight /> : <ChevronLeft />}
          </Button>
        </div>

        <Button className="quick-add-button" onClick={() => navigate('/inbox?quick=1')}>
          <Plus data-icon="inline-start" />
          <span>快速新增</span>
        </Button>

        <nav className="nav-list">
          <div className="nav-section">
            <p className="nav-title">浏览</p>
            {primaryNavigation.map(renderNavigationItem)}
          </div>
          <div className="nav-section secondary-nav">
            <p className="nav-title">更多</p>
            {secondaryNavigation.map(renderNavigationItem)}
          </div>
          <div className="nav-section custom-lists">
            <p className="nav-title">我的清单</p>
            {snapshot?.lists
              .filter((list) => !list.isSystem && !list.archived)
              .map((list) => (
                <NavLink
                  className={({ isActive }) => cn('nav-link', isActive && 'active')}
                  key={list.id}
                  title={collapsed ? list.name : undefined}
                  to={`/lists/${encodeURIComponent(list.id)}`}
                >
                  <span className="nav-icon" aria-hidden="true">
                    <ListTodo />
                  </span>
                  <span className="nav-label">{list.name}</span>
                </NavLink>
              ))}
          </div>
        </nav>
      </aside>
      <main className="main-panel">
        <Outlet />
      </main>
      <TimeZoneChangePrompt />
      <ReminderRuntimeHost />
      <PwaUpdatePrompt />
    </div>
  );
}
