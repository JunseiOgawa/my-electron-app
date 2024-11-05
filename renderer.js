// 現在の日付を表示
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
let groups;
let contextMenu;
let selectedItem = null;

function initTimeline() {
    const container = document.getElementById('timeline');
    items = new vis.DataSet();
    groups = new vis.DataSet([
        { id: 1, content: 'レイヤー 1' },
        { id: 2, content: 'レイヤー 2' },
        { id: 3, content: 'レイヤー 3' }
    ]);

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

    timeline = new vis.Timeline(container, items, groups, options);
}

// コンテキストメニュー初期
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
    document.getElementById('dateRange').value = '';
    document.getElementById('scheduleDate').value = '';
    document.getElementById('endDate').value = '';
    document.getElementById('title').value = '';
    document.getElementById('memo').value = '';
    document.getElementById('group').value = '1';
}

// イベントリスナーの設定
function setupEventListeners() {
    // 追加ボタン
    document.getElementById('addButton').addEventListener('click', () => {
        const startDate = document.getElementById('scheduleDate').value;
        const endDate = document.getElementById('endDate').value;
        const title = document.getElementById('title').value;
        const memo = document.getElementById('memo').value;
        const layer = parseInt(document.getElementById('group').value, 10);

        if (!startDate || !endDate || !title) {
            alert('必須項目を入力してください');
            return;
        }

        const startDateTime = new Date(startDate);
        const endDateTime = new Date(endDate);

        items.add({
            id: Date.now(),
            content: title,
            start: startDateTime,
            end: endDateTime,
            title: memo,
            group: layer
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
}
//DOMの読み込みが完了したら初期化
document.addEventListener('DOMContentLoaded', function() {
    initialize();

    // flatpickrの初期化
    flatpickr("#dateRange", {
        mode: "range",
        dateFormat: "Y-m-d",
        locale: "ja",
        onChange: function(selectedDates) {
            if (selectedDates.length === 2) {
                const startDate = selectedDates[0];
                const endDate = selectedDates[1];
                document.getElementById('scheduleDate').value = startDate.toISOString().split('T')[0];
                document.getElementById('endDate').value = endDate.toISOString().split('T')[0];
            }
        }
    });
});

window.electron.receive('get_schedule', () => {
    const schedule = items.get();
    window.electron.send('save_schedule', schedule);
});

// Electronからのメッセージ受信　jsonの中身読み込み
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

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
    receive: (channel, func) => {
        let validChannels = ['open_file', 'get_schedule'];
        if (validChannels.includes(channel)) {
            ipcRenderer.on(channel, (event, ...args) => func(...args));
        }
    },
    send: (channel, data) => {
        let validChannels = ['save_schedule'];
        if (validChannels.includes(channel)) {
            ipcRenderer.send(channel, data);
        }
    }
});

// スケジュールデータを取得してメインプロセスに送信
ipcRenderer.on('get_schedule', () => {
    const schedule = items.get(); // itemsはタイムラインのデータセット
    ipcRenderer.send('save_schedule', schedule);
});