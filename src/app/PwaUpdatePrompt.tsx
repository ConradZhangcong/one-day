import { App, Button } from 'antd';
import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

export function PwaUpdatePrompt() {
  const { notification } = App.useApp();
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  useEffect(() => {
    if (!needRefresh) return;

    const key = 'pwa-update';
    notification.info({
      key,
      message: 'One Day 有新版本',
      description: '保存好当前编辑后即可更新，不会在操作中强制刷新。',
      duration: 0,
      btn: (
        <Button
          type="primary"
          onClick={() => {
            void updateServiceWorker(true);
          }}
        >
          更新并重新加载
        </Button>
      ),
      onClose: () => setNeedRefresh(false),
    });

    return () => notification.destroy(key);
  }, [needRefresh, notification, setNeedRefresh, updateServiceWorker]);

  return null;
}
