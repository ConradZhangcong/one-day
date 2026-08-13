import { Button, Space, Tag, Typography } from 'antd';

export function FoundationPage() {
  return (
    <section className="foundation-page">
      <header className="hero-row">
        <div>
          <Tag bordered={false}>第一版地基</Tag>
          <Typography.Title>先把今天安排明白</Typography.Title>
          <Typography.Paragraph>
            待办、时间与日历将共享同一份本地数据。现在正在建立可靠的领域模型与离线能力。
          </Typography.Paragraph>
        </div>
        <div className="date-orbit" aria-label="今日进度示意">
          <span>13</span>
          <small>八月</small>
        </div>
      </header>
      <div className="focus-card">
        <Space direction="vertical" size="large">
          <Typography.Text type="secondary">快速记录</Typography.Text>
          <Typography.Title level={3}>脑中有事，就先放进收件箱。</Typography.Title>
          <Button type="primary" size="large" disabled>
            基础待办闭环即将接入
          </Button>
        </Space>
      </div>
      <div className="principle-grid">
        <article>
          <strong>计划 ≠ 截止</strong>
          <span>分别表达什么时候做，以及最晚什么时候完成。</span>
        </article>
        <article>
          <strong>离线可用</strong>
          <span>数据保留在当前设备，并提供可验证的备份恢复。</span>
        </article>
        <article>
          <strong>重复不堆积</strong>
          <span>每个系列只有一个活跃实例，错过后从容恢复。</span>
        </article>
      </div>
    </section>
  );
}
