const { app, BrowserWindow, Menu, dialog, ipcMain, Notification} = require('electron');
const path = require('path');//nodejsのpath 読み込み
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient(
);
app.setAppUserModelId('スケジュール管理ソフト');//通知で表示されるアプリ名前;

// UUIDの生成関数をmain.js内で直接定義
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

let mainWindow;
let settingsWindow = null;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 700,
        webPreferences: {
            preload: path.join(__dirname, '..', 'preload.js'), // パスを修正
            contextIsolation: true,
            devTools: !app.isPackaged,
            nodeIntegration: false,
            enableRemoteModule: false,
            allowRunningInsecureContent: false
        }
    });

    mainWindow.loadFile(path.join(__dirname, '..', 'view', 'index.html'));

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        if (!app.isPackaged) {
            mainWindow.webContents.openDevTools();
        }
    });

    mainWindow.on('closed', function () {
        mainWindow = null;
    });

    createMenu();
}

function createSettingsWindow() {
    settingsWindow = new BrowserWindow({
        width: 600,
        height: 500,
        title: '設定',
        autoHideMenuBar: true,
        webPreferences: {
            preload: path.join(__dirname, '..', 'preload.js'),
            contextIsolation: true,
            devTools: !app.isPackaged,
            nodeIntegration: false,
            enableRemoteModule: false,
            allowRunningInsecureContent: false
        }
        
    } );

    settingsWindow.loadFile(path.join(__dirname, '..', 'view', 'settings.html'));

    settingsWindow.once('ready-to-show', () => {
        settingsWindow.show();
        if (!app.isPackaged) {
            settingsWindow.webContents.openDevTools();
        }
    });

    settingsWindow.on('closed', () => {
        settingsWindow = null;
    });
}

function createMenu() {
    const template = [
        {
            label: 'Electron',
            submenu: [
                {
                    label: 'About'
                }
            ]
        },
        {
            label: 'File',
            submenu: [
                {
                    label: 'Open..',
                    accelerator: 'CmdOrCtrl+O', // ショートカットキーを��定
                    click: () => { openFile() } // 実行される関数
                },
                {
                    label: 'Save', // ラベルを追加
                    accelerator: 'CmdOrCtrl+S', // ショートカットキーを設定
                    click: () => { saveSchedule() } // 実行される関数
                },
                {
                    label: 'Exit',
                    click: () => { app.quit() } // アプリを終了
                }
                
            ]
        }
    ];
    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

// ファイル選択ダイアログを開く
function openFile() {
    dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [{ name: 'JSON Files', extensions: ['json'] }]
    }).then(result => {
        if (!result.canceled && result.filePaths.length > 0) {
            const filePath = result.filePaths[0];
            fs.readFile(filePath, 'utf-8', (err, data) => {
                if (err) {
                    console.error('ファイルの読み込みに失敗しました:', err);
                    return;
                }
                mainWindow.webContents.send('open_file', JSON.parse(data));
            });
        }
    }).catch(err => {
        console.error('Failed to open file:', err);
    });
}
app.whenReady().then(async () => {
    await initializeDatabase();
    createWindow();
    createMenu();
});

// スケジュールを保存する関数
function saveSchedule() {
    if (mainWindow) {
        mainWindow.webContents.send('get_schedule');
    }
}

app.on('ready', () => {
    createWindow();
    createMenu();

    // スケジュールを取得するIPCハンドラー
ipcMain.on('get_schedule', async (event) => {
    try {
        const schedules = await prisma.schedule.findMany();
        const formattedSchedules = schedules.map(schedule => ({//mapで配列の要素を変換する
            id: schedule.id.toString(),
            title: schedule.title,
            content: schedule.content,
            start: schedule.start ? schedule.start.toISOString() : null,
            end: schedule.end ? schedule.end.toISOString() : null,
            group: schedule.group,
            style: schedule.style,
        })).filter(item => item.start && item.end); // startとendが存在するもののみ
        event.reply('get_schedule_response', formattedSchedules);
        console.log('Sending get_schedule_response:', formattedSchedules);//デバッグログ用
        } catch (error) {
            console.error('スケジュールの取得に失敗しました:', error);
            event.reply('get_schedule_response', { error: error.message });
        }
    });

    // スケジュールを保存するIPCハンドラーを修正
    ipcMain.on('save_schedule', async (event, data) => {
        console.log('Received schedule to save:', data); 
        try {
            await prisma.$transaction(async (tx) => {
                // データベースの既存レコードを取得
                const existingSchedules = await tx.schedule.findMany({
                    select: { id: true }
                });
                const existingIds = new Set(existingSchedules.map(s => s.id));

                // 各スケジュールを処理
                for (const item of data) {
                    console.log('Processing schedule item:', item); // デバッグログ追加

                    const scheduleData = {
                        title: item.title || '',
                        content: item.content || '',
                        start: new Date(item.start),
                        end: new Date(item.end),
                        group: item.group || 1,
                        style: item.style || 'background-color: #4CAF50;',
                        remind: item.remind || false, // remindのデフォルト値を設定
                        notified: false // 通知済みフラグを初期化
                    };

                    console.log('Prepared schedule data:', scheduleData); // デバッグログ追加

                    if (existingIds.has(item.id)) {
                        console.log(`Updating existing schedule with ID: ${item.id}`);
                        await tx.schedule.update({
                            where: { id: item.id },
                            data: scheduleData
                        });
                    } else {
                        console.log('Creating new schedule');
                        await tx.schedule.create({
                            data: {
                                id: item.id,
                                ...scheduleData
                            }
                        });
                    }
                }

                // 削除されたレコードの処理
                const newIds = new Set(data.map(item => item.id));
                const idsToDelete = [...existingIds].filter(id => !newIds.has(id));
                
                if (idsToDelete.length > 0) {
                    await tx.schedule.deleteMany({
                        where: {
                            id: {
                                in: idsToDelete
                            }
                        }
                    });
                }
            });
            
            event.reply('save_schedule_response', { 
                success: true,
                message: 'スケジュールが正常に更新されました'
            });
        } catch (error) {
            console.error('Schedule update failed:', error);
            event.reply('save_schedule_response', { 
                success: false, 
                error: error.message
            });
        }
    });

    // 削除用の別ハンドラー
    ipcMain.on('delete_schedule', async (event, id) => {
        try {
            await prisma.schedule.delete({
                where: { id: BigInt(id) }
            });
            event.reply('delete_schedule_response', { success: true });
        } catch (error) {
            console.error('Error deleting schedule:', error);
            event.reply('delete_schedule_response', { success: false, error: error.message });
        }
    });

    // メモ保存用
    ipcMain.on('save_memo', async (event, memoContent) => {
        try {
            const memo = await prisma.memo.create({
                data: {
                    message: memoContent,
                    // createdAtはデフォルト値が設定されているため、省略可能
                }
            });
            event.reply('save_memo_response', { success: true, memo });
        } catch (error) {
            console.error('メモの保存に失敗:', error);
            event.reply('save_memo_response', { error: error.message });
        }
    });

    // メモ取得用ハンドラーを修正
    ipcMain.on('get_memos', async (event) => {
        console.log('メモ取得リクエストを受信');
        try {
            const memos = await prisma.chatMemo.findMany({
                orderBy: {
                    createdAt: 'desc'
                },
                select: {
                    id: true,
                    message: true,
                    createdAt: true
                }
            });
            console.log(`${memos.length}件のメモを取得しました`);
            event.reply('get_memos_response', { 
                success: true, 
                memos: memos.map(memo => ({
                    ...memo,
                    createdAt: memo.createdAt.toISOString()
                }))
            });
        } catch (error) {
            console.error('メモ取得エラー:', error);
            event.reply('get_memos_response', { 
                success: false, 
                error: error.message 
            });
        }
    });

    ipcMain.on('save_chat_memo', async (event, memo) => {
        console.log('save_chat_memoイベントを受信。メモ内容:', memo);
        try {
            const newMemo = await prisma.chatMemo.create({
                data: {
                    message: memo,
                    createdAt: new Date()
                }
            });
            console.log('新規メモを保存:', newMemo);
            event.reply('save_chat_memo_reply', { success: true, memo: newMemo });
            
            // 保存後に全メモを再取得
            const allMemos = await prisma.chatMemo.findMany({
                orderBy: { createdAt: 'desc' }
            });
            console.log('更新後の全メモ:', allMemos);
            event.reply('get_memos_response', { success: true, memos: allMemos });
        } catch (error) {
            console.error('メモ保存エラー:', error);
            event.reply('save_chat_memo_reply', { 
                success: false, 
                error: error.message 
            });
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

// IPC通信を追加
ipcMain.on('open-settings', () => {
    if (!settingsWindow) {
        createSettingsWindow();
    }
});

console.log(prisma.memo);

// MACとwindowosの通知設定 macは一応

class NotificationManager {
  async sendPlatformNotification(title, content) {
    if (process.platform === 'win32') {//windwos判別
        new Notification({
          title: title,
          body: content,
          icon: path.join(__dirname, 'icon.png')
        }).show();
    } else if (process.platform === 'darwin') {//Mac判別
      new Notification({
        title: title,
        body: content,
        subtitle: 'スケジュールリマインド',
        icon: path.join(__dirname, 'icon.png'),
        silent: false
      }).show();
    }
      new Notification({
        title: title,//1行目はタイトル
        body: content//2行目は内容
      }).show();
    }
  }

// 共通のリマインドチェック
const notificationManager = new NotificationManager();
async function checkReminders() {
    setInterval(async () => {
      try {
        const now = new Date();
        const upcomingSchedules = await prisma.schedule.findMany({
          where: {
            remind: true,
            start: {
              gte: now,　//現在時刻以降のスケジュール
              lte: new Date(now.getTime() + 15 * 60000)　//15分前に通知
            },
            notified: false
          }
        });
  
        for (const schedule of upcomingSchedules) {
          // インスタンスメソッドとして呼び出し
          await notificationManager.sendPlatformNotification(
            'スケジュールリマインド',
            `${schedule.title}\n${schedule.content}\n開始: ${schedule.start.toLocaleTimeString()}`
          );
  
          await prisma.schedule.update({
            where: { id: schedule.id },
            data: { notified: true }
          });
        }
      } catch (error) {
        console.error('リマインドチェックエラー:', error);
      }
    }, 60000);
  }

// アプリケーション起動時の初期化
app.whenReady().then(() => {
  if (!Notification.isSupported()) {
    console.log('通知がサポートされていません');
    return;
  }
  checkReminders();
});

//テストコード一時的デバッグ用　起動時に通知を送信
app.whenReady().then(() => {
    const notificationManager = new NotificationManager();
    notificationManager.sendPlatformNotification(
        'テスト通知',//1行目はタイトル
        '【electron起動時】デバッグ用'//2行目は内容
    );
});