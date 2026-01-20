import { useState, useMemo, useEffect } from 'react';
import dayjs from 'dayjs';
import { taskRepository } from '@/db/taskRepository';
import type { Task } from '@/types/task';

/**
 * 日历相关的自定义Hook
 */
export function useCalendar() {
  const [currentDate, setCurrentDate] = useState(dayjs());
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day'>('month');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);

  // 计算当前视图的日期范围
  const dateRange = useMemo(() => {
    switch (viewMode) {
      case 'month':
        return {
          start: currentDate.startOf('month').toDate(),
          end: currentDate.endOf('month').toDate(),
        };
      case 'week':
        return {
          start: currentDate.startOf('week').toDate(),
          end: currentDate.endOf('week').toDate(),
        };
      case 'day':
        return {
          start: currentDate.startOf('day').toDate(),
          end: currentDate.endOf('day').toDate(),
        };
    }
  }, [currentDate, viewMode]);

  // 加载日期范围内的任务
  const loadTasks = async () => {
    setLoading(true);
    try {
      const tasksInRange = await taskRepository.getByDateRange(
        dateRange.start,
        dateRange.end
      );
      setTasks(tasksInRange);
    } catch (error) {
      console.error('加载任务失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, [dateRange]);

  return {
    currentDate,
    setCurrentDate,
    viewMode,
    setViewMode,
    tasks,
    loading,
    dateRange,
    loadTasks,
  };
}

