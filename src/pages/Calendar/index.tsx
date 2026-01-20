import { useState, useEffect } from 'react';
import { Typography, Modal, List, Empty, Button } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { useTaskStore } from '@/stores/taskStore';
import { taskService } from '@/services/taskService';
import MonthCalendar from '@/components/calendar/MonthCalendar';
import TaskModal from '@/components/task/TaskModal';
import TaskItem from '@/components/task/TaskItem';
import type { Task, CreateTaskDto } from '@/types/task';
import { DateUtils } from '@/utils/dateUtils';

const { Title } = Typography;

export default function CalendarPage() {
  const { tasks, setTasks, setLoading, isLoading, addTask, updateTask, deleteTask } =
    useTaskStore();
  const [selectedDate, setSelectedDate] = useState<Dayjs | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | undefined>();
  const [dateTasksModalOpen, setDateTasksModalOpen] = useState(false);

  useEffect(() => {
    loadTasks();
  }, []);

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

  const handleDateClick = (date: Dayjs) => {
    setSelectedDate(date);
    setDateTasksModalOpen(true);
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
        const updated = await taskService.updateTask(id, { status: 'pending' });
        if (updated) updateTask(id, updated);
      } else {
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
        const updated = await taskService.updateTask(id, { status: 'completed' });
        if (updated) updateTask(id, updated);
      } else {
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

  // 获取选中日期的任务
  const getDateTasks = (): Task[] => {
    if (!selectedDate) return [];
    return tasks.filter((task) => {
      if (!task.startDate) return false;
      return DateUtils.isSameDay(task.startDate, selectedDate.toDate());
    });
  };

  const dateTasks = getDateTasks();

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <Title level={2} style={{ margin: 0 }}>
          日历视图
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
      </div>

      <div style={{ background: '#fff', padding: 24, borderRadius: 8 }}>
        <MonthCalendar
          tasks={tasks}
          onDateClick={handleDateClick}
          onTaskClick={handleEdit}
        />
      </div>

      <Modal
        title={selectedDate ? `${selectedDate.format('YYYY年MM月DD日')} 的任务` : '任务列表'}
        open={dateTasksModalOpen}
        onCancel={() => {
          setDateTasksModalOpen(false);
          setSelectedDate(null);
        }}
        footer={null}
        width={600}
      >
        {dateTasks.length === 0 ? (
          <Empty description="该日期暂无任务" />
        ) : (
          <div>
            {dateTasks.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                onToggleComplete={handleToggleComplete}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onArchive={handleArchive}
              />
            ))}
          </div>
        )}
      </Modal>

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

