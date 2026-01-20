import { Form, Input, Select, DatePicker, Button, Space } from 'antd';
import { useEffect } from 'react';
import dayjs from 'dayjs';
import type { CreateJournalDto, Journal } from '@/types/journal';

const { TextArea } = Input;
const { Option } = Select;

interface JournalEditorProps {
  initialValues?: Partial<Journal>;
  onSubmit: (values: CreateJournalDto) => Promise<void>;
  onCancel?: () => void;
  loading?: boolean;
  completedTasks?: Array<{ id: string; title: string }>;
}

export default function JournalEditor({
  initialValues,
  onSubmit,
  onCancel,
  loading,
  completedTasks = [],
}: JournalEditorProps) {
  const [form] = Form.useForm();

  // 当 initialValues 变化时，更新表单值
  useEffect(() => {
    if (initialValues) {
      form.setFieldsValue({
        date: initialValues.date ? dayjs(initialValues.date) : dayjs(),
        title: initialValues.title,
        content: initialValues.content || '',
        mood: initialValues.mood,
        tags: initialValues.tags || [],
        relatedTaskIds: initialValues.relatedTaskIds || [],
        encrypted: initialValues.encrypted || false,
      });
    } else {
      form.resetFields();
      form.setFieldsValue({ date: dayjs() });
    }
  }, [initialValues, form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const formData: CreateJournalDto = {
        date: values.date ? values.date.toDate() : new Date(),
        title: values.title || null,
        content: values.content || '',
        mood: values.mood || null,
        tags: values.tags || [],
        relatedTaskIds: values.relatedTaskIds || [],
        encrypted: values.encrypted || false,
      };
      await onSubmit(formData);
    } catch (error) {
      console.error('表单验证失败:', error);
    }
  };

  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={{
        date: initialValues?.date ? dayjs(initialValues.date) : dayjs(),
        title: initialValues?.title,
        content: initialValues?.content || '',
        mood: initialValues?.mood,
        tags: initialValues?.tags || [],
        relatedTaskIds: initialValues?.relatedTaskIds || [],
        encrypted: initialValues?.encrypted || false,
      }}
    >
      <Form.Item
        name="date"
        label="日期"
        rules={[{ required: true, message: '请选择日期' }]}
        initialValue={dayjs()}
      >
        <DatePicker style={{ width: '100%' }} />
      </Form.Item>

      <Form.Item name="title" label="标题">
        <Input placeholder="日记标题（可选）" />
      </Form.Item>

      <Form.Item
        name="content"
        label="内容"
        rules={[{ required: true, message: '请输入日记内容' }]}
      >
        <TextArea rows={10} placeholder="记录今天发生的事情..." />
      </Form.Item>

      <Form.Item name="mood" label="心情">
        <Select placeholder="选择心情（可选）">
          <Option value="happy">😊 开心</Option>
          <Option value="sad">😢 难过</Option>
          <Option value="angry">😠 生气</Option>
          <Option value="calm">😌 平静</Option>
          <Option value="excited">🤩 兴奋</Option>
          <Option value="tired">😴 疲惫</Option>
        </Select>
      </Form.Item>

      {completedTasks.length > 0 && (
        <Form.Item name="relatedTaskIds" label="关联已完成任务">
          <Select mode="multiple" placeholder="选择今天完成的任务（可选）">
            {completedTasks.map((task) => (
              <Option key={task.id} value={task.id}>
                {task.title}
              </Option>
            ))}
          </Select>
        </Form.Item>
      )}

      <Form.Item>
        <Space>
          <Button type="primary" onClick={handleSubmit} loading={loading}>
            保存
          </Button>
          {onCancel && <Button onClick={onCancel}>取消</Button>}
        </Space>
      </Form.Item>
    </Form>
  );
}

