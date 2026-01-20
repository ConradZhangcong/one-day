import { Outlet, Link, useLocation } from 'react-router-dom';
import { Layout as AntLayout, Menu } from 'antd';
import {
  CalendarOutlined,
  UnorderedListOutlined,
  ProjectOutlined,
  BookOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { useUIStore } from '@/stores/uiStore';

const { Header, Content, Sider } = AntLayout;

const menuItems = [
  {
    key: '/tasks',
    icon: <UnorderedListOutlined />,
    label: <Link to="/tasks">任务列表</Link>,
  },
  {
    key: '/calendar',
    icon: <CalendarOutlined />,
    label: <Link to="/calendar">日历</Link>,
  },
  {
    key: '/projects',
    icon: <ProjectOutlined />,
    label: <Link to="/projects">计划</Link>,
  },
  {
    key: '/journal',
    icon: <BookOutlined />,
    label: <Link to="/journal">日记</Link>,
  },
  {
    key: '/settings',
    icon: <SettingOutlined />,
    label: <Link to="/settings">设置</Link>,
  },
];

export default function Layout() {
  const location = useLocation();
  const sidebarOpen = useUIStore((state) => state.sidebarOpen);

  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible
        collapsed={!sidebarOpen}
        onCollapse={(collapsed) => useUIStore.getState().setSidebarOpen(!collapsed)}
        width={200}
        style={{
          overflow: 'auto',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
        }}
      >
        <div
          style={{
            height: 32,
            margin: 16,
            background: 'rgba(255, 255, 255, 0.2)',
            borderRadius: 4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontWeight: 'bold',
          }}
        >
          One Day
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
        />
      </Sider>
      <AntLayout style={{ marginLeft: sidebarOpen ? 200 : 80 }}>
        <Header
          style={{
            padding: 0,
            background: '#fff',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          }}
        >
          <div style={{ padding: '0 24px', lineHeight: '64px' }}>
            <h1 style={{ margin: 0, fontSize: 20 }}>待办任务与时间计划</h1>
          </div>
        </Header>
        <Content
          style={{
            margin: '24px 16px',
            padding: 24,
            minHeight: 280,
            background: '#fff',
            borderRadius: 8,
          }}
        >
          <Outlet />
        </Content>
      </AntLayout>
    </AntLayout>
  );
}

