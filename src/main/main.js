const { app, BrowserWindow, Menu, dialog, ipcMain, Notification, nativeTheme} = require('electron');
const path = require('path');//nodejsのpath 読み込み 先に読み込まないとエラー
const fs = require('fs');

const settingsPath = path.join(__dirname, '..', '..', 'config', 'settings.json');//設定ファイルのパス
let settings = {};//設定ファイルの内容を格納する変数
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
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
let settingsWindow = null;//設定ウィンドウ最初は非表示

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
    createWindow();
    createMenu();
});

//テーマ色の変更
ipcMain.on('theme-change', (event, theme) => {
    if (theme === 'dark') {
        nativeTheme.themeSource = 'dark';
    } else {
        nativeTheme.themeSource = 'light';
    }
    console.log(`テーマを${theme}に変更しました`);
});

ipcMain.on('update_remind_interval', (event, interval) => {
    remindIntervalMinutes = interval;
    console.log(`リマインド間隔が ${remindIntervalMinutes} 分に更新されました`);
});
//settings.jsonの読み込み関数
function loadSettings() {
    try {
        if (fs.existsSync(settingsPath)) {
            const data = fs.readFileSync(settingsPath, 'utf-8');
            settings = JSON.parse(data);
        } else {
            settings = {
                theme: 'dark',
                reloadFile: false,
                chatRetentionDays: 30,
                remindEnabled: false,
                remindInterval: 15,
                remindTime: '15',
                loadWeather: false
            };
        }
        return settings;
    } catch (error) {
        console.error('設定の読み込みに失敗しました:', error);
        return DEFAULT_SETTINGS;
    }
}

// 設定の保存関数
function saveSettings(settings) {
    try {
        fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
        console.log('設定を保存しました:', settings);
    } catch (error) {
        console.error('設定の保存に失敗しました:', error);
        throw error;
    }
}

ipcMain.handle('save-settings', async (event, newSettings) => {
    try {
        saveSettings(newSettings);
        return { success: true };
    } catch (error) {
        console.error('設定の保存に失敗しました:', error);
        return { success: false, error: error.message };
    }
});

//適用時に設定ウィンドウを閉じる
ipcMain.on('close-settings-window', () => {
    if (settingsWindow) {
        settingsWindow.close();
    }
});

// スケジュールを保存する関数
function saveSchedule() {
    if (mainWindow) {
        mainWindow.webContents.send('get_schedule');
    }
}

app.on('ready', () => {
// スケジュールを取得するIPCハンドラー
ipcMain.on('get_schedule', async (event) => {
    try {
        const schedules = await prisma.schedule.findMany();
        const formattedSchedules = schedules.map(schedule => ({
            id: schedule.id.toString(),
            title: schedule.title,
            content: schedule.content,
            start: schedule.start ? schedule.start.toISOString() : null,
            end: schedule.end ? schedule.end.toISOString() : null,
            group: schedule.group,
            style: schedule.style,
            remind: Boolean(schedule.remind)
        }));
        event.reply('get_schedule_response', formattedSchedules);
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

// IPCハンドラー設定を取得
ipcMain.handle('get-settings', async () => {
    return loadSettings();
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

// リマインド有効/無効のデフォルト値
let isRemindEnabled = true;

// リマインド有効/無効の更新を受け取るIPCハンドラー
ipcMain.on('update_remind_enabled', (event, enabled) => {
    isRemindEnabled = enabled;
    console.log(`リマインドが ${isRemindEnabled ? '有効' : '無効'} に設定`);
});

// 共通のリマインドチェック
const notificationManager = new NotificationManager();
async function checkReminders() {
    setInterval(async () => {
        try {
            const now = new Date();
            const remindSchedules = await prisma.schedule.findMany({
                where: {
                    start: {
                        gte: new Date(now.getTime() + 60000),
                        lte: new Date(now.getTime() + (remindIntervalMinutes * 60000))
                    },
                    notified: false,
                    remind: true
                },
            });

            // 同じ開始時刻のスケジュールをグループ化
            const groupedSchedules = remindSchedules.reduce((acc, schedule) => {
                const startTime = new Date(schedule.start).getTime();
                if (!acc[startTime]) {
                    acc[startTime] = [];
                }
                acc[startTime].push(schedule);
                return acc;
            }, {});

            // グループごとに通知を送信
            for (const [startTime, schedules] of Object.entries(groupedSchedules)) {
                const titles = schedules.map(s => s.content).join(' と ');
                const details = schedules.map(s => s.title).join('\n');
                
                await notificationManager.sendPlatformNotification(//remind表示部分
                    `${titles}`,
                    `${remindIntervalMinutes}分後に\n${details}があります。`
                );

                // 全てのスケジュールを通知済みに更新
                await prisma.schedule.updateMany({
                    where: {
                        id: {
                            in: schedules.map(s => s.id)
                        }
                    },
                    data: { 
                        notified: true
                    }
                });
            }
        } catch (error) {
            console.error('リマインドチェックエラー:', error);
        }
    }, 20000); // 20秒ごとにチェック
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
        '【electron起動時】デバッグ通知',//1行目はタイトル
        '【electron起動時】デバッグ用'//2行目は内容
    );
});