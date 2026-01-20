import { useEffect } from 'react';
import { Button, List, Typography, Space } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useTaskStore } from '@/stores/taskStore';
import { taskRepository } from '@/db/taskRepository';

const { Title } = Typography;

export default function TaskListPage() {
  const { tasks, filteredTasks, isLoading, setTasks, setLoading } = useTaskStore();

  useEffect(() => {
    loadTasks();
  }, []);

  const loadTasks = async () => {
    setLoading(true);
    try {
      const allTasks = await taskRepository.getAll();
      setTasks(allTasks);
    } catch (error) {
      console.error('加载任务失败:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
        <Title level={2} style={{ margin: 0 }}>
          任务列表
        </Title>
        <Button type="primary" icon={<PlusOutlined />}>
          新建任务
        </Button>
      </Space>

      <List
        loading={isLoading}
        dataSource={filteredTasks}
        renderItem={(task) => (
          <List.Item>
            <List.Item.Meta
              title={task.title}
              description={task.description || '无描述'}
            />
          </List.Item>
        )}
        locale={{ emptyText: '暂无任务' }}
      />
    </div>
  );
}

