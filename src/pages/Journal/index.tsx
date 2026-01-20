import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Typography, Button, Space, Modal, Card } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { journalService } from '@/services/journalService';
import { taskService } from '@/services/taskService';
import JournalList from '@/components/journal/JournalList';
import JournalDetail from '@/components/journal/JournalDetail';
import JournalEditor from '@/components/journal/JournalEditor';
import { useJournalStore } from '@/stores/journalStore';
import type { Journal, CreateJournalDto } from '@/types/journal';
import type { Task } from '@/types/task';
import { DateUtils } from '@/utils/dateUtils';

const { Title } = Typography;

type ViewMode = 'list' | 'detail' | 'edit' | 'create';

export default function JournalPage() {
  const { date } = useParams<{ date?: string }>();
  const navigate = useNavigate();
  const { journals, setJournals, addJournal, updateJournal, deleteJournal, setLoading, isLoading } =
    useJournalStore();

  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedJournal, setSelectedJournal] = useState<Journal | null>(null);
  const [completedTasks, setCompletedTasks] = useState<Task[]>([]);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [editorModalOpen, setEditorModalOpen] = useState(false);

  // 如果有日期参数，显示该日期的日记详情
  useEffect(() => {
    if (date) {
      loadJournalByDate(date);
    } else {
      loadJournals();
    }
  }, [date]);

  useEffect(() => {
    loadCompletedTasks();
  }, []);

  const loadJournals = async () => {
    setLoading(true);
    try {
      const allJournals = await journalService.getAllJournals();
      // 按日期倒序排序
      const sorted = allJournals.sort((a, b) => b.date.getTime() - a.date.getTime());
      setJournals(sorted);
    } catch (error) {
      console.error('加载日记列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadJournalByDate = async (dateStr: string) => {
    setLoading(true);
    try {
      const date = dayjs(dateStr).toDate();
      const journal = await journalService.getJournalByDate(date);
      if (journal) {
        setSelectedJournal(journal);
        setViewMode('detail');
      } else {
        // 如果没有日记，显示创建界面
        setViewMode('create');
        setEditorModalOpen(true);
      }
    } catch (error) {
      console.error('加载日记失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCompletedTasks = async () => {
    try {
      const allTasks = await taskService.getAllTasks();
      const completed = allTasks.filter(
        (task) => task.status === 'completed' || task.status === 'archived'
      );
      setCompletedTasks(completed);
    } catch (error) {
      console.error('加载完成任务失败:', error);
    }
  };

  const getCompletedTasksForDate = (date: Date): Task[] => {
    return completedTasks.filter((task) => {
      if (!task.completedAt) return false;
      return DateUtils.isSameDay(task.completedAt, date);
    });
  };

  const handleCreate = async (values: CreateJournalDto) => {
    setLoading(true);
    try {
      const newJournal = await journalService.createJournal(values);
      addJournal(newJournal);
      setEditorModalOpen(false);
      setViewMode('list');
      // 刷新列表
      await loadJournals();
    } catch (error) {
      console.error('创建日记失败:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (values: CreateJournalDto) => {
    if (!selectedJournal) return;
    setLoading(true);
    try {
      const updated = await journalService.updateJournal(selectedJournal.id, values);
      if (updated) {
        updateJournal(selectedJournal.id, updated);
        setSelectedJournal(updated);
        setEditorModalOpen(false);
        setViewMode('detail');
        // 刷新列表
        await loadJournals();
      }
    } catch (error) {
      console.error('更新日记失败:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedJournal) return;
    setLoading(true);
    try {
      await journalService.deleteJournal(selectedJournal.id);
      deleteJournal(selectedJournal.id);
      setDeleteModalOpen(false);
      setSelectedJournal(null);
      setViewMode('list');
      // 刷新列表
      await loadJournals();
      // 如果是从路由进入的，返回列表页
      if (date) {
        navigate('/journal');
      }
    } catch (error) {
      console.error('删除日记失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleView = (journal: Journal) => {
    setSelectedJournal(journal);
    setViewMode('detail');
    navigate(`/journal/${dayjs(journal.date).format('YYYY-MM-DD')}`);
  };

  const handleEdit = (journal: Journal) => {
    setSelectedJournal(journal);
    setEditorModalOpen(true);
    setViewMode('edit');
  };

  const handleNewJournal = () => {
    setSelectedJournal(null);
    setEditorModalOpen(true);
    setViewMode('create');
  };

  const handleBackToList = () => {
    setViewMode('list');
    setSelectedJournal(null);
    navigate('/journal');
  };

  // 如果有日期参数且正在查看详情，显示详情页
  if (date && viewMode === 'detail' && selectedJournal) {
    return (
      <div>
        <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
          <Title level={2} style={{ margin: 0 }}>
            日记详情
          </Title>
          <Button onClick={handleBackToList}>返回列表</Button>
        </Space>
        <JournalDetail
          journal={selectedJournal}
          completedTasks={getCompletedTasksForDate(selectedJournal.date)}
          onEdit={() => handleEdit(selectedJournal)}
          onDelete={() => setDeleteModalOpen(true)}
        />
        <Modal
          title="确认删除"
          open={deleteModalOpen}
          onOk={handleDelete}
          onCancel={() => setDeleteModalOpen(false)}
          confirmLoading={isLoading}
        >
          <p>确定要删除这篇日记吗？此操作不可恢复。</p>
        </Modal>
      </div>
    );
  }

  // 列表视图
  return (
    <div>
      <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
        <Title level={2} style={{ margin: 0 }}>
          日记列表
        </Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleNewJournal}>
          新建日记
        </Button>
      </Space>

      <JournalList
        journals={journals}
        loading={isLoading}
        onView={handleView}
        onEdit={handleEdit}
        onDelete={(journal) => {
          setSelectedJournal(journal);
          setDeleteModalOpen(true);
        }}
      />

      {/* 编辑/创建弹窗 */}
      <Modal
        title={selectedJournal ? '编辑日记' : '新建日记'}
        open={editorModalOpen}
        onCancel={() => {
          setEditorModalOpen(false);
          if (viewMode === 'create') {
            setViewMode('list');
          }
        }}
        footer={null}
        width={800}
        destroyOnClose
      >
        <JournalEditor
          initialValues={selectedJournal || undefined}
          onSubmit={selectedJournal ? handleUpdate : handleCreate}
          onCancel={() => {
            setEditorModalOpen(false);
            if (viewMode === 'create') {
              setViewMode('list');
            }
          }}
          loading={isLoading}
          completedTasks={
            selectedJournal
              ? getCompletedTasksForDate(selectedJournal.date).map((t) => ({
                  id: t.id,
                  title: t.title,
                }))
              : getCompletedTasksForDate(new Date()).map((t) => ({
                  id: t.id,
                  title: t.title,
                }))
          }
        />
      </Modal>

      {/* 删除确认弹窗 */}
      <Modal
        title="确认删除"
        open={deleteModalOpen}
        onOk={handleDelete}
        onCancel={() => setDeleteModalOpen(false)}
        confirmLoading={isLoading}
      >
        <p>确定要删除这篇日记吗？此操作不可恢复。</p>
      </Modal>
    </div>
  );
}

