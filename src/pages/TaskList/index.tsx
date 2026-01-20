import { useState, useEffect } from 'react';
import { Button, Typography, Space, Tabs, Input, Select, Empty } from 'antd';
import { PlusOutlined, SearchOutlined } from '@ant-design/icons';
import { useTaskStore } from '@/stores/taskStore';
import { taskService } from '@/services/taskService';
import TaskItem from '@/components/task/TaskItem';
import TaskModal from '@/components/task/TaskModal';
import type { Task, CreateTaskDto } from '@/types/task';

const { Title } = Typography;
const { TabPane } = Tabs;
const { Search } = Input;
const { Option } = Select;

export default function TaskListPage() {
  const {
    tasks,
    filteredTasks,
    isLoading,
    filters,
    setTasks,
    setLoading,
    setFilters,
    addTask,
    updateTask,
    deleteTask,
    applyFiltersAndSort,
  } = useTaskStore();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | undefined>();
  const [activeTab, setActiveTab] = useState('pending');
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    loadTasks();
  }, []);

  useEffect(() => {
    applyFiltersAndSort();
  }, [filters, tasks]);

  const loadTasks = async () => {
    setLoading(true);
    try {
      const allTasks = await taskService.getAllTasks();
      setTasks(allTasks);
    } catch (error) {
      console.error('加载任务失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (values: CreateTaskDto) => {
    try {
      const newTask = await taskService.createTask(values);
      addTask(newTask);
      setModalOpen(false);
      setEditingTask(undefined); // 清空编辑任务，确保下次打开是新建模式
    } catch (error) {
      console.error('创建任务失败:', error);
      throw error;
    }
  };

  const handleUpdate = async (values: CreateTaskDto) => {
    if (!editingTask) return;
    try {
      const updated = await taskService.updateTask(editingTask.id, values);
      if (updated) {
        updateTask(editingTask.id, updated);
        setModalOpen(false);
        setEditingTask(undefined);
      }
    } catch (error) {
      console.error('更新任务失败:', error);
      throw error;
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await taskService.deleteTask(id);
      deleteTask(id);
    } catch (error) {
      console.error('删除任务失败:', error);
    }
  };

  const handleToggleComplete = async (id: string) => {
    try {
      const task = tasks.find((t) => t.id === id);
      if (!task) return;

      if (task.status === 'completed' || task.status === 'archived') {
        // 取消完成
        const updated = await taskService.updateTask(id, { status: 'pending' });
        if (updated) updateTask(id, updated);
      } else {
        // 标记完成
        const updated = await taskService.completeTask(id);
        if (updated) updateTask(id, updated);
      }
    } catch (error) {
      console.error('更新任务状态失败:', error);
    }
  };

  const handleArchive = async (id: string) => {
    try {
      const task = tasks.find((t) => t.id === id);
      if (!task) return;

      if (task.status === 'archived') {
        // 取消归档
        const updated = await taskService.updateTask(id, { status: 'completed' });
        if (updated) updateTask(id, updated);
      } else {
        // 归档
        const updated = await taskService.archiveTask(id);
        if (updated) updateTask(id, updated);
      }
    } catch (error) {
      console.error('归档任务失败:', error);
    }
  };

  const handleEdit = (task: Task) => {
    setEditingTask(task);
    setModalOpen(true);
  };

  const handleTabChange = (key: string) => {
    setActiveTab(key);
    if (key === 'pending') {
      setFilters({ status: 'pending' });
    } else if (key === 'completed') {
      setFilters({ status: 'completed' });
    } else if (key === 'archived') {
      setFilters({ status: 'archived' });
    } else {
      setFilters({});
    }
  };

  // 根据搜索文本和标签筛选任务
  const displayTasks = filteredTasks.filter((task) => {
    if (searchText) {
      const searchLower = searchText.toLowerCase();
      return (
        task.title.toLowerCase().includes(searchLower) ||
        task.description?.toLowerCase().includes(searchLower) ||
        task.tags.some((tag) => tag.toLowerCase().includes(searchLower))
      );
    }
    return true;
  });

  return (
    <div>
      <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
        <Title level={2} style={{ margin: 0 }}>
          任务列表
        </Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            setEditingTask(undefined);
            setModalOpen(true);
          }}
        >
          新建任务
        </Button>
      </Space>

      <Space style={{ marginBottom: 16, width: '100%' }} direction="vertical">
        <Search
          placeholder="搜索任务..."
          allowClear
          prefix={<SearchOutlined />}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          style={{ width: '100%', maxWidth: 400 }}
        />
        <Space>
          <Select
            placeholder="按优先级筛选"
            allowClear
            style={{ width: 120 }}
            onChange={(value) => setFilters({ priority: value })}
          >
            <Option value="high">高</Option>
            <Option value="medium">中</Option>
            <Option value="low">低</Option>
          </Select>
          <Select
            placeholder="按类型筛选"
            allowClear
            style={{ width: 120 }}
            onChange={() => setFilters({})}
          >
            <Option value="single">单次</Option>
            <Option value="recurring">重复</Option>
            <Option value="long_term">长期</Option>
          </Select>
        </Space>
      </Space>

      <Tabs activeKey={activeTab} onChange={handleTabChange}>
        <TabPane tab="待办" key="pending">
          <div style={{ background: '#fff', borderRadius: 8 }}>
            {displayTasks.filter((t) => t.status === 'pending').length === 0 ? (
              <Empty description="暂无待办任务" />
            ) : (
              displayTasks
                .filter((t) => t.status === 'pending')
                .map((task) => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    onToggleComplete={handleToggleComplete}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onArchive={handleArchive}
                  />
                ))
            )}
          </div>
        </TabPane>
        <TabPane tab="已完成" key="completed">
          <div style={{ background: '#fff', borderRadius: 8 }}>
            {displayTasks.filter((t) => t.status === 'completed').length === 0 ? (
              <Empty description="暂无已完成任务" />
            ) : (
              displayTasks
                .filter((t) => t.status === 'completed')
                .map((task) => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    onToggleComplete={handleToggleComplete}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onArchive={handleArchive}
                  />
                ))
            )}
          </div>
        </TabPane>
        <TabPane tab="已归档" key="archived">
          <div style={{ background: '#fff', borderRadius: 8 }}>
            {displayTasks.filter((t) => t.status === 'archived').length === 0 ? (
              <Empty description="暂无已归档任务" />
            ) : (
              displayTasks
                .filter((t) => t.status === 'archived')
                .map((task) => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    onToggleComplete={handleToggleComplete}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onArchive={handleArchive}
                  />
                ))
            )}
          </div>
        </TabPane>
      </Tabs>

      <TaskModal
        open={modalOpen}
        task={editingTask}
        onOk={editingTask ? handleUpdate : handleCreate}
        onCancel={() => {
          setModalOpen(false);
          setEditingTask(undefined);
        }}
        loading={isLoading}
      />
    </div>
  );
}

