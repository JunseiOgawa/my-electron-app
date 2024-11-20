const { app, BrowserWindow, dialog, Menu, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

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

    // DOMContentLoadedイベントを待ってからスケジュールを読み込む
    mainWindow.webContents.on('dom-ready', () => {
        const saveDir = path.join(__dirname, 'save');
        const schedulePath = path.join(saveDir, 'schedule.json');
        
        if (!fs.existsSync(saveDir)) {
            fs.mkdirSync(saveDir);
        }
        
        if (!fs.existsSync(schedulePath)) {
            fs.writeFileSync(schedulePath, JSON.stringify([]));
        }
        
        fs.readFile(schedulePath, 'utf-8', (err, data) => {
            if (err) {
                console.error('スケジュールの読み込みに失敗しました:', err);
                return;
            }
            mainWindow.webContents.send('open_file', JSON.parse(data));
        });
    });

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        if (!app.isPackaged) {
            mainWindow.webContents.openDevTools(); // リリース時に削除
        }
    });

    mainWindow.on('closed', function () {
        mainWindow = null;
    });

    createMenu(); // ウィンドウ作成時にメニューを作成
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

    // アプリ起動時に前回のスケジュールを読み込む
    const saveDir = path.join(__dirname, 'save');
    const schedulePath = path.join(saveDir, 'schedule.json');
    
    // 定義しているフォルダがない場合は作成
    if (!fs.existsSync(saveDir)) {
        fs.mkdirSync(saveDir);
    }
    // ファイルがない場合は作成
    if (!fs.existsSync(schedulePath)) {
        fs.writeFileSync(schedulePath, JSON.stringify([]));
    }
    // ファイルがある場合は読み込み
    fs.readFile(schedulePath, 'utf-8', (err, data) => {
        if (err) {
            console.error('スケジュールの読み込みに失敗しました:', err);
            return;
        }
        mainWindow.webContents.send('open_file', JSON.parse(data));
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

// スケジュールデー���を保存するIPCイベント
ipcMain.on('save_schedule', (event, data) => {
    console.log('Received schedule data to save:', data);
    const saveDir = path.join(__dirname, 'save');
    const schedulePath = path.join(saveDir, 'schedule.json');

    if (!fs.existsSync(saveDir)) {
        fs.mkdirSync(saveDir);
        console.log(`Created directory: ${saveDir}`);
    }

    fs.writeFile(schedulePath, JSON.stringify(data, null, 2), (err) => {
        if (err) {
            console.error('スケジュールの保存に失敗しました:', err);
        } else {
            console.log(`スケジュールが保存されました: ${schedulePath}`);
        }
    });
});

// IPC通信を追加
ipcMain.on('open-settings', () => {
    if (!settingsWindow) {
        createSettingsWindow();
    }
});