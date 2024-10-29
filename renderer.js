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
        orientation: 'top',
        height: '500px',
        margin: {
            item: 20
        }
    };

    timeline = new vis.Timeline(container, items, groups, options);
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
    document.getElementById('group').value = '1';
}

// スケジュールデータを読み込む関数
async function loadScheduleData() {
    try {
        const response = await fetch('save/schedule.json');
        const data = await response.json();
        items.add({
            id: data.id,
            content: data.title,
            start: new Date(data.start),
            end: new Date(data.end),
            title: data.memo,
            group: parseInt(data.layerNum, 10)  // jsonからの数字をlayerNumをグループとして使用
        });
    } catch (error) {
        console.error('スケジュールデータの読み込みに失敗し:', error);
    }
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
        const group = parseInt(document.getElementById('group').value, 10);

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
            group: group  // 指定されたグループに追加　レイヤーでもある
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

    // スケジュールデータを読み込む
    loadScheduleData();
}

// DOMContentLoadedイベントリスナー
document.addEventListener('DOMContentLoaded', function() {
    initialize();
});