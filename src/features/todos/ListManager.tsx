import {
  FolderOpenOutlined,
  ArrowDownOutlined,
  ArrowUpOutlined,
  DeleteOutlined,
  EditOutlined,
  InboxOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { App, Button, Input, List, Modal, Space, Tag, Typography } from 'antd';
import { useState } from 'react';

import { getApplicationServices } from '@/app/application';
import type { TaskList } from '@/domain';

interface Props {
  readonly lists: readonly TaskList[];
  readonly open: boolean;
  readonly onClose: () => void;
}

export function ListManager({ lists, onClose, open }: Props) {
  const { message, modal } = App.useApp();
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);

  const run = async (operation: () => Promise<unknown>, success: string) => {
    setSaving(true);
    try {
      await operation();
      void message.success(success);
    } catch {
      void message.error('操作失败，原数据保持不变。');
    } finally {
      setSaving(false);
    }
  };

  const create = async () => {
    if (!newName.trim()) return;
    await run(async () => {
      const services = await getApplicationServices();
      await services.todos.createList(newName);
      setNewName('');
    }, '清单已创建');
  };

  const rename = (list: TaskList) => {
    let value = list.name;
    modal.confirm({
      title: '重命名清单',
      content: (
        <Input
          autoFocus
          defaultValue={list.name}
          aria-label="清单名称"
          onChange={(event) => {
            value = event.target.value;
          }}
        />
      ),
      okText: '保存',
      cancelText: '取消',
      onOk: () =>
        run(async () => {
          if (!value.trim()) throw new TypeError('List name cannot be empty.');
          const services = await getApplicationServices();
          await services.todos.updateList(list.id, { name: value });
        }, '清单已重命名'),
    });
  };

  const remove = (list: TaskList) => {
    modal.confirm({
      title: `删除“${list.name}”？`,
      content:
        '其中未删除的单次任务和重复系列模板会安全移动到收件箱。此操作不会删除任务。',
      okText: '删除并迁移',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        try {
          const services = await getApplicationServices();
          const result = await services.todos.deleteList(list.id);
          void message.success(
            `已迁移 ${result.movedSingleTaskCount} 个任务和 ${result.movedRecurrenceSeriesCount} 个系列`,
          );
        } catch (error) {
          void message.error('删除失败，清单和其中任务保持不变。');
          throw error;
        }
      },
    });
  };

  return (
    <Modal open={open} title="管理清单" footer={null} onCancel={onClose} width={680}>
      <form
        className="inline-create"
        onSubmit={(event) => {
          event.preventDefault();
          void create();
        }}
      >
        <Input
          value={newName}
          onChange={(event) => setNewName(event.target.value)}
          placeholder="新清单名称"
          aria-label="新清单名称"
        />
        <Button htmlType="submit" type="primary" icon={<PlusOutlined />} loading={saving}>
          创建
        </Button>
      </form>
      <List
        dataSource={[...lists].sort((a, b) => a.order - b.order)}
        locale={{ emptyText: '还没有清单' }}
        renderItem={(list) => (
          <List.Item
            actions={
              list.isSystem
                ? []
                : [
                    <Button
                      key="up"
                      type="text"
                      aria-label={`上移${list.name}`}
                      icon={<ArrowUpOutlined />}
                      onClick={() =>
                        void run(
                          async () =>
                            (await getApplicationServices()).todos.reorderList(
                              list.id,
                              -1,
                            ),
                          '顺序已更新',
                        )
                      }
                    />,
                    <Button
                      key="down"
                      type="text"
                      aria-label={`下移${list.name}`}
                      icon={<ArrowDownOutlined />}
                      onClick={() =>
                        void run(
                          async () =>
                            (await getApplicationServices()).todos.reorderList(
                              list.id,
                              1,
                            ),
                          '顺序已更新',
                        )
                      }
                    />,
                    <Button
                      key="rename"
                      type="text"
                      aria-label={`重命名${list.name}`}
                      icon={<EditOutlined />}
                      onClick={() => rename(list)}
                    />,
                    <Button
                      key="archive"
                      type="text"
                      aria-label={`${list.archived ? '恢复' : '归档'}${list.name}`}
                      icon={<FolderOpenOutlined />}
                      onClick={() =>
                        void run(
                          async () =>
                            (await getApplicationServices()).todos.updateList(list.id, {
                              archived: !list.archived,
                            }),
                          list.archived ? '清单已恢复' : '清单已归档',
                        )
                      }
                    />,
                    <Button
                      key="delete"
                      danger
                      type="text"
                      aria-label={`删除${list.name}`}
                      icon={<DeleteOutlined />}
                      onClick={() => remove(list)}
                    />,
                  ]
            }
          >
            <List.Item.Meta
              avatar={<InboxOutlined />}
              title={
                <Space>
                  {list.name}
                  {list.isSystem ? <Tag>系统</Tag> : null}
                  {list.archived ? <Tag>已归档</Tag> : null}
                </Space>
              }
              description={list.isSystem ? '默认清单，不可删除或归档' : '一级清单'}
            />
          </List.Item>
        )}
      />
      <Typography.Paragraph type="secondary">
        归档清单会从导航和新任务选择中隐藏，但保留其中任务。
      </Typography.Paragraph>
    </Modal>
  );
}
