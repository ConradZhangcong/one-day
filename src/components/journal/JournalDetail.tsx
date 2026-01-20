import { Card, Typography, Tag, Space, Button } from 'antd';
import { EditOutlined, DeleteOutlined } from '@ant-design/icons';
import type { Journal } from '@/types/journal';
import type { Task } from '@/types/task';
import { DateUtils } from '@/utils/dateUtils';
import dayjs from 'dayjs';

const { Title, Paragraph, Text } = Typography;

interface JournalDetailProps {
  journal: Journal;
  completedTasks?: Task[];
  onEdit: () => void;
  onDelete: () => void;
}

export default function JournalDetail({
  journal,
  completedTasks = [],
  onEdit,
  onDelete,
}: JournalDetailProps) {
  const getMoodEmoji = (mood: string | null) => {
    const moodMap: Record<string, string> = {
      happy: '😊',
      sad: '😢',
      angry: '😠',
      calm: '😌',
      excited: '🤩',
      tired: '😴',
    };
    return mood ? moodMap[mood] || '' : '';
  };

  return (
    <Card
      title={
        <Space>
          <Text strong>{dayjs(journal.date).format('YYYY年MM月DD日')}</Text>
          {journal.mood && (
            <Tag color="blue" style={{ fontSize: 14 }}>
              {getMoodEmoji(journal.mood)} {journal.mood}
            </Tag>
          )}
        </Space>
      }
      extra={
        <Space>
          <Button icon={<EditOutlined />} onClick={onEdit}>
            编辑
          </Button>
          <Button danger icon={<DeleteOutlined />} onClick={onDelete}>
            删除
          </Button>
        </Space>
      }
    >
      {journal.title && (
        <Title level={3} style={{ marginBottom: 16 }}>
          {journal.title}
        </Title>
      )}
      <Paragraph style={{ whiteSpace: 'pre-wrap', fontSize: 16, lineHeight: 1.8, marginBottom: 16 }}>
        {journal.content}
      </Paragraph>
      {journal.tags.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <Text strong style={{ marginRight: 8 }}>标签：</Text>
          {journal.tags.map((tag) => (
            <Tag key={tag} style={{ marginBottom: 8 }}>
              {tag}
            </Tag>
          ))}
        </div>
      )}
      {journal.relatedTaskIds.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <Text strong>关联任务：</Text>
          <ul style={{ marginTop: 8, marginLeft: 20 }}>
            {journal.relatedTaskIds.map((taskId) => {
              const task = completedTasks.find((t) => t.id === taskId);
              return task ? <li key={taskId}>{task.title}</li> : null;
            })}
          </ul>
        </div>
      )}
      <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #f0f0f0' }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          创建时间: {DateUtils.formatDateTime(journal.createdAt)}
          {journal.updatedAt.getTime() !== journal.createdAt.getTime() && (
            <> | 更新时间: {DateUtils.formatDateTime(journal.updatedAt)}</>
          )}
        </Text>
      </div>
    </Card>
  );
}

