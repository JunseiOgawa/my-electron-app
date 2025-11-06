import { Notification } from 'electron';
import * as path from 'path';
import { NotificationData } from '../types';

export class NotificationManager {
  async sendPlatformNotification(title: string, content: string): Promise<void> {
    const notificationData: NotificationData = {
      title: title,
      body: content,
    };

    if (process.platform === 'win32') {
      // Windows判別
      new Notification({
        ...notificationData,
        icon: path.join(__dirname, 'icon.png'),
      }).show();
    } else if (process.platform === 'darwin') {
      // Mac判別
      new Notification({
        ...notificationData,
        subtitle: 'スケジュールリマインド',
        icon: path.join(__dirname, 'icon.png'),
        silent: false,
      }).show();
    } else {
      // その他のプラットフォーム
      new Notification(notificationData).show();
    }
  }
}

export const notificationManager = new NotificationManager();
