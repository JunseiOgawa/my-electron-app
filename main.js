const { app, BrowserWindow, Menu, dialog, ipcMain } = require('electron');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

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
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            devTools: !app.isPackaged,
            nodeIntegration: false,
            enableRemoteModule: false,
            allowRunningInsecureContent: false
        }
    });

    mainWindow.loadFile('index.html');

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
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true
        }
        
    } );

    settingsWindow.loadFile('settings.html');

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
                    accelerator: 'CmdOrCtrl+O', // ショートカットキーを設定
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
    // main.js
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
            style: schedule.style
        })).filter(item => item.start && item.end); // startとendが存在するもののみ
        event.reply('get_schedule_response', formattedSchedules);
        console.log('Sending get_schedule_response:', formattedSchedules);//デバッグログ用
        } catch (error) {
            console.error('スケジュールの取得に失敗しました:', error);
            event.reply('get_schedule_response', { error: error.message });
        }
    });

    // スケジュールを保存するIPCハンドラー
    ipcMain.on('save_schedule', async (event,schedule) => {
        console.log('Received schedule to save:', schedule); 
        try {
            await prisma.$transaction(async (tx) => {
                // データベースの既存レコードを取得
                const existingSchedules = await tx.schedule.findMany({
                    select: { id: true }
                });
                const existingIds = new Set(existingSchedules.map(s => s.id));

                // 各スケジュールを処理
                for (const item of data) {
                    const scheduleData = {
                        title: item.title || '',
                        content: item.content || '',
                        start: new Date(item.start),
                        end: new Date(item.end),
                        group: item.group || 1,
                        style: item.style || 'background-color: #4CAF50;',
                        remind: item.remind || false 
                    };

                    console.log('Processing schedule:', { id: item.id, ...scheduleData }); // デバッグログ追加

                    if (existingIds.has(item.id)) {
                        // 既存レコードの更新
                        console.log('Updating existing schedule:', item.id);
                        await tx.schedule.update({
                            where: { id: item.id },
                            data: scheduleData
                        });
                    } else {
                        // 新規レコードの作成
                        console.log('Creating new schedule');
                        await tx.schedule.create({
                            data: {
                                id: item.id,
                                ...scheduleData//展開するときの省略記法
                            }
                        });
                    }
                }

                // 削除されたレコードの処理
                const newIds = new Set(data.map(item => item.id));
                const idsToDelete = [...existingIds].filter(id => !newIds.has(id));
                
                if (idsToDelete.length > 0) {
                    console.log('Deleting schedules:', idsToDelete);
                    await tx.schedule.deleteMany({
                        where: {
                            id: {
                                in: idsToDelete//prismaクエリのin
                            }
                        }
                    });
                }
            });
            
            console.log('Schedule update completed successfully');
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

console.log(prisma.memo); // ここでundefinedでないことを確認