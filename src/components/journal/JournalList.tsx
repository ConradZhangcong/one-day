import { List, Card, Tag, Typography, Button, Space, Empty } from 'antd';
import { EditOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import type { Journal } from '@/types/journal';
import { DateUtils } from '@/utils/dateUtils';
import dayjs from 'dayjs';

const { Text, Paragraph } = Typography;

interface JournalListProps {
  journals: Journal[];
  loading?: boolean;
  onView: (journal: Journal) => void;
  onEdit: (journal: Journal) => void;
  onDelete: (journal: Journal) => void;
}

export default function JournalList({
  journals,
  loading,
  onView,
  onEdit,
  onDelete,
}: JournalListProps) {
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

  const formatDate = (date: Date) => {
    const journalDate = dayjs(date);
    const today = dayjs();
    const yesterday = today.subtract(1, 'day');

    if (journalDate.isSame(today, 'day')) {
      return '今天';
    } else if (journalDate.isSame(yesterday, 'day')) {
      return '昨天';
    } else if (journalDate.isSame(today, 'year')) {
      return journalDate.format('MM月DD日');
    } else {
      return journalDate.format('YYYY年MM月DD日');
    }
  };

  if (journals.length === 0 && !loading) {
    return <Empty description="暂无日记记录" />;
  }

  return (
    <List
      loading={loading}
      dataSource={journals}
      renderItem={(journal) => {
        const previewContent = journal.content.length > 100
          ? journal.content.substring(0, 100) + '...'
          : journal.content;

        return (
          <List.Item>
            <Card
              style={{ width: '100%' }}
              actions={[
                <Button
                  key="view"
                  type="link"
                  icon={<EyeOutlined />}
                  onClick={() => onView(journal)}
                >
                  查看
                </Button>,
                <Button
                  key="edit"
                  type="link"
                  icon={<EditOutlined />}
                  onClick={() => onEdit(journal)}
                >
                  编辑
                </Button>,
                <Button
                  key="delete"
                  type="link"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => onDelete(journal)}
                >
                  删除
                </Button>,
              ]}
            >
              <div style={{ marginBottom: 12 }}>
                <Space>
                  <Text strong style={{ fontSize: 16 }}>
                    {formatDate(journal.date)}
                  </Text>
                  {journal.title && (
                    <Text strong style={{ fontSize: 16, color: '#1890ff' }}>
                      {journal.title}
                    </Text>
                  )}
                  {journal.mood && (
                    <Tag color="blue">
                      {getMoodEmoji(journal.mood)} {journal.mood}
                    </Tag>
                  )}
                </Space>
              </div>
              <Paragraph
                ellipsis={{ rows: 3, expandable: false }}
                style={{ marginBottom: 12, color: '#666' }}
              >
                {previewContent}
              </Paragraph>
              {journal.tags.length > 0 && (
                <div style={{ marginBottom: 8 }}>
                  {journal.tags.map((tag) => (
                    <Tag key={tag} size="small" style={{ marginRight: 4 }}>
                      {tag}
                    </Tag>
                  ))}
                </div>
              )}
              <Text type="secondary" style={{ fontSize: 12 }}>
                {DateUtils.formatDateTime(journal.updatedAt)}
              </Text>
            </Card>
          </List.Item>
        );
      }}
    />
  );
}

