import { Checkbox, Tag, Space, Button, Dropdown, Typography } from 'antd';
import {
  CheckOutlined,
  EditOutlined,
  DeleteOutlined,
  MoreOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import type { Task, TaskStatus } from '@/types/task';
import { DateUtils } from '@/utils/dateUtils';
import dayjs from 'dayjs';

const { Text } = Typography;

interface TaskItemProps {
  task: Task;
  onToggleComplete: (id: string) => void;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
  onArchive: (id: string) => void;
}

export default function TaskItem({
  task,
  onToggleComplete,
  onEdit,
  onDelete,
  onArchive,
}: TaskItemProps) {
  const isCompleted = task.status === 'completed' || task.status === 'archived';

  const getPriorityColor = (priority: string | null) => {
    switch (priority) {
      case 'high':
        return 'red';
      case 'medium':
        return 'orange';
      case 'low':
        return 'blue';
      default:
        return 'default';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'single':
        return '单次';
      case 'recurring':
        return '重复';
      case 'long_term':
        return '长期';
      default:
        return type;
    }
  };

  const menuItems = [
    {
      key: 'edit',
      label: '编辑',
      icon: <EditOutlined />,
      onClick: () => onEdit(task),
    },
    {
      key: 'archive',
      label: isCompleted ? '取消归档' : '归档',
      icon: <CheckOutlined />,
      onClick: () => onArchive(task.id),
    },
    {
      type: 'divider' as const,
    },
    {
      key: 'delete',
      label: '删除',
      icon: <DeleteOutlined />,
      danger: true,
      onClick: () => onDelete(task.id),
    },
  ];

  return (
    <div
      style={{
        padding: '12px 16px',
        borderBottom: '1px solid #f0f0f0',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        opacity: isCompleted ? 0.6 : 1,
      }}
    >
      <Checkbox
        checked={isCompleted}
        onChange={() => onToggleComplete(task.id)}
        style={{ marginTop: 4 }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <Text
            strong
            style={{
              textDecoration: isCompleted ? 'line-through' : 'none',
              fontSize: 16,
            }}
          >
            {task.title}
          </Text>
          <Tag color={getPriorityColor(task.priority)} size="small">
            {task.priority || '无'}
          </Tag>
          <Tag size="small">{getTypeLabel(task.type)}</Tag>
        </div>
        {task.description && (
          <Text
            type="secondary"
            style={{
              display: 'block',
              marginBottom: 8,
              textDecoration: isCompleted ? 'line-through' : 'none',
            }}
          >
            {task.description}
          </Text>
        )}
        <Space size="small" wrap>
          {task.startDate && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              <ClockCircleOutlined /> {DateUtils.format(task.startDate)}
              {task.startTime && ` ${task.startTime}`}
            </Text>
          )}
          {task.deadline && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              截止: {DateUtils.format(task.deadline)}
            </Text>
          )}
          {task.type === 'long_term' && task.endDate && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              至 {DateUtils.format(task.endDate)}
            </Text>
          )}
          {task.type === 'long_term' && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              进度: {task.progress}%
            </Text>
          )}
        </Space>
        {task.tags.length > 0 && (
          <div style={{ marginTop: 8 }}>
            {task.tags.map((tag) => (
              <Tag key={tag} size="small" style={{ marginRight: 4 }}>
                {tag}
              </Tag>
            ))}
          </div>
        )}
      </div>
      <Dropdown menu={{ items: menuItems }} trigger={['click']}>
        <Button type="text" icon={<MoreOutlined />} />
      </Dropdown>
    </div>
  );
}

