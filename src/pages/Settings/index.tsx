import { Typography, Switch, Space } from 'antd';
import { useSettingsStore } from '@/stores/settingsStore';

const { Title, Text } = Typography;

export default function SettingsPage() {
  const { theme, cloudSyncEnabled, setTheme, setCloudSyncEnabled, toggleTheme } =
    useSettingsStore();

  return (
    <div>
      <Title level={2}>设置</Title>

      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div>
          <Space>
            <Text>主题模式：</Text>
            <Switch
              checked={theme === 'dark'}
              onChange={(checked) => setTheme(checked ? 'dark' : 'light')}
              checkedChildren="暗色"
              unCheckedChildren="亮色"
            />
          </Space>
        </div>

        <div>
          <Space>
            <Text>云端同步：</Text>
            <Switch
              checked={cloudSyncEnabled}
              onChange={setCloudSyncEnabled}
              checkedChildren="开启"
              unCheckedChildren="关闭"
            />
          </Space>
        </div>
      </Space>
    </div>
  );
}

