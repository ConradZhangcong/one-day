import {
  CalendarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  InboxOutlined,
  HistoryOutlined,
  SettingOutlined,
  WarningOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import { NavLink, Outlet } from 'react-router';

import { PwaUpdatePrompt } from './PwaUpdatePrompt';
import { ReminderRuntimeHost } from './ReminderRuntimeHost';
import { TimeZoneChangePrompt } from './TimeZoneChangePrompt';
import { useTodoSnapshot } from '@/features/todos/useTodoSnapshot';

export function AppShell() {
  const snapshot = useTodoSnapshot();
  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="主要导航">
        <div className="brand-mark" aria-hidden="true">
          ✓
        </div>
        <div className="brand-copy">
          <strong>One Day</strong>
          <span>把今天过清楚</span>
        </div>
        <nav className="nav-list">
          <NavLink to="/today">
            <CheckCircleOutlined /> 今天
          </NavLink>
          <NavLink to="/inbox">
            <InboxOutlined /> 收件箱
          </NavLink>
          <NavLink to="/upcoming">
            <ClockCircleOutlined /> 即将到来
          </NavLink>
          <NavLink to="/completed">
            <CheckCircleOutlined /> 已完成
          </NavLink>
          <NavLink to="/calendar/agenda">
            <CalendarOutlined /> 日历
          </NavLink>
          <NavLink to="/recovery?kind=missed">
            <WarningOutlined /> 恢复
          </NavLink>
          <NavLink to="/review?period=day">
            <HistoryOutlined /> 回顾
          </NavLink>
          <NavLink to="/settings">
            <SettingOutlined /> 设置
          </NavLink>
          {snapshot?.lists
            .filter((list) => !list.isSystem && !list.archived)
            .map((list) => (
              <NavLink
                className="custom-list-link"
                key={list.id}
                to={`/lists/${encodeURIComponent(list.id)}`}
              >
                <UnorderedListOutlined /> {list.name}
              </NavLink>
            ))}
        </nav>
        <p className="privacy-note">本地优先 · 无需账号</p>
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
