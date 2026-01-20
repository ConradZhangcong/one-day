import { Form, Input, Select, DatePicker, TimePicker, Button, Space } from 'antd';
import { useEffect } from 'react';
import dayjs from 'dayjs';
import type { CreateTaskDto, Task } from '@/types/task';

const { TextArea } = Input;
const { Option } = Select;

interface TaskFormProps {
  initialValues?: Partial<CreateTaskDto> | Partial<Task>;
  onSubmit: (values: CreateTaskDto) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

export default function TaskForm({ initialValues, onSubmit, onCancel, loading }: TaskFormProps) {
  const [form] = Form.useForm();

  // 当 initialValues 变化时，更新表单值
  useEffect(() => {
    if (initialValues) {
      // 编辑模式：设置表单值
      form.setFieldsValue({
        type: 'single',
        ...initialValues,
        startDate: initialValues.startDate ? dayjs(initialValues.startDate) : null,
        deadline: initialValues.deadline ? dayjs(initialValues.deadline) : null,
        endDate: initialValues.endDate ? dayjs(initialValues.endDate) : null,
        startTime: initialValues.startTime ? dayjs(initialValues.startTime, 'HH:mm') : null,
        recurrenceEndDate: initialValues.recurrenceEndDate
          ? dayjs(initialValues.recurrenceEndDate)
          : null,
      });
    } else {
      // 新建模式：重置表单
      form.resetFields();
      form.setFieldsValue({ type: 'single' });
    }
  }, [initialValues, form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const formData: CreateTaskDto = {
        title: values.title,
        description: values.description,
        type: values.type || 'single',
        priority: values.priority,
        tags: values.tags,
        category: values.category,
        startDate: values.startDate ? values.startDate.toDate() : null,
        startTime: values.startTime ? values.startTime.format('HH:mm') : null,
        deadline: values.deadline ? values.deadline.toDate() : null,
        endDate: values.endDate ? values.endDate.toDate() : null,
        recurrenceRule: values.recurrenceRule || null,
        recurrenceEndDate: values.recurrenceEndDate ? values.recurrenceEndDate.toDate() : null,
        recurrenceCount: values.recurrenceCount,
        parentTaskId: values.parentTaskId,
        progress: values.progress || 0,
      };
      await onSubmit(formData);
      // 提交成功后重置表单
      form.resetFields();
      form.setFieldsValue({ type: 'single' });
    } catch (error) {
      console.error('表单验证失败:', error);
    }
  };

  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={{
        type: 'single',
        ...initialValues,
        startDate: initialValues?.startDate ? dayjs(initialValues.startDate) : null,
        deadline: initialValues?.deadline ? dayjs(initialValues.deadline) : null,
        endDate: initialValues?.endDate ? dayjs(initialValues.endDate) : null,
        startTime: initialValues?.startTime ? dayjs(initialValues.startTime, 'HH:mm') : null,
        recurrenceEndDate: initialValues?.recurrenceEndDate
          ? dayjs(initialValues.recurrenceEndDate)
          : null,
      }}
    >
      <Form.Item
        name="title"
        label="任务标题"
        rules={[{ required: true, message: '请输入任务标题' }]}
      >
        <Input placeholder="请输入任务标题" />
      </Form.Item>

      <Form.Item name="description" label="任务描述">
        <TextArea rows={3} placeholder="请输入任务描述（可选）" />
      </Form.Item>

      <Form.Item name="type" label="任务类型">
        <Select>
          <Option value="single">单次任务</Option>
          <Option value="recurring">重复任务</Option>
          <Option value="long_term">长期任务</Option>
        </Select>
      </Form.Item>

      <Form.Item name="priority" label="优先级">
        <Select placeholder="选择优先级（可选）">
          <Option value="high">高</Option>
          <Option value="medium">中</Option>
          <Option value="low">低</Option>
        </Select>
      </Form.Item>

      <Form.Item name="startDate" label="开始日期">
        <DatePicker style={{ width: '100%' }} />
      </Form.Item>

      <Form.Item name="startTime" label="开始时间">
        <TimePicker style={{ width: '100%' }} format="HH:mm" />
      </Form.Item>

      <Form.Item name="deadline" label="截止时间">
        <DatePicker showTime style={{ width: '100%' }} />
      </Form.Item>

      <Form.Item
        noStyle
        shouldUpdate={(prevValues, currentValues) => prevValues.type !== currentValues.type}
      >
        {({ getFieldValue }) =>
          getFieldValue('type') === 'long_term' ? (
            <Form.Item name="endDate" label="结束日期">
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          ) : null
        }
      </Form.Item>

      <Form.Item
        noStyle
        shouldUpdate={(prevValues, currentValues) => prevValues.type !== currentValues.type}
      >
        {({ getFieldValue }) =>
          getFieldValue('type') === 'recurring' ? (
            <Form.Item name="recurrenceEndDate" label="重复结束日期">
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          ) : null
        }
      </Form.Item>

      <Form.Item>
        <Space>
          <Button type="primary" onClick={handleSubmit} loading={loading}>
            保存
          </Button>
          <Button onClick={onCancel}>取消</Button>
        </Space>
      </Form.Item>
    </Form>
  );
}

