import { AddTaskButton } from '@/features/todos/AddTaskButton';
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Clock3,
  History,
  Inbox,
  ListTodo,
  MoreHorizontal,
  RotateCcw,
  Settings,
  Target,
} from 'lucide-react';
import { useState, type ComponentType } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';

import logoUrl from '../../logo/concentric-ring-master-metal.svg';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const pending = snapshot?.tasks.filter((task) => task.state === 'pending') ?? [];
  const primaryNavigation: readonly NavigationItem[] = [
    { label: '今天', to: '/today', icon: CircleDot },
    { label: '日历', to: '/calendar/agenda', icon: CalendarDays },
    {
      label: '收件箱',
      to: '/inbox',
      icon: Inbox,
      count: pending.filter((task) => task.listId === SYSTEM_INBOX_ID).length,
    },
    { label: '待恢复', to: '/recovery', icon: RotateCcw },
  ];
  const secondaryNavigation: readonly NavigationItem[] = [
    { label: '即将到来', to: '/upcoming', icon: Clock3 },
    { label: '已处理', to: '/completed', icon: CheckCircle2 },
    { label: '长期目标', to: '/goals', icon: Target },
    { label: '回顾', to: '/review?period=day', icon: History },
    { label: '设置', to: '/settings', icon: Settings },
  ];

  const renderNavigationItem = (item: NavigationItem) => {
    const Icon = item.icon;
    return (
      <NavLink
        onClick={() => setMoreOpen(false)}
        key={item.label}
        to={item.to}
        title={collapsed ? item.label : undefined}
        className={({ isActive }) =>
          cn(
            'nav-link',
            (isActive ||
              (item.to.startsWith('/calendar') &&
                location.pathname.startsWith('/calendar/'))) &&
              'active',
          )
        }
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

        <AddTaskButton className="quick-add-button" />

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
        <p className="sidebar-footer">One Day · 本地优先</p>
      </aside>
      <main className="main-panel">
        <Outlet />
      </main>
      <nav className="mobile-navigation" aria-label="手机导航">
        {primaryNavigation.map(renderNavigationItem)}
        <Button
          variant="ghost"
          className="nav-link"
          aria-expanded={moreOpen}
          onClick={() => setMoreOpen(true)}
        >
          <MoreHorizontal className="size-5" />
          <span>更多</span>
        </Button>
      </nav>
      <Dialog open={moreOpen} onOpenChange={setMoreOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>更多</DialogTitle>
          </DialogHeader>
          <nav className="mobile-more-menu">
            {secondaryNavigation.map(renderNavigationItem)}
            <h2>我的清单</h2>
            {snapshot?.lists
              .filter((list) => !list.isSystem && !list.archived)
              .map((list) => (
                <NavLink
                  key={list.id}
                  to={`/lists/${encodeURIComponent(list.id)}`}
                  onClick={() => setMoreOpen(false)}
                >
                  {list.name}
                </NavLink>
              ))}
          </nav>
        </DialogContent>
      </Dialog>
      <TimeZoneChangePrompt />
      <ReminderRuntimeHost />
      <PwaUpdatePrompt />
    </div>
  );
}
