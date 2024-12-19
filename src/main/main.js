const { app, BrowserWindow, Menu, dialog, ipcMain, Notification, nativeTheme} = require('electron');
const { exec } = require('child_process');
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

    // 追加: focus イベントハンドラー
    mainWindow.on('focus', () => {
        if (settingsWindow && !settingsWindow.isDestroyed()) {
            playErrorSound();
        }
    });

    createMenu();
}


// メインウィンドウをちらつかせる関数
function flickerWindow(window, times, interval) {
    let count = 0;
    const originalOpacity = window.getOpacity();

    const flickerInterval = setInterval(() => {
        // 透明度を切り替える
        window.setOpacity(originalOpacity === 1 ? 0.8 : 1);
        count++;
        if (count >= times * 2) { // 各回ごとに透明度を2回切り替える
            clearInterval(flickerInterval);
            window.setOpacity(originalOpacity); // 元の透明度に戻す
        }
    }, interval);
}


function createSettingsWindow() {
    settingsWindow = new BrowserWindow({
        width: 600,
        height: 500,
        title: '設定',
        parent: mainWindow,
        modal: true,
        resizable: false,          // ウィンドウのサイズ変更を不可にする
        maximizable: false,        // 最大化ボタンを無効にする
        minimizable: false,        // 最小化ボタンを無効にする
        autoHideMenuBar: true,
        webPreferences: {
            preload: path.join(__dirname, '..', 'preload.js'),
            contextIsolation: true,
            devTools: !app.isPackaged,
            nodeIntegration: false,
            enableRemoteModule: false,
            allowRunningInsecureContent: false
        }
    });

    settingsWindow.loadFile(path.join(__dirname, '..', 'view', 'settings.html'));

    settingsWindow.once('ready-to-show', () => {
        settingsWindow.show();
        if (!app.isPackaged) {
            settingsWindow.webContents.openDevTools();
        }
    });

    settingsWindow.on('closed', () => {
        settingsWindow = null;
        mainWindow.flashFrame(false);
    });

    // ウィンドウのサイズ変更や最大化を試みたときに無効にする
    settingsWindow.on('maximize', () => {
        settingsWindow.unmaximize();
    });

    settingsWindow.on('minimize', () => {
        settingsWindow.restore();
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
                    accelerator: 'CmdOrCtrl+O', // ショートカットキー
                    click: () => { openFile() } // 実行される関数
                },
                {
                    label: 'Save', // ラベルを追加
                    accelerator: 'CmdOrCtrl+S',
                    click: () => { saveSchedule() }
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

// エラー音を再生する関数　windowsのみ　おまじない関数
function playErrorSound() {
    exec('powershell -c (New-Object Media.SoundPlayer "C:\\Windows\\Media\\Windows Error.wav").PlaySync();');
}

// アプリケーション起動時の初期化処理を修正
app.whenReady().then(async () => {
    if (!Notification.isSupported()) {
        console.log('通知がサポートされていません');
        return;
    }

    // 設定を読み込む
    const settings = loadSettings();
    console.log('アプリ起動時の設定:', settings);

    // リマインド間隔の初期設定
    if (settings.remindTime === '0' || settings.remindTime === 'simultaneous') {
        remindIntervalMinutes = 0;
        console.log('同時リマインドモードで初期化');
    } else {
        remindIntervalMinutes = parseInt(settings.remindTime) || 15;
        console.log(`リマインド間隔 ${remindIntervalMinutes} 分で初期化`);
    }

    // isRemindEnabledの初期設定
    isRemindEnabled = settings.remindEnabled || false;
    console.log(`リマインド機能: ${isRemindEnabled ? '有効' : '無効'}`);

    // リマインドチェックを開始
    checkReminders();
    createWindow();
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

// remindIntervalMinutesのデフォルト値を設定
let remindIntervalMinutes = 15;

ipcMain.on('update_remind_interval', (event, interval) => {
    console.log('受け取ったinterval:', interval); // デバッグ用

    if (interval === 'simultaneous' || interval === '0') {
        remindIntervalMinutes = 0;
    } else {
        remindIntervalMinutes = parseInt(interval) || 15;
    }
    
    console.log(`リマインド間隔を ${remindIntervalMinutes} 分に設定しました`);
});

// loadSettings関数を修正
function loadSettings() {
    try {
        if (fs.existsSync(settingsPath)) {
            const data = fs.readFileSync(settingsPath, 'utf-8');
            console.log('読み込んだ設定ファイルの内容:', data); // デバッグ用
            settings = JSON.parse(data);
            
            console.log('設定のremindTime:', settings.remindTime); // デバッグ用
            
            if (settings.remindTime === '0' || settings.remindTime === 'simultaneous') {
                remindIntervalMinutes = 0;
            } else {
                remindIntervalMinutes = parseInt(settings.remindTime) || 15;
            }
            
            console.log('設定後のremindIntervalMinutes:', remindIntervalMinutes); // デバッグ用
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
        console.log('新しい設定を保存します:', newSettings); // デバッグログ追加
        saveSettings(newSettings);
        
        // 設定保存直後にremindIntervalMinutesを更新
        if (newSettings.remindTime === '0' || newSettings.remindTime === 'simultaneous') {
            remindIntervalMinutes = 0;
            console.log('リマインド間隔を0分に設定しました（即時）');
        } else {
            remindIntervalMinutes = parseInt(newSettings.remindTime) || 15;
            console.log(`リマインド間隔を${remindIntervalMinutes}分に設定しました（時間指定）`);
        }
        
        return { success: true };
    } catch (error) {
        console.error('設定の保存に失敗しました:', error);
        return { success: false, error: error.message };
    }
});

// update_remind_intervalイベントハンドラーも修正
ipcMain.on('update_remind_interval', (event, interval) => {
    console.log('update_remind_intervalイベント受信:', interval);
    
    if (interval === 'simultaneous' || interval === '0') {
        remindIntervalMinutes = 0;
        console.log('同時リマインドに設定');
    } else {
        const parsedInterval = parseInt(interval);
        remindIntervalMinutes = parsedInterval || 15;
        console.log(`リマインド間隔を${remindIntervalMinutes}分に設定`);
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
                const existingSchedules = await tx.schedule.findMany({
                    select: { id: true }
                });
                const existingIds = new Set(existingSchedules.map(s => s.id));

                for (const item of data) {
                    console.log('Processing schedule item:', item);

                    const scheduleData = save_schedule_handler(tx, item);

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
    console.log('-----リマインドチェック開始-----');
    console.log('現在のremindIntervalMinutes:', remindIntervalMinutes);

    setInterval(async () => {
        try {
            const now = new Date();
            console.log(`\n現在時刻: ${now.toLocaleString()}`);
            let remindSchedules = [];

            if (remindIntervalMinutes === 0) {
                // 同時リマインドの場合
                const queryStartTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes(), 0);
                const queryEndTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes() + 1, 0);
                
                remindSchedules = await prisma.schedule.findMany({
                    where: {
                        start: {
                            gte: queryStartTime,
                            lt: queryEndTime
                        },
                        notified: false,
                        remind: true
                    },
                });
            } else {
                // 時間指定リマインドの場合
                const futureTime = new Date(now.getTime() + remindIntervalMinutes * 60000);
                console.log(`検索する未来の時刻: ${futureTime.toLocaleString()}`);

                remindSchedules = await prisma.schedule.findMany({
                    where: {
                        start: {
                            gte: new Date(futureTime.getFullYear(), futureTime.getMonth(), futureTime.getDate(), futureTime.getHours(), futureTime.getMinutes(), 0),
                            lt: new Date(futureTime.getFullYear(), futureTime.getMonth(), futureTime.getDate(), futureTime.getHours(), futureTime.getMinutes() + 1, 0)
                        },
                        notified: false,
                        remind: true
                    },
                });
            }

            console.log('検索結果件数:', remindSchedules.length);
            if (remindSchedules.length > 0) {
                console.log('検出されたスケジュール:', remindSchedules.map(s => ({
                    id: s.id,
                    title: s.content,
                    start: s.start,
                    notified: s.notified,
                    remind: s.remind
                })));

                // 同じ開始時刻のスケジュールをグループ化
                const groupedSchedules = remindSchedules.reduce((acc, schedule) => {
                    const startTimeKey = new Date(schedule.start).getTime().toString();
                    if (!acc[startTimeKey]) {
                        acc[startTimeKey] = [];
                    }
                    acc[startTimeKey].push(schedule);
                    return acc;
                }, {});

                // グループごとに通知を送信
                for (const schedules of Object.values(groupedSchedules)) {
                    const titles = schedules.map(s => s.content).join(' と ');
                    const details = schedules.map(s => s.title).join('\n');
                    
                    let notificationMessage;
                    switch(true) {
                        case remindIntervalMinutes === 0:
                            // 同時通知の場合
                            notificationMessage = `今から\n${details}が始まりました。`;
                            break;
                        case remindIntervalMinutes > 0:
                            // カスタム時間（1分以上）の場合
                            notificationMessage = `${remindIntervalMinutes}分後に\n${details}があります。`;
                            break;
                        default:
                            console.log('不正なリマインド時間設定です');
                            return;
                    }
                
                    await notificationManager.sendPlatformNotification(
                        `${titles}`,
                        notificationMessage
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
            }
        } catch (error) {
            console.error('リマインドチェックエラー:', error);
        }
    }, 1000);
}

// アプリケーション起動時の初期化
app.whenReady().then(() => {
    if (!Notification.isSupported()) {
        console.log('通知がサポートされていません');
        return;
    }
});

// スケジュール保存時にlockプロパティを含めるように修正
function save_schedule_handler(tx, item) {
    const scheduleData = {
        title: item.title || '',
        content: item.content || '',
        start: new Date(item.start),
        end: new Date(item.end),
        group: item.group || 1,
        style: item.style || 'background-color: #4CAF50;',
        remind: item.remind || false,
    };

    if (item.lock !== undefined) { // lockフィールドが存在する場合のみ追加
        scheduleData.lock = item.lock;
    }

    return scheduleData;
}

// ipcMain.on('save_schedule') 内の処理を修正
ipcMain.on('save_schedule', async (event, data) => {
    console.log('Received schedule to save:', data); 
    try {
        await prisma.$transaction(async (tx) => {
            const existingSchedules = await tx.schedule.findMany({
                select: { id: true }
            });
            const existingIds = new Set(existingSchedules.map(s => s.id));

            for (const item of data) {
                console.log('Processing schedule item:', item);

                const scheduleData = save_schedule_handler(tx, item);

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