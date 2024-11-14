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

// renderer.js の initTimeline 関数を修正
function initTimeline() {
    const container = document.getElementById('timeline');
    items = new vis.DataSet();
    groups = new vis.DataSet([
        { id: 1, content: 'レイヤー 1' },
        { id: 2, content: 'レイヤー 2' },
        { id: 3, content: 'レイヤー 3' },
        { id: 4, content: 'レイヤー 4' }
    ]);

    // 初期設定は日表示
    const options = {
        start: new Date().setHours(0, 0, 0, 0),
        end: new Date().setHours(24, 0, 0, 0),
        timeAxis: { scale: 'hour', step: 1 },
        orientation: 'bottom',
        height: '500px',
        margin: { item: 20 },
        locale: 'ja', // ローカライズ設定
        locales: {
            ja: {
                current: '現在',
                time: '時間',
                date: '日付',
                // 必要に応じて他の翻訳を追加
            }
        },
        zoomMin: 1000 * 60 * 15,  // 15分
        zoomMax: 1000 * 60 * 60 * 24 * 7 * 4,  // ひと月
    };

    timeline = new vis.Timeline(container, items, groups, options);
    setupTimeScaleButtons(); // 粒度変更ボタンの設定
}

// vis.js の表示範囲を制限するために changeTimeScale 関数を修正
function changeTimeScale(scale) {
    const calendarInput = document.getElementById('calendar');
    let selectedDate;

    // 日付のバリデーション処理を追加
    try {
        if (scale === 'week' && calendarInput.value) {
            const [year, week] = calendarInput.value.split('-W').map(Number);
            if (!isNaN(year) && !isNaN(week)) {
                selectedDate = getDateOfISOWeek(year, week);
            }
        } else if (calendarInput.value) {
            const tempDate = new Date(calendarInput.value);
            if (!isNaN(tempDate.getTime())) {
                selectedDate = tempDate;
            }
        }
        
        // selectedDateが無効な場合は現在日時を使用
        if (!selectedDate || isNaN(selectedDate.getTime())) {
            selectedDate = new Date();
        }
    } catch (error) {
        console.error('Date conversion error:', error);
        selectedDate = new Date();
    }

    let start, end, timeScale;
    
    switch(scale) {
        case 'month':
            const currentMonth = selectedDate.getMonth();
            const currentYear = selectedDate.getFullYear();
            start = new Date(currentYear, currentMonth, 1);
            end = new Date(currentYear, currentMonth + 1, 0);
            timeScale = { scale: 'day', step: 1 };
            break;
            
        case 'week':
            // 週の開始日（月曜日）を計算
            const dayOfWeek = selectedDate.getDay();
            const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // 月曜日に調整
            start = new Date(selectedDate);
            start.setDate(selectedDate.getDate() + diff);
            start.setHours(0, 0, 0, 0);
            
            end = new Date(start);
            end.setDate(start.getDate() + 6);
            end.setHours(23, 59, 59, 999);
            
            timeScale = { scale: 'day', step: 1 };
            break;
            
        case 'day':
            start = new Date(selectedDate);
            start.setHours(0, 0, 0, 0);
            end = new Date(selectedDate);
            end.setHours(23, 59, 59, 999);
            timeScale = { scale: 'hour', step: 1 };
            break;
    }

    // 範囲設定前に値のバリデーション
    if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
        timeline.setOptions({
            start: start,
            end: end,
            timeAxis: timeScale
        });
    } else {
        console.error('Invalid date range:', { start, end });
    }
}

// ISO週番号から日付を取得する補助関数
function getDateOfISOWeek(year, week) {
    const simple = new Date(year, 0, 1 + (week - 1) * 7);
    const dayOfWeek = simple.getDay();
    const ISOweekStart = simple;
    
    if (dayOfWeek <= 4) {
        ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
    } else {
        ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
    }
    
    return ISOweekStart;
}

function setupCalendarChangeListener(scale) {
    const calendarInput = document.getElementById('calendar');
    
    // 既存のイベントリスナーを削除（重要）
    const clone = calendarInput.cloneNode(true);
    calendarInput.parentNode.replaceChild(clone, calendarInput);
    
    clone.addEventListener('change', (event) => {
        const value = event.target.value;
        console.log('Calendar changed:', value, scale); // デバッグ用
        
        if (!value) return;
        
        // 選択された日付に基づいてタイムラインを更新
        changeTimeScale(scale);
    });
}

// ボタン設定
function setupTimeScaleButtons() {
    const buttons = {
        month: document.getElementById('monthView'),
        week: document.getElementById('weekView'),
        day: document.getElementById('dayView')
    };

    Object.entries(buttons).forEach(([scale, button]) => {
        button.addEventListener('click', () => {
            changeTimeScale(scale);
            // カレンダーの表示形式を更新
            updateCalendarInputType(scale);
            // すべてのボタンを有効化
            Object.values(buttons).forEach(btn => btn.disabled = false);
            // クリックされたボタンを無効化
            button.disabled = true;
        });
    });

    // 初期状態で「日」ボタンを無効化
    buttons.day.disabled = true;
}

function updateCalendarInputType(scale) {
    const calendarContainer = document.getElementById('calendar-container');
    if (!calendarContainer) {
        console.error('calendar-container 要素が見つかりません');
        return;
    }

    let newInput;
    switch(scale) {
        case 'month':
            // 月選択用の入力に変更
            newInput = document.createElement('input');
            newInput.type = 'month';
            newInput.id = 'calendar';
            break;
        case 'week':
            // 週選択用の入力に変更（ブラウザによっては未対応の場合があります）
            newInput = document.createElement('input');
            newInput.type = 'week';
            newInput.id = 'calendar';
            break;
        case 'day':
            // 日付選択用の入力に変更
            newInput = document.createElement('input');
            newInput.type = 'date';
            newInput.id = 'calendar';
            break;
    }
    // 古い入力を置き換え
    calendarContainer.innerHTML = '';
    calendarContainer.appendChild(newInput);

    // カレンダー変更時のイベントリスナーを再設定
    setupCalendarChangeListener(scale);
}

// 削除確認モーダルを表示する関数
function showDeleteModal() {
    document.getElementById('delete-modal-overlay').style.display = 'block';
    document.getElementById('delete-modal').style.display = 'block';
}

// 削除確認モーダルを非表示にする関数
function hideDeleteModal() {
    document.getElementById('delete-modal-overlay').style.display = 'none';
    document.getElementById('delete-modal').style.display = 'none';
}

// 削除確認モーダルのイベントリスナー
function setupDeleteModalListeners() {
    const confirmDeleteButton = document.getElementById('confirmDeleteButton');
    const cancelDeleteButton = document.getElementById('cancelDeleteButton');

    confirmDeleteButton.addEventListener('click', () => {
        if (selectedItem) {
            console.log(`Deleting item with ID: ${selectedItem.id}`);//デバッグ用
            items.remove(selectedItem.id);
            saveSchedule(); // スケジュールを保存
            selectedItem = null; // 削除が完了したら selectedItem をクリア
        } else {
            console.log('No item selected for deletion.');//デバッグ用   
        }
        hideDeleteModal();
    });

    cancelDeleteButton.addEventListener('click', () => {
        selectedItem = null; 
        hideDeleteModal();
    });
}

// コンテキストメニュー初期化
function initContextMenu() {
    contextMenu = document.getElementById('context-menu');
    document.getElementById('deleteItem').addEventListener('click', () => {
        hideContextMenu()
        showDeleteModal();
    });

    // コンテキストメニューの編集項目のイベントリスナーを追加
    document.getElementById('editItem').addEventListener('click', () => {
        hideContextMenu();
        if (selectedItem) {
            setEditFormValues(selectedItem);
            showEditModal();
            console.log(`Item selected for editing: ${selectedItem.id}`); // デバッグ用
        }
    });

    // クリックでコンテキストメニューを非表示
    document.addEventListener('click', (e) => {
        if (!contextMenu.contains(e.target)) {
            hideContextMenu();
        }
    });

    // コンテキストメニュー内のクリックイベントがドキュメントに伝播しないようにする
    contextMenu.addEventListener('click', (e) => {
        e.stopPropagation();
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
}

// フォームをクリア
function clearForm() {
    document.getElementById('dateRange').value = '';
    document.getElementById('scheduleDate').value = '';
    document.getElementById('startTime').value = '';
    document.getElementById('endTime').value = '';
    document.getElementById('title').value = '';
    document.getElementById('memo').value = '';
    document.getElementById('group').value = '1';
    document.getElementById('color').value = '#4CAF50'; 
}
// スケジュールを保存
function saveSchedule() {
    const schedule = items.get();
    window.electron.send('save_schedule', schedule);
}

// モーダルを表示する関数
function showModal() {
    document.getElementById('modal-overlay').style.display = 'block';
    document.getElementById('modal').style.display = 'grid'; // display: grid に変更
}

// モーダルを非表示にする関数
function hideModal() {
    document.getElementById('modal-overlay').style.display = 'none';
    document.getElementById('modal').style.display = 'none';
}

// 初期化時にモーダルを非表示にする
document.addEventListener('DOMContentLoaded', function() {
    hideModal();
});

// モーダルクリック時のイベント伝播停止
function setupModalClickHandlers() {
    const modal = document.getElementById('modal');
    const deleteModal = document.getElementById('delete-modal');

    modal.addEventListener('click', (e) => {
        e.stopPropagation();
    });

    deleteModal.addEventListener('click', (e) => {
        e.stopPropagation();
    });

    // オーバーレイをクリックしたらモーダルを閉じる
    document.getElementById('modal-overlay').addEventListener('click', hideModal);
    document.getElementById('delete-modal-overlay').addEventListener('click', hideDeleteModal);
}

// 編集モーダルを表示
function showEditModal() {
    document.getElementById('edit-modal-overlay').style.display = 'block';
    document.getElementById('edit-modal').style.display = 'grid';
}

// 編集モーダルを非表示
function hideEditModal() {
    document.getElementById('edit-modal-overlay').style.display = 'none';
    document.getElementById('edit-modal').style.display = 'none';
}

// 編集フォームをクリア
function clearEditForm() {
    document.getElementById('editDateRange').value = '';
    document.getElementById('editScheduleDate').value = '';
    document.getElementById('editStartTime').value = '';
    document.getElementById('editEndTime').value = '';
    document.getElementById('editTitle').value = '';
    document.getElementById('editMemo').value = '';
    document.getElementById('editGroup').value = '1';
    document.getElementById('editColor').value = '#4CAF50';
}

// 編集フォームに値をセット
function setEditFormValues(item) {
    const startDate = new Date(item.start);
    const endDate = new Date(item.end);
    
    document.getElementById('editTitle').value = item.content;
    document.getElementById('editMemo').value = item.title;
    document.getElementById('editStartTime').value = startDate.toTimeString().slice(0,5);
    document.getElementById('editEndTime').value = endDate.toTimeString().slice(0,5);
    document.getElementById('editGroup').value = item.group;
    
    if (item.style) {
        const match = item.style.match(/background-color: (#[0-9a-fA-F]{6});/);
        if (match) {
            document.getElementById('editColor').value = match[1];
        }
    }
    
    // flatpickrの日付範囲をセット
    const editDatepicker = document.getElementById('editDateRange')._flatpickr;
    editDatepicker.setDate([startDate, endDate]);
}

function setupEditModalListeners() {
    const editModal = document.getElementById('edit-modal');
    
    editModal.addEventListener('click', (e) => {
        e.stopPropagation();
    });
    
    document.getElementById('edit-modal-overlay').addEventListener('click', hideEditModal);
    document.getElementById('closeEditModalButton').addEventListener('click', hideEditModal);
    document.getElementById('editClearButton').addEventListener('click', clearEditForm);
    
    document.getElementById('updateButton').addEventListener('click', () => {
        const startDate = document.getElementById('editScheduleDate').value;
        const startTime = document.getElementById('editStartTime').value;
        const endDate = document.getElementById('editEndDate').value;
        const endTime = document.getElementById('editEndTime').value;
        const title = document.getElementById('editTitle').value;
        const memo = document.getElementById('editMemo').value;
        const layer = parseInt(document.getElementById('editGroup').value, 10);
        const color = document.getElementById('editColor').value;

        if (!startDate || !startTime || !endDate || !endTime || !title) {
            alert('必須項目を入力してください');
            return;
        }

        const startDateTime = new Date(`${startDate}T${startTime}`);
        const endDateTime = new Date(`${endDate}T${endTime}`);

        if (startDateTime >= endDateTime) {
            alert('開始時刻は終了時刻より前に設定してください');
            return;
        }

        items.update({
            id: selectedItem.id,
            content: title,
            start: startDateTime,
            end: endDateTime,
            title: memo,
            group: layer,
            style: `background-color: ${color};`
        });

        saveSchedule();
        clearEditForm();
        hideEditModal();
    });
}

// 初期化
function initialize() {
    initTimeline();
    initContextMenu();
    setupEventListeners();
    setupZoomSlider();
    setupTimeScaleButtons();

    // タイムスケールに応じたカレンダー入力を設定
    setupCalendarChangeListener('day');

    // 初期ロード時に「日」ボタンを無効化
    document.getElementById('dayView').disabled = true;

    hideModal(); // 初期化時にモーダルを非表示にする
}

// タイムライン上の右クリックイベント
function setupEventListeners() {
    // 追加ボタン
    const addButton = document.getElementById('addButton');
    if (addButton) {
        addButton.addEventListener('click', function(event) {
            const dateRange = document.getElementById('dateRange');
            const startTime = document.getElementById('startTime');
            const endTime = document.getElementById('endTime');
            const title = document.getElementById('title');
            const memo = document.getElementById('memo');
            const errorDateTime = document.getElementById('error-date-time');
            const errorTitle = document.getElementById('error-title');
            const errorMemo = document.getElementById('error-memo');
            let isValid = true;
            if (dateRange.value.trim() === '' || startTime.value.trim() === '' || endTime.value.trim() === '') {
                errorDateTime.style.display = 'block';
                isValid = false;
            } else {
                errorDateTime.style.display = 'none';
            }
            if (title.value.trim() === '') {
                errorTitle.style.display = 'block';
                isValid = false;
            } else {
                errorTitle.style.display = 'none';
            }
            if (memo.value.trim() === '') {
                errorMemo.style.display = 'block';
                isValid = false;
            } else {
                errorMemo.style.display = 'none';
            }
            if (isValid) {
                // フォームの送信処理をここに追加
            }
        });
    }

    // クリアボタン
    const clearButton = document.getElementById('clearButton');
    if (clearButton) {
        clearButton.addEventListener('click', clearForm);
    }

    // モーダルの閉じるボタン
    const closeModalButton = document.getElementById('closeModalButton');
    if (closeModalButton) {
        closeModalButton.addEventListener('click', hideModal);
    }

    // タイムラインのダブルクリックでモーダルを開く（必要に応じて）
    timeline.on('doubleClick', () => {
        showModal();
    });

    // タイムライン上の右クリック
    timeline.on('contextmenu', (props) => {
        props.event.preventDefault();
        const item = props.item; 
        
        if (item) {
            selectedItem = items.get(item); // selectedItem を設定
            showContextMenu(props.event.pageX, props.event.pageY);
        } else {
            selectedItem = null;
        }
    });

    // 削除確認モーダルのイベントリスナーを設定
    setupDeleteModalListeners();
    // モーダルクリックイベントの設定
    setupModalClickHandlers();
    // 編集モーダルのイベントリスナーを設定
    setupEditModalListeners();
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

    // DOMContentLoadedイベントリスナーに追加
    flatpickr("#editDateRange", {
        mode: "range",
        dateFormat: "Y-m-d",
        locale: "ja",
        onChange: function(selectedDates) {
            if (selectedDates.length === 2) {
                const startDate = selectedDates[0];
                const endDate = selectedDates[1];
                document.getElementById('editScheduleDate').value = startDate.toISOString().split('T')[0];
                document.getElementById('editEndDate').value = endDate.toISOString().split('T')[0];
            }
        }
    });
});

// スケジュールを保存
window.electron.receive('get_schedule', () => {
    saveSchedule();
});

// Electronからのメッセージ受信 jsonの中身読み込み
window.electron.receive('open_file', (data) => {
    items.clear();
    data.forEach(item => {
        // スタイル文字列からカラー値を抽出
        let color = '#4CAF50'; // デフォルトカラー
        if (item.style) {
            const match = item.style.match(/background-color: (#[0-9a-fA-F]{6});/);//正規でカラーを取得
            if (match) {
                color = match[1];
            }
        }

        items.add({
            id: item.id,
            content: item.content,
            start: new Date(item.start),
            end: new Date(item.end),
            title: item.title,
            group: parseInt(item.group, 10),
            style: item.style || `background-color: ${color};`
        });
    });
});

document.getElementById('addButton').addEventListener('click', function() {
    // フォームの値を取得
    const startDate = document.getElementById('scheduleDate').value;
    const endDate = document.getElementById('endDate').value;
    const startTime = document.getElementById('startTime').value;
    const endTime = document.getElementById('endTime').value;
    const title = document.getElementById('title').value;
    const memo = document.getElementById('memo').value;
    const group = parseInt(document.getElementById('group').value, 10);
    const color = document.getElementById('color').value;

    // バリデーション
    if (!startDate || !endDate || !startTime || !endTime || !title || !memo) {
        document.getElementById('error-message').style.display = 'block';
        return;
    }

    // 日付と時間を結合
    const startDateTime = new Date(`${startDate}T${startTime}`);
    const endDateTime = new Date(`${endDate}T${endTime}`);

    // 開始時刻が終了時刻より前かチェック
    if (startDateTime >= endDateTime) {
        alert('開始時刻は終了時刻より前に設定してください');
        return;
    }

    // スケジュールを追加
    try {
        items.add({
            id: Date.now(),
            content: title,
            start: startDateTime,
            end: endDateTime,
            title: memo,
            group: group,
            style: `background-color: ${color};`
        });
        saveSchedule();
        clearForm();
        hideModal();
    } catch (error) {
        console.error('スケジュール追加エラー:', error);
    }
});

function setupZoomSlider() {
    const slider = document.getElementById('zoomSlider');
    
    // 初期設定
    slider.value = 50; // デフォルト値
    
    // スライダー変更時のイベント
    slider.addEventListener('input', function(e) {
        const value = parseInt(e.target.value);
        const currentWindow = timeline.getWindow();
        const center = new Date((currentWindow.start.getTime() + currentWindow.end.getTime()) / 2);
        
        // スライダー値を0-100から0.1-10の範囲にマッピング
        const zoomLevel = 0.1 + (value / 10);
        const range = 12 * 60 * 60 * 1000 / zoomLevel; // 基準範囲を調整
        
        const newStart = new Date(center.getTime() - range);
        const newEnd = new Date(center.getTime() + range);
        
        timeline.setWindow(newStart, newEnd, {animation: false});
    });

    // タイムラインのズーム変更時にスライダー更新
    timeline.on('rangechange', function(properties) {
        if (!properties.byUser) return; // ユーザーの操作以外は無視
        
        const duration = properties.end - properties.start;
        const baseRange = 12 * 60 * 60 * 1000; // 12時間を基準
        const zoomLevel = baseRange / duration;
        let newValue = Math.log2(zoomLevel) * 10 + 50;
        
        // スライダーの値を0-100に制限
        newValue = Math.min(Math.max(newValue, 0), 100);
        
        // スライダーの値を更新
        slider.value = newValue;
    });
}