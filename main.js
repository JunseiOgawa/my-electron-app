const { app, BrowserWindow, Menu, dialog, ipcMain } = require('electron');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

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
            contentSecurityPolicy: "default-src 'self'; script-src 'self' https://unpkg.com; style-src 'self' https://unpkg.com;"
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

    // スケジュールを取得するIPCハンドラー
    ipcMain.on('get_schedule', async (event) => {
        try {
            const schedules = await prisma.schedule.findMany();
            console.log('Fetched schedules:', schedules); // デバッグ用
            event.reply('get_schedule_response', schedules);
        } catch (error) {
            console.error('スケジュールの取得に失敗しました:', error);
            event.reply('get_schedule_response', { error: error.message });
        }
    });

    // スケジュールを保存するIPCハンドラー
    ipcMain.on('save_schedule', async (event, data) => {
        console.log('Received save_schedule IPC with data:', data); // ログ追加
        try {
            await prisma.schedule.createMany({
                data: data.map(item => ({
                    title: item.title,
                    content: item.content,
                    start: new Date(item.start),
                    end: new Date(item.end),
                    group: item.group,
                    style: item.style
                })),
                skipDuplicates: true,
            });
            console.log('Schedule saved successfully.'); // ログ追加
            event.reply('save_schedule_response', { success: true });
        } catch (error) {
            console.error('Error saving schedule:', error); // エラーログ追加
            event.reply('save_schedule_response', { success: false, error: error.message });
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