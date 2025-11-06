import { ipcMain, nativeTheme, IpcMainEvent, IpcMainInvokeEvent } from 'electron';
import { database } from './database';
import { settingsManager } from './settings-manager';
import { windowManager } from './window-manager';
import { Settings, Schedule } from '../types';

let remindIntervalMinutes = 15;
let isRemindEnabled = true;

export function setupIPCHandlers(): void {
  // テーマ変更
  ipcMain.on('theme-change', (event: IpcMainEvent, theme: string) => {
    if (theme === 'dark') {
      nativeTheme.themeSource = 'dark';
    } else {
      nativeTheme.themeSource = 'light';
    }
    console.log(`テーマを${theme}に変更しました`);
  });

  // リマインド間隔の更新
  ipcMain.on('update_remind_interval', (event: IpcMainEvent, interval: number) => {
    remindIntervalMinutes = interval;
    console.log(`リマインド間隔が ${remindIntervalMinutes} 分に更新されました`);
  });

  // リマインド有効/無効の更新
  ipcMain.on('update_remind_enabled', (event: IpcMainEvent, enabled: boolean) => {
    isRemindEnabled = enabled;
    console.log(`リマインドが ${isRemindEnabled ? '有効' : '無効'} に設定`);
  });

  // 設定の取得
  ipcMain.handle('get-settings', async (): Promise<Settings> => {
    return settingsManager.getSettings();
  });

  // 設定の保存
  ipcMain.handle('save-settings', async (event: IpcMainInvokeEvent, newSettings: Settings) => {
    try {
      settingsManager.saveSettings(newSettings);
      return { success: true };
    } catch (error: any) {
      console.error('設定の保存に失敗しました:', error);
      return { success: false, error: error.message };
    }
  });

  // 設定ウィンドウを閉じる
  ipcMain.on('close-settings-window', () => {
    windowManager.closeSettingsWindow();
  });

  // スケジュールを取得
  ipcMain.on('get_schedule', async (event: IpcMainEvent) => {
    try {
      const schedules = await database.getSchedules();
      event.reply('get_schedule_response', schedules);
    } catch (error: any) {
      console.error('スケジュールの取得に失敗しました:', error);
      event.reply('get_schedule_response', { error: error.message });
    }
  });

  // スケジュールを保存
  ipcMain.on('save_schedule', async (event: IpcMainEvent, data: Schedule[]) => {
    console.log('Received schedule to save:', data);
    try {
      await database.saveSchedules(data);
      event.reply('save_schedule_response', {
        success: true,
        message: 'スケジュールが正常に更新されました',
      });
    } catch (error: any) {
      console.error('Schedule update failed:', error);
      event.reply('save_schedule_response', {
        success: false,
        error: error.message,
      });
    }
  });

  // スケジュールを削除
  ipcMain.on('delete_schedule', async (event: IpcMainEvent, id: string) => {
    try {
      await database.deleteSchedule(id);
      event.reply('delete_schedule_response', { success: true });
    } catch (error: any) {
      console.error('Error deleting schedule:', error);
      event.reply('delete_schedule_response', { success: false, error: error.message });
    }
  });

  // メモを取得
  ipcMain.on('get_memos', async (event: IpcMainEvent) => {
    console.log('メモ取得リクエストを受信');
    try {
      const memos = await database.getChatMemos();
      console.log(`${memos.length}件のメモを取得しました`);
      event.reply('get_memos_response', {
        success: true,
        memos: memos,
      });
    } catch (error: any) {
      console.error('メモ取得エラー:', error);
      event.reply('get_memos_response', {
        success: false,
        error: error.message,
      });
    }
  });

  // チャットメモを保存
  ipcMain.on('save_chat_memo', async (event: IpcMainEvent, memo: string) => {
    console.log('save_chat_memoイベントを受信。メモ内容:', memo);
    try {
      const newMemo = await database.saveChatMemo(memo);
      console.log('新規メモを保存:', newMemo);
      event.reply('save_chat_memo_reply', { success: true, memo: newMemo });

      // 保存後に全メモを再取得
      const allMemos = await database.getChatMemos();
      console.log('更新後の全メモ:', allMemos);
      event.reply('get_memos_response', { success: true, memos: allMemos });
    } catch (error: any) {
      console.error('メモ保存エラー:', error);
      event.reply('save_chat_memo_reply', {
        success: false,
        error: error.message,
      });
    }
  });

  // 設定ウィンドウを開く
  ipcMain.on('open-settings', () => {
    if (!windowManager.getSettingsWindow()) {
      windowManager.createSettingsWindow();
    }
  });
}

export function getRemindIntervalMinutes(): number {
  return remindIntervalMinutes;
}

export function getIsRemindEnabled(): boolean {
  return isRemindEnabled;
}
