const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
    receive: (channel, func) => {
        let validChannels = ['open_file'];
        if (validChannels.includes(channel)) {
            ipcRenderer.on(channel, (event, ...args) => func(...args));
        }
    }
});

// 現在の日付と月を表示
function updateDateTime() {
    const now = new Date();
    const dateStr = now.toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    const monthStr = now.toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: 'long'
    });
    
    document.getElementById('currentDate').textContent = dateStr;
    document.getElementById('currentMonth').textContent = monthStr;
}

// タイムライン初期化
let timeline;
let items;
let contextMenu;
let selectedItem = null;

function initTimeline() {
    const container = document.getElementById('timeline');
    items = new vis.DataSet();

    const options = {
        start: new Date().setHours(0, 0, 0, 0),
        end: new Date().setHours(24, 0, 0, 0),
        timeAxis: { scale: 'hour', step: 1 },
        orientation: 'bottom',  
        height: '500px',
        margin: {
            item: 20
        }
    };

    timeline = new vis.Timeline(container, items, options);
}

// コンテキストメニュー初期化
function initContextMenu() {
    contextMenu = document.getElementById('context-menu');
    document.getElementById('deleteItem').addEventListener('click', () => {
        if (selectedItem) {
            items.remove(selectedItem);
            hideContextMenu();
        }
    });

    // クリックでコンテキストメニューを非表示
    document.addEventListener('click', (e) => {
        if (!contextMenu.contains(e.target)) {
            hideContextMenu();
        }
    });
}

// コンテキストメニューを表示
function showContextMenu(x, y) {
    contextMenu.style.display = 'block';
    contextMenu.style.left = x + 'px';
    contextMenu.style.top = y + 'px';
}

// コンテキストメニューを非表示
function hideContextMenu() {
    contextMenu.style.display = 'none';
    selectedItem = null;
}

// フォームをクリア
function clearForm() {
    document.getElementById('scheduleDate').value = '';
    document.getElementById('startTime').value = '';
    document.getElementById('endTime').value = '';
    document.getElementById('title').value = '';
    document.getElementById('memo').value = '';
}

// イベントリスナーの設定
function setupEventListeners() {
    // 追加ボタン
    document.getElementById('addButton').addEventListener('click', () => {
        const date = document.getElementById('scheduleDate').value;
        const startTime = document.getElementById('startTime').value;
        const endTime = document.getElementById('endTime').value;
        const title = document.getElementById('title').value;
        const memo = document.getElementById('memo').value;
        const layer = parseInt(document.getElementById('group').value, 10);

        if (!date || !startTime || !endTime || !title) {
            alert('必須項目を入力してください');
            return;
        }

        const startDateTime = new Date(date + 'T' + startTime);
        const endDateTime = new Date(date + 'T' + endTime);

        items.add({
            id: Date.now(),
            content: title,
            start: startDateTime,
            end: endDateTime,
            title: memo,  // ツールチップとして表示
            group: layer  // 指定されたグループに追加
        });

        clearForm();
    });

    // クリアボタン
    document.getElementById('clearButton').addEventListener('click', clearForm);

    // タイムライン上の右クリック
    timeline.on('contextmenu', (props) => {
        props.event.preventDefault();
        const item = timeline.getItemAt(props.event.center);
        
        if (item) {
            selectedItem = item.id;
            showContextMenu(props.event.pageX, props.event.pageY);
        }
    });
}

// 初期化
function initialize() {
    updateDateTime();
    initTimeline();
    initContextMenu();
    setupEventListeners();

    // 1分ごとに日付を更新
    setInterval(updateDateTime, 60000);

    // 今日の日付をデフォルト値として設定
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('scheduleDate').value = today;

    // Electronからのメッセージを受信
    window.electron.receive('open_file', (data) => {
        items.add({
            id: data.id,
            content: data.title,
            start: new Date(data.start),
            end: new Date(data.end),
            title: data.memo,
            group: parseInt(data.layerNum, 10)  // layerNumをグループとして使用
        });
    });
}

// DOMContentLoadedイベントリスナー
document.addEventListener('DOMContentLoaded', function() {
    initialize();
});

const { app, BrowserWindow, dialog, Menu, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js')
        }
    });

    mainWindow.loadFile('index.html');

    mainWindow.on('closed', function () {
        mainWindow = null;
    });
}

function createMenu() {
    const menu = Menu.buildFromTemplate([
        {
            label: 'File',
            submenu: [
                {
                    label: 'Open',
                    click() {
                        openFile();
                    }
                },
                {
                    label: 'Save',
                    click() {
                        saveSchedule();
                    }
                },
                {
                    label: 'Exit',
                    click() {
                        app.quit();
                    }
                }
            ]
        }
    ]);
    Menu.setApplicationMenu(menu);
}

// スケジュールを保存する関数
function saveSchedule() {
    if (mainWindow) {
        mainWindow.webContents.send('get_schedule');
    }
}

// ファイル選択ダイアログを開く
function openFile() {
    const options = {
        title: 'Open Schedule',
        filters: [
            { name: 'JSON Files', extensions: ['json'] }
        ],
        properties: ['openFile']
    };

    dialog.showOpenDialog(mainWindow, options).then(result => {
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
        console.error('ファイル選択ダイアログの表示に失敗しました:', err);
    });
}

app.on('ready', () => {
    createWindow();
    createMenu();

    // アプリ起動時に前回のスケジュールを読み込む
    const schedulePath = path.join(__dirname, 'save', 'schedule.json');
    if (fs.existsSync(schedulePath)) {
        fs.readFile(schedulePath, 'utf-8', (err, data) => {
            if (err) {
                console.error('スケジュールの読み込みに失敗しました:', err);
                return;
            }
            mainWindow.webContents.send('open_file', JSON.parse(data));
        });
    }
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
});

// スケジュールデータを保存するIPCイベント
ipcMain.on('save_schedule', (event, schedule) => {
    const schedulePath = path.join(__dirname, 'save', 'schedule.json');
    fs.writeFile(schedulePath, JSON.stringify(schedule, null, 2), (err) => {
        if (err) {
            console.error('スケジュールの保存に失敗しました:', err);
        } else {
            console.log('スケジュールが保存されました');
        }
    });
});
