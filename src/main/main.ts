import { app, BrowserWindow, Notification } from 'electron';
import { windowManager } from './window-manager';
import { setupIPCHandlers, getRemindIntervalMinutes } from './ipc-handlers';
import { database } from './database';
import { notificationManager } from './notification-manager';

app.setAppUserModelId('スケジュール管理ソフト');

// アプリケーション準備完了時
app.whenReady().then(async () => {
  windowManager.createMainWindow();
  setupIPCHandlers();

  // 通知サポートチェック
  if (Notification.isSupported()) {
    checkReminders();

    // テスト通知を送信
    notificationManager.sendPlatformNotification(
      'テスト通知',
      '【electron起動時】デバッグ用'
    );
  } else {
    console.log('通知がサポートされていません');
  }
});

// 全ウィンドウが閉じられた時
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// アクティベート時
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    windowManager.createMainWindow();
  }
});

// リマインドチェック機能
async function checkReminders(): Promise<void> {
  setInterval(async () => {
    try {
      const remindIntervalMinutes = getRemindIntervalMinutes();
      const remindSchedules = await database.getRemindSchedules(remindIntervalMinutes);

      // 同じ開始時刻のスケジュールをグループ化
      const groupedSchedules = remindSchedules.reduce((acc, schedule) => {
        const startTime = new Date(schedule.start).getTime();
        if (!acc[startTime]) {
          acc[startTime] = [];
        }
        acc[startTime].push(schedule);
        return acc;
      }, {} as Record<number, typeof remindSchedules>);

      // グループごとに通知を送信
      for (const [startTime, schedules] of Object.entries(groupedSchedules)) {
        const titles = schedules.map((s) => s.content).join(' と ');
        const details = schedules.map((s) => s.title).join('\n');

        await notificationManager.sendPlatformNotification(
          'スケジュールリマインド',
          `${titles}\n${details}\n${remindIntervalMinutes}分後に開始します`
        );

        // 全てのスケジュールを通知済みに更新
        await database.markSchedulesAsNotified(schedules.map((s) => s.id));
      }
    } catch (error) {
      console.error('リマインドチェックエラー:', error);
    }
  }, 60000); // 1分ごとにチェック
}
