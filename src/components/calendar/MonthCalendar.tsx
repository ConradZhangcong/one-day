import { Calendar, Badge, Typography } from 'antd';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import type { Task } from '@/types/task';
import { DateUtils } from '@/utils/dateUtils';

const { Text } = Typography;

interface MonthCalendarProps {
  tasks: Task[];
  onDateClick?: (date: Dayjs) => void;
  onTaskClick?: (task: Task) => void;
}

export default function MonthCalendar({
  tasks,
  onDateClick,
  onTaskClick,
}: MonthCalendarProps) {
  // 获取指定日期的任务
  const getTasksForDate = (date: Dayjs): Task[] => {
    return tasks.filter((task) => {
      if (!task.startDate) return false;
      return DateUtils.isSameDay(task.startDate, date.toDate());
    });
  };

  // 获取指定日期的已完成任务
  const getCompletedTasksForDate = (date: Dayjs): Task[] => {
    return getTasksForDate(date).filter(
      (task) => task.status === 'completed' || task.status === 'archived'
    );
  };

  // 日历单元格渲染
  const dateCellRender = (date: Dayjs) => {
    const dayTasks = getTasksForDate(date);
    const completedTasks = getCompletedTasksForDate(date);
    const pendingTasks = dayTasks.filter(
      (task) => task.status === 'pending' || task.status === 'in_progress'
    );

    if (dayTasks.length === 0) return null;

    return (
      <div style={{ fontSize: 12 }}>
        {pendingTasks.length > 0 && (
          <div>
            <Badge
              count={pendingTasks.length}
              style={{ backgroundColor: '#1890ff' }}
              title={pendingTasks.map((t) => t.title).join(', ')}
            />
          </div>
        )}
        {completedTasks.length > 0 && (
          <div style={{ marginTop: 4 }}>
            <Badge
              count={completedTasks.length}
              style={{ backgroundColor: '#52c41a' }}
              title={completedTasks.map((t) => t.title).join(', ')}
            />
          </div>
        )}
      </div>
    );
  };

  // 自定义日期单元格
  const cellRender = (date: Dayjs, info: { type: string }) => {
    if (info.type === 'date') {
      return (
        <div
          onClick={() => onDateClick?.(date)}
          style={{ cursor: onDateClick ? 'pointer' : 'default', minHeight: 80 }}
        >
          {dateCellRender(date)}
        </div>
      );
    }
    return null;
  };

  return (
    <Calendar
      cellRender={cellRender}
      headerRender={({ value, type, onChange, onTypeChange }) => {
        return (
          <div style={{ padding: 8, display: 'flex', justifyContent: 'space-between' }}>
            <Text strong style={{ fontSize: 16 }}>
              {value.format('YYYY年MM月')}
            </Text>
          </div>
        );
      }}
    />
  );
}

