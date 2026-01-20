import { Modal } from 'antd';
import TaskForm from './TaskForm';
import type { CreateTaskDto, Task } from '@/types/task';

interface TaskModalProps {
  open: boolean;
  task?: Task;
  onOk: (values: CreateTaskDto) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

export default function TaskModal({ open, task, onOk, onCancel, loading }: TaskModalProps) {
  return (
    <Modal
      title={task ? '编辑任务' : '新建任务'}
      open={open}
      onCancel={onCancel}
      footer={null}
      width={600}
    >
      <TaskForm
        initialValues={task}
        onSubmit={onOk}
        onCancel={onCancel}
        loading={loading}
      />
    </Modal>
  );
}

