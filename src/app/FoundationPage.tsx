import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export function FoundationPage() {
  return (
    <section className="foundation-page">
      <header className="hero-row">
        <div>
          <Badge variant="secondary">第一版地基</Badge>
          <h1>先把今天安排明白</h1>
          <p className="text-muted-foreground">
            待办、时间与日历将共享同一份本地数据。现在正在建立可靠的领域模型与离线能力。
          </p>
        </div>
        <div className="date-orbit" aria-label="今日进度示意">
          <span>13</span>
          <small>八月</small>
        </div>
      </header>
      <Card className="focus-card">
        <CardContent className="grid gap-5">
          <span className="text-sm text-muted-foreground">快速记录</span>
          <h3 className="text-xl font-semibold">脑中有事，就先放进收件箱。</h3>
          <Button size="lg" disabled>
            基础待办闭环即将接入
          </Button>
        </CardContent>
      </Card>
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
