import { useEffect } from 'react';
import { useTaskStore } from '@/stores/taskStore';
import { taskRepository } from '@/db/taskRepository';

/**
 * 任务相关的自定义Hook
 */
export function useTasks() {
  const { tasks, filteredTasks, isLoading, setTasks, setLoading, applyFiltersAndSort } =
    useTaskStore();

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

  return {
    tasks,
    filteredTasks,
    isLoading,
    loadTasks,
    applyFiltersAndSort,
  };
}

