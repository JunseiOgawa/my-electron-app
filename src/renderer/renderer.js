//デバッグ用グローバルエラーハンドラ
window.onerror = function(message, source, lineno, colno, error) {
    console.error(`エラー: ${message} at ${source}:${lineno}:${colno}`);
};

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

// メインプロセスとのIPC通信を設定
const ipcRenderer = window.electron.ipcRenderer;

// renderer.js の initTimeline 関数を修正
function initTimeline() {
    console.log('initTimeline 関数が開始されました');//デバッグ用
    const container = document.getElementById('timeline');
    console.log('タイムラインコンテナを取得しました');//デバッグ用
    // items と groups を先に初期化
    items = new vis.DataSet();
    groups = new vis.DataSet([
        { id: 1, content: 'レイヤー 1' },
        { id: 2, content: 'レイヤー 2' },
        { id: 3, content: 'レイヤー 3' },
        { id: 4, content: 'レイヤー 4' }
    ]);
    console.log('items と groups を初期化');//デバッグ用

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
    console.log('タイムラインが初期化されました'); // デバッグ用

    console.log('setupTimeScaleButtons を呼び出します');//デバッグ用
    setupTimeScaleButtons();
    console.log('setupTimeScaleButtons の呼び出しが完了');//デバッグ用

    
        timeline.setItems(items);
    };


function changeTimeScale(scale) {
    const calendarInput = document.getElementById('calendar');
    let selectedDate;

    // 日付のバリデーション処理
    try {
        if (scale === 'week' && calendarInput.value) {
            const [year, week] = calendarInput.value.split('-W').map(Number);
            console.log(`選択された年: ${year}, 週番号: ${week}`);
            if (!isNaN(year) && !isNaN(week)) {
                selectedDate = getDateOfISOWeek(year, week);
                console.log(`選択された週の開始日（ISO）: ${selectedDate}`);
            }
        } else if (calendarInput.value) {
            selectedDate = new Date(calendarInput.value);
            console.log(`選択された日付: ${selectedDate}`);
        }

        // selectedDateが無効な場合は現在日時を使用
        if (!selectedDate || isNaN(selectedDate.getTime())) {
            selectedDate = new Date();
            console.log('選択された日付が無効なため、現在日時を使用します。');
        }
    } catch (error) {
        console.error('Date conversion error:', error);
        selectedDate = new Date();
    }

    if (scale === 'week') {
        // 週選択モードの場合の処理を修正
        if (calendarInput._flatpickr && calendarInput._flatpickr.selectedDates[0]) {
            selectedDate = calendarInput._flatpickr.selectedDates[0];
        } else {
            selectedDate = new Date();
        }
    }

    let start, end, timeScale;
    console.log(`スケール変更: ${scale}, 選択日付: ${selectedDate}`);

    switch(scale) {
        case 'month':
            const currentMonth = selectedDate.getMonth();
            const currentYear = selectedDate.getFullYear();
            start = new Date(currentYear, currentMonth, 1);
            end = new Date(currentYear, currentMonth + 1, 0);
            timeScale = { scale: 'month', step: 1 };
            
            // 月モード用のflatpickr設定
            flatpickr("#calendar", {
                inline: true,
                mode: "single",
                dateFormat: "Y-m",
                locale: "ja",
                plugins: [new monthSelectPlugin({
                    shorthand: true,
                    dateFormat: "Y-m",
                    altFormat: "F Y"
                })],
                onChange: function(selectedDates) {
                    if (selectedDates.length > 0) {
                        changeTimeScale('month');
                    }
                }
            });

            timeline.setOptions({
                timeAxis: timeScale,
                start: start,
                end: end
                // pluginsは月モードのみ適用
            });
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
            
            console.log(`計算された週の開始日: ${start}`);
            console.log(`計算された週の終了日: ${end}`);
            
            // 週モード用のflatpickr設定
            flatpickr("#calendar", {
                inline: true,
                mode: "single",
                dateFormat: "Y-W", // 週番号を表示
                locale: "ja",
                plugins: [new weekSelect({})],
                onChange: function(selectedDates) {
                    if (selectedDates.length > 0) {
                        changeTimeScale('week');
                    }
                },
                // 選択範囲を週単位にスナップ
                onClose: function(selectedDates) {
                    if (selectedDates.length === 1) {
                        const selected = selectedDates[0];
                        const dayOfWeek = selected.getDay();
                        const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
                        const weekStart = new Date(selected);
                        weekStart.setDate(selected.getDate() + diff);
                        weekStart.setHours(0, 0, 0, 0);
                        
                        const weekEnd = new Date(weekStart);
                        weekEnd.setDate(weekStart.getDate() + 6);
                        weekEnd.setHours(23, 59, 59, 999);
                        
                        // 更新された週範囲を設定
                        timeline.setWindow(weekStart, weekEnd, {animation: false});
                    }
                },
                // 週を強調表示するための設定を追加
                onDayCreate: function(dObj, dStr, fp, dayElem) {
                    const selectedDate = fp.selectedDates[0];
                    if (selectedDate) {
                        const startOfWeek = new Date(selectedDate);
                        const dayOfWeek = startOfWeek.getDay();
                        const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
                        startOfWeek.setDate(startOfWeek.getDate() + diff);
                        const endOfWeek = new Date(startOfWeek);
                        endOfWeek.setDate(startOfWeek.getDate() + 6);

                        const date = dayElem.dateObj;
                        if (date >= startOfWeek && date <= endOfWeek) {
                            dayElem.classList.add('selected-week');
                        }
                    }
                }
            });

            timeline.setOptions({
                timeAxis: timeScale,
                start: start,
                end: end
            });
            break;
            
        case 'day':
            start = new Date(selectedDate);
            start.setHours(0, 0, 0, 0);
            end = new Date(selectedDate);
            end.setHours(23, 59, 59, 999);
            timeScale = { scale: 'hour', step: 1 };

            // 日モード用のflatpickr設定
            flatpickr("#calendar", {
                inline: true,
                mode: "single",
                dateFormat: "Y-m-d",
                locale: "ja",
                onChange: function(selectedDates) {
                    if (selectedDates.length > 0) {
                        changeTimeScale('day');
                    }
                }
            });
            
            timeline.setOptions({
                timeAxis: timeScale,
                start: start,
                end: end
            });
            break;

        default:
            console.error('未知のスケール:', scale);
    }
    
    // 範囲設定前に値のバリデーション
    if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
        console.log(`タイムラインのウィンドウを設定: 開始=${start}, 終了=${end}`);
        timeline.setWindow(start, end, {animation: false});
    } else {
        console.error('Invalid date range:', { start, end });
    }
}

// ISO週番号から日付を取得する補助関数
function getDateOfISOWeek(year, week) {
    console.log(`getDateOfISOWeek が呼び出されました。年: ${year}, 週番号: ${week}`);
    const simple = new Date(year, 0, 1 + (week - 1) * 7);
    const dayOfWeek = simple.getDay();
    const ISOweekStart = simple;
    
    if (dayOfWeek <= 4) {
        ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
    } else {
        ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
    }
    
    console.log(`計算されたISO週の開始日: ${ISOweekStart}`);
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
            // 他のボタンを有効化し、クリックされたボタンを無効化
            Object.values(buttons).forEach(btn => btn.disabled = false);
            button.disabled = true;

            // カレンダーを再初期化
            initializeCalendar(scale);
            // タイムラインのスケールを変更
            changeTimeScale(scale);
        });
    });

    // 初期状態で「日」ボタンを無効化
    buttons.day.disabled = true;
}

function updateCalendarInputType(scale) {
    const calendarInputContainer = document.getElementById('calendar-input-container');
    
    if (!calendarInputContainer) {
        console.error('calendar-input-container 要素が見つかりません');
        return;
    }

    let newInput = document.createElement('input');
    newInput.type = "text";
    newInput.id = "calendar";

    // 古い入力を置き換え
    calendarInputContainer.innerHTML = '';
    calendarInputContainer.appendChild(newInput);

    // フラットピッカーの設定
    switch(scale) {
        case 'month':
            calendarInstance = flatpickr(newInput, {
                inline: true,
                mode: "single",
                dateFormat: "Y-m",
                plugins: [new monthSelectPlugin({
                    shorthand: true,
                    dateFormat: "Y-m",
                    altFormat: "F Y",
                })],
                onChange: function(selectedDates) {
                    if (selectedDates.length > 0) {
                        changeTimeScale('month');
                    }
                }
            });
            break;
        case 'week':
            calendarInstance = flatpickr(newInput, {
                inline: true,
                mode: "range",
                weekNumbers: true,
                dateFormat: "Y-m-d",
                onChange: function(selectedDates) {
                    if (selectedDates.length >= 2) {
                        changeTimeScale('week');
                    }
                }
            });
            break;
        case 'day':
            calendarInstance = flatpickr(newInput, {
                inline: true,
                mode: "single",
                dateFormat: "Y-m-d",
                onChange: function(selectedDates) {
                    if (selectedDates.length > 0) {
                        changeTimeScale('day');
                    }
                }
            });
            break;
    }

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
    document.getElementById('remind').checked = false;
}
// スケジュールを保存
function saveSchedule() {
    const schedule = items.get().map(item => ({
        id: item.id || window.electron.generateUUID(),
        title: item.title || '',
        content: item.content || '',
        start: item.start,
        end: item.end,
        group: item.group || 0,
        style: item.style || 'background-color: #4CAF50;',
        remind: item.remind || false  // remind値を追加
    }));
    console.log('Sending schedule to main process:', schedule);
    window.electron.ipcRenderer.send('save_schedule', schedule);
}

// モーダルを表示する関数
function showModal() {
    document.getElementById('modal-overlay').style.display = 'block';
    document.getElementById('modal').style.display = 'grid'; // display: grid に変更

    // モーダル表示時にflatpickrを再初期化
    if (document.getElementById('dateRange')) {
        flatpickr("#dateRange", {
            mode: "range",
            dateFormat: "Y-m-d",
            locale: "ja",
            inline: false, // インラインモードをfalseに設定
            onChange: function(selectedDates) {
                if (selectedDates.length === 2) {
                    const [start, end] = selectedDates;
                    document.getElementById('scheduleDate').value = start.toISOString().split('T')[0];
                    document.getElementById('endDate').value = end.toISOString().split('T')[0];
                }
            }
        });
    }
}

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
    // 編集モーダルの初期化
    if (!document.getElementById('editDateRange')._flatpickr) {
        flatpickr("#editDateRange", {
            mode: "range",
            dateFormat: "Y-m-d",
            locale: "ja",
        });
    clearEditForm();
    }
    
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
    document.getElementById('editRemind').checked = false;
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

    // flatpickrインスタンスの初期化を確認
    const editDatepicker = document.getElementById('editDateRange');
    if (!editDatepicker._flatpickr) {
        flatpickr(editDatepicker, {
            mode: "range",
            dateFormat: "Y-m-d",
            locale: "ja",
        });
    }
    
    // 日付を設定
    editDatepicker._flatpickr.setDate([startDate, endDate]);
    document.getElementById('editRemind').checked = item.remind || false; // リマインドの値を設定
}

//編集モーダルのイベントリスナー
//編集モーダルのイベントリスナー
function setupEditModalListeners() {
    const editModal = document.getElementById('edit-modal');
    
    // モーダルでのバブリング防止
    editModal.addEventListener('click', (e) => {
        e.stopPropagation();
    });
    
    // 各種ボタンのイベントリスナー設定
    document.getElementById('edit-modal-overlay').addEventListener('click', hideEditModal);
    document.getElementById('closeEditModalButton').addEventListener('click', hideEditModal);
    document.getElementById('editClearButton').addEventListener('click', clearEditForm);
    
    document.getElementById('updateButton').addEventListener('click', () => {
        if (!selectedItem) {
            console.error('No item selected for update');
            return;
        }

        // 入力値を取得 
        const selectedDates = document.getElementById('editDateRange')._flatpickr.selectedDates;
        const startTime = document.getElementById('editStartTime').value;
        const endTime = document.getElementById('editEndTime').value;
        const title = document.getElementById('editTitle').value;
        const memo = document.getElementById('editMemo').value;
        const layer = parseInt(document.getElementById('editGroup').value, 10);
        const color = document.getElementById('editColor').value;
        const remind = document.getElementById('editRemind').checked; // リマインド値の取得は更新時に行う
    
        // バリデーション
        if (!selectedDates || selectedDates.length !== 2 || !startTime || !endTime || !title || !memo) {
            document.getElementById('edit-error-message').textContent = '編集を適応するためには必須項目を入力してください';
            document.getElementById('edit-error-message').style.display = 'block';
            return;
        }
        
    
        const startDate = selectedDates[0];
        const endDate = selectedDates[1];
    
        // 日付と時間を結合
        const [startHours, startMinutes] = startTime.split(':');
        const [endHours, endMinutes] = endTime.split(':');
        
        const startDateTime = new Date(startDate);
        startDateTime.setHours(parseInt(startHours), parseInt(startMinutes), 0);
        
        const endDateTime = new Date(endDate);
        endDateTime.setHours(parseInt(endHours), parseInt(endMinutes), 0);
    
        // 更新データを作成
        const updatedItem = {
            id: selectedItem.id,
            content: title,
            title: memo,
            start: startDateTime,
            end: endDateTime,
            group: layer,
            style: `background-color: ${color};`,
            remind: remind // リマインドの値を更新
        };
    
        console.log('Updating item:', updatedItem); // デバッグログ
    
        // タイムラインのアイテムを更新
        items.update(updatedItem);
    
        // データベースを更新
        saveSchedule();
    
        // モーダルを閉じる
        hideEditModal();
        
        // 更新完了メッセージ
        console.log('スケジュールの更新完了');
    });
    
    // スケジュール保存後のレスポンスハンドラーを追加
    window.electron.ipcRenderer.on('save_schedule_response', (event, response) => {
        console.log('Received save_schedule_response:', response); //デバッグ用
        if (response.success) {
            loadSchedules();
            console.log('スケジュールが正常に保存されました。');
        } else {
            console.log(`スケジュールの保存に失敗しました: ${response.error}`);
        }
    });
}

// 初期化
function initialize() {
    console.log('initialize が開始されました');//デバッグ用
    initTimeline();
    console.log('initTimeline を呼び出しました');//デバッグ用
    initContextMenu();
    console.log('initContextMenu を呼び出しました');//デバッグ用
    setupEventListeners();
    console.log('setupEventListeners を呼び出しました');//デバッグ用
    setupZoomSlider();
    console.log('setupZoomSlider を呼び出しました');//デバッグ用
    setupTimeScaleButtons();
    console.log('setupTimeScaleButtons を呼び出しました');//デバッグ用

    // 初期スケールを 'day' に設定してカレンダーを初期化
    console.log('初期スケール "day" でカレンダーを初期化します');//デバッグ用
    initializeCalendar('day');
    console.log('initialize 関数が終了しました');//デバッグ用
    setupChatModal();
    loadPastChatMemos();
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

    // 設定ボタンのイベントリスナーを追加
    const settingsButton = document.getElementById('settingsButton');
    if (settingsButton) {
        settingsButton.addEventListener('click', () => {
            window.electron.ipcRenderer.send('open-settings');
        });
    }

    // 削除確認モーダルのイベントリスナーを設定
    setupDeleteModalListeners();
    // モーダルクリックイベントの設定
    setupModalClickHandlers();
    // 編集モーダルのイベントリスナーを設定
    setupEditModalListeners();
    
    // タイムラインにダブルクリックイベントを追加
    timeline.on('doubleClick', function (properties) {
        if (properties.what === 'background') {
            const canvasPosition = properties.event.canvas;
            const item = items.get(properties.item);
            const groupId = properties.group; // グループIDを取得

            // グループIDが存在する場合、その番号を取得
            let layerNumber = 1; // デフォルト値
            if (groupId !== null && groupId !== undefined) {
                layerNumber = groupId;
            }

            // レイヤー番号をフォームにセット
            document.getElementById('group').value = layerNumber;

            // モーダルを表示
            showModal();
        }
    });
}

//DOMの読み込みが完了したら初期化
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOMContentLoaded を呼び出しました');//デバッグ用
    initialize();
    console.log('initialize 関数を呼び出しました');//デバッグ用
    initializeCalendar('day');
    console.log('initializeCalendar を呼び出しました');//デバッグ用
    hideModal();
    console.log('hideModal を呼び出しました');   

    // dateRange フィールドの flatpickr 初期化
    flatpickr("#dateRange", {
        mode: "range",
        dateFormat: "Y-m-d",
        locale: "ja",
        inline: false, // インラインモードをfalseに設定
        onChange: function(selectedDates) {
            if (selectedDates.length === 2) {
                const [start, end] = selectedDates;
                document.getElementById('scheduleDate').value = start.toISOString().split('T')[0];
                document.getElementById('endDate').value = end.toISOString().split('T')[0];
            } else {
                document.getElementById('scheduleDate').value = '';
                document.getElementById('endDate').value = '';
            }
        }
    });
    console.log('dateRange の flatpickr を初期化しました');//デバッグ用

    // editDateRange フィールドの flatpickr 初期化を追加
    flatpickr("#editDateRange", {
        mode: "range",
        dateFormat: "Y-m-d",
        locale: "ja",
        onChange: function(selectedDates) {
            console.log('editDateRange の onChange が呼び出されました');//デバッグ用
        }
    });
    console.log('editDateRange の flatpickr を初期化しました');//デバッグ用
});

// スケジュールを保存
window.electron.ipcRenderer.receive('get_schedule', () => {
    saveSchedule();
});

// Electronからのメッセージ受信
window.electron.ipcRenderer.receive('open_file', (data) => {
    console.log('Received open_file data:', data); // デバッグ用
    items.clear();
    data.forEach(item => {
        // 'start'プロパティが存在するか確認
        if (!item.start) {
            console.error('Item missing "start" property:', item);
            return;
        }
        const formattedItem = {
            id: Number(item.id),
            content: item.content,
            start: new Date(item.start),
            end: new Date(item.end),
            title: item.title,
            group: parseInt(item.group, 10),
            style: item.style || `background-color: #4CAF50;`
        };
        console.log('Adding item to timeline:', formattedItem); // デバッグ用
        items.add(formattedItem);
    });
    console.log('Setting items to timeline.');
    timeline.setItems(items);
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

    // デバッグ用
    console.log('モーダル日付追加時用入力データ:', {
        startDate,
        endDate,
        startTime,
        endTime,
        title,
        memo,
        group,
        color
    });

    // バリデーション
    if (!startDate || !endDate || !startTime || !endTime || !title||!group) {
        document.getElementById('error-message').style.display = 'block';
        return;
    }

    // 日付と時間
    const startDateTime = new Date(`${startDate}T${startTime}`);
    const endDateTime = new Date(`${endDate}T${endTime}`);

    // 開始時刻が終了時刻より前かチェック
    if (startDateTime >= endDateTime) {
        alert('開始時刻は終了時刻より前に設定してください');
        return;
    }

    function generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
          const r = Math.random() * 16 | 0;
          const v = c == 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16);
        });
      }
    try {
        const newId = window.electron.generateUUID();
        items.add({
            id: newId,
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
        
        // スライダー値を0-100から0.1-10の範��にマッピング
        const zoomLevel = 0.1 + (value / 10);
        const range = 12 * 60 * 60 * 1000 / zoomLevel; // 基準範囲を調整
        
        const newStart = new Date(center.getTime() - range);
        const newEnd = new Date(center.getTime() + range);
        
        timeline.setWindow(newStart, newEnd, {animation: false});
    });

    // タイムラインのズーム変更時にスラ���ダー更新
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

function openChat() {
    console.log('チャットドロワーを開きます');
    document.getElementById('chatDrawer').classList.add('open');
    
    // メモを読み込んで表示
    window.electron.ipcRenderer.send('get_memos');
}

// メモ表示用のリスナーを修正
window.electron.ipcRenderer.on('get_memos_response', (event, response) => {
    console.log('メモデータを受信:', response);
    
    let memoList = document.getElementById('memoList');
    if (!memoList) {
        console.log('memoList要素が存在しないため作成します');
        const chatModal = document.getElementById('chat-modal');
        if (chatModal) {
            memoList = document.createElement('div');
            memoList.id = 'memoList';
            chatModal.insertBefore(memoList, chatModal.firstChild);
        } else {
            console.error('chat-modal要素が見つかりません');
            return;
        }
    }

    if (response.success && memoList) {
        // メモリストを更新
        memoList.innerHTML = response.memos.map(memo => {
            // 日付をフォーマット
            const date = new Date(memo.createdAt);
            const formattedDate = date.toLocaleString('ja-JP', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });

            return `
                <div class="memo-item">
                    <div class="memo-content">${memo.message}</div>
                    <div class="memo-date">${formattedDate}</div>
                </div>
            `;
        }).join('');

        // 最新のメッセージが見えるようにスクロール
        memoList.scrollTop = memoList.scrollHeight;
        console.log('メモの表示を更新しました');
    } else {
        console.error('メモの取得に失敗:', response.error);
    }
});

// 送信ボタンのイベントリスナーを修正
document.getElementById('send-button').addEventListener('click', () => {
    const chatInput = document.getElementById('chat-input');
    const message = chatInput.value.trim();
    
    if (message) {
        console.log('新しいメモを送信:', message);
        window.electron.ipcRenderer.send('save_chat_memo', message);
        chatInput.value = ''; // 入力フィールドをクリア
    }
});

function closeChat() {
    document.getElementById('chatDrawer').classList.remove('open');
}

// カレンダーの初期化を一元化
function initializeCalendar(scale) {
    // 既存のflatpickrインスタンスを破棄して再初期化
    if (calendarInstance) {
        calendarInstance.destroy();
        calendarInstance = null;
        // カレンダー入力欄をクリア
        document.getElementById('calendar-input-container').innerHTML = '<input type="text" id="calendar">';
    }

    let calendarOptions = {
        inline: true,
        locale: "ja",
        dateFormat: "Y-m-d",
        closeOnSelect: true, // closeOnSelectを追加
        onChange: function(selectedDates) {
            if (selectedDates.length > 0) {
                if (scale === 'week') {
                    const selectedWeekDate = selectedDates[0];
                    console.log(`選択された週の日付: ${selectedWeekDate}`);
                    const startOfWeek = getStartOfWeek(selectedWeekDate);
                    const endOfWeek = getEndOfWeek(selectedWeekDate);
                    console.log(`週の開始日: ${new Date(startOfWeek)}`);
                    console.log(`週の終了日: ${new Date(endOfWeek)}`);
                    timeline.setWindow(startOfWeek, endOfWeek, {animation: false});
                } else {
                    // 他のスケールの処理
                    changeTimeScale(scale);
                }
            }
        },
    };

    switch(scale) {
        case 'month':
            calendarOptions.plugins = [new monthSelectPlugin({
                shorthand: true,
                dateFormat: "Y-m",
                altFormat: "F Y",
                theme: "light"
            })];
            calendarOptions.dateFormat = "Y-m";
            break;

        case 'week':
            calendarOptions = {
                inline: true,
                locale: "ja",
                dateFormat: "Y-\\WW", // 週番号形式を指定
                weekNumbers: true,
                onChange: function(selectedDates) {
                    if (selectedDates.length > 0) {
                        const selectedDate = selectedDates[0];
                        const startOfWeek = getStartOfWeek(selectedDate);
                        const endOfWeek = getEndOfWeek(selectedDate);
                        timeline.setWindow(startOfWeek, endOfWeek, {animation: false});
                    }
                }
            };
            break;

        case 'day':
            // 日モードの設定（必要に応じて追加）
            break;

        default:
            console.error('未知のスケール:', scale);
    }

    // 新しいflatpickrインスタンスを作成
    calendarInstance = flatpickr("#calendar", calendarOptions);
}

// 週の開始日を取得する関数を追加
function getStartOfWeek(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // 月曜日を開始日とする
    return new Date(d.setDate(diff)).setHours(0, 0, 0, 0);
}

// 週の終了日を取得する関数を追加
function getEndOfWeek(date) {
    const start = new Date(getStartOfWeek(date));
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return end;
}

// グローバル変数としてflatpickrのインスタンスを保持
let calendarInstance = null;

// スケジュールの取得をリクエスト
window.electron.ipcRenderer.send('get_schedule');

// スケジュールの取得レスポンスを受信
window.electron.ipcRenderer.on('get_schedule_response', (event, data) => {
    if (!data) {
        console.error('Received undefined data');
        alert('スケジュールの取得に失敗しました。　このアラートが出た場合は再起動');
        return;
    }

    if (data.error) {
        alert(`スケジュールの取得に失敗しました: ${data.error}　このアラートが出た場合は再起動`);
        return;
    }

    items.clear();
    data.forEach(item => {
        if (!item.start || !item.end) {
            return;
        }

        items.add({
            id: item.id,
            content: item.content,
            start: new Date(item.start),
            end: new Date(item.end),
            title: item.title,
            group: parseInt(item.group, 10),
            style: item.style || 'background-color: #4CAF50;'
        });
    });
});

// 過去のチャットメモを取得時のリスナー
window.electron.ipcRenderer.on('get_memos_response', (event, { success, memos, error }) => {
    if (success) {
        const chatContainer = document.getElementById('chat-container');
        chatContainer.innerHTML = '';
        memos.forEach(memo => {
            const chatMessage = document.createElement('div');
            chatMessage.classList.add('chat-message');
            chatMessage.textContent = memo.message;
            chatContainer.appendChild(chatMessage);
        });
    } else {
        console.error('チャットメモの取得に失敗しました:', error);
    }
});



function loadSchedules() {
    window.electron.ipcRenderer.send('get_schedule');
}

window.electron.ipcRenderer.receive('save_schedule_response', (response) => {
    console.log('Received save_schedule_response:', response);
    if (response.success) {
        loadSchedules();
        console.log('スケジュールが正常に保存されました。');
    } else {
        console.log(`スケジュールの保存に失敗しました: ${response.error}`);
    }
});

function saveMemo() {
  const message = document.getElementById('memoText').value;
  if (!message.trim()) return;

  window.electron.ipcRenderer.send('save_memo', message);
  document.getElementById('memoText').value = '';
}

window.electron.ipcRenderer.on('save_memo_response', (response) => {
  if (response.success) {
    loadMemos();
  }
});

function loadMemos() {
    console.log('メモの読み込みを開始');
    window.electron.ipcRenderer.send('get_memos');
}

// メモのレスポンスハンドラーを修正
window.electron.ipcRenderer.on('get_memos_response', (response) => {
    console.log('メモデータを受信:', response);
    if (response.success) {
        const memoList = document.getElementById('memoList');
        if (!memoList) {
            console.error('memoList要素が見つかりません');
            return;
        }

        // メモリストをクリアして新しいメモ��表示
        memoList.innerHTML = response.memos
            .map(memo => {
                const date = new Date(memo.createdAt);
                return `
                    <div class="memo-item">
                        <p>${memo.message}</p>
                        <small>${date.toLocaleString('ja-JP')}</small>
                    </div>
                `;
            })
            .join('');
        console.log('メモの表示を更新しました');
    } else {
        console.error('メモの取得に失敗:', response.error);
    }
});

// 送信ボタンのイベントリスナーを修正
document.getElementById('send-button').addEventListener('click', () => {
    const chatInput = document.getElementById('chat-input');
    const message = chatInput.value.trim();
    
    if (message) {
        console.log('新しいメモを送信:', message);
        window.electron.ipcRenderer.send('save_chat_memo', message);
        chatInput.value = ''; // 入力フィールドをクリア
    }
});

// DOMContentLoadedのイベントリスナーから初期化を削除
document.addEventListener('DOMContentLoaded', () => {

});

function saveChatMemo() {
  const memoText = document.getElementById('memoText').value.trim();
  console.log('保存しようとしているメモ:', memoText);
  if (!memoText) {
    console.log('メモが空のため保存をスキップ');
    return;
  }
  
  window.electron.ipcRenderer.send('save_chat_memo', memoText);
}

function saveChatMemo() {
    const memoText = document.getElementById('memoText').value.trim();
    console.log('saveChatMemo: メモテキスト取得:', memoText); //デバッグ用
    if (!memoText) {
      console.log('saveChatMemo: メモテキストが空です'); //　デバッグ用
      return;
    }
  
    window.electron.ipcRenderer.send('save_chat_memo', memoText);
    console.log('saveChatMemo: save_chat_memo イベントを送信'); // デバッグ用
  }

document.getElementById('clear-search-button').addEventListener('click', () => {
    document.getElementById('chat-search').value = '';
    // 必要に応じて検索結果のリセットなどを追加
});

// 初期化時に過去のチャットメモを読み込んで表示
function loadPastChatMemos() {
    // IPC通信で過去のチャットメモを取得
    ipcRenderer.send('get_memos');
    ipcRenderer.on('get_memos_response', (event, { success, memos, error }) => {
        if (success) {
            const chatContainer = document.getElementById('chat-container');
            chatContainer.innerHTML = ''; // 既存のチャットをクリア
            memos.forEach(memo => {
                const chatMessage = document.createElement('div');
                chatMessage.classList.add('chat-message');
                chatMessage.textContent = memo.message;
                chatContainer.appendChild(chatMessage);
            });
        } else {
            console.error('チャットメモの取得に失敗しました:', error);
        }
    });
}

// メモを初期化して表示する関数　※jsのjoinで追加してる
function initializeMemos() {
    window.api.send('get_memos');

    window.api.on('get_memos_response', (response) => {
        if (response.error) {
            console.error('メモの取得に失敗しました:', response.error);
            return;
        }

        // メモリストの取得または作成
        let memoList = document.getElementById('memoList');
        if (!memoList) {
            console.warn('memoList要素を作成します');
            memoList = createMemoList();
            if (!memoList) {
                console.error('memoList要素の作成に失敗しました');
                return;
            }
        }

        // メモの表示を更新
        updateMemoList(memoList, response.memos);
    });
}

function createMemoList() {
    const memoList = document.createElement('div');
    memoList.id = 'memoList';
    
    const chatModal = document.getElementById('chat-modal');
    if (!chatModal) {
        console.error('chat-modal要素が見つかりません');
        return null;
    }
    
    chatModal.appendChild(memoList);
    return memoList;
}

function updateMemoList(memoList, memos) {
    memoList.innerHTML = '';
    memos.forEach(memo => {
        const memoItem = document.createElement('div');
        memoItem.classList.add('memo-item');
        memoItem.textContent = memo.message;
        memoList.appendChild(memoItem);
    });
    console.log(`${memos.length}件のメモを表示しました`);
}

// 送信ボタンのイベントリスナーを追加
document.getElementById('send-button').addEventListener('click', () => {
    const chatInput = document.getElementById('chat-input').value.trim();
    if (chatInput) {
        window.api.send('save_chat_memo', chatInput);
        document.getElementById('chat-input').value = ''; // 入力フィールドをクリア
        initializeMemos(); // メモを再初期化
    }
});

// クリア検索ボタンのイベントリスナーを追加
document.getElementById('clear-search-button').addEventListener('click', () => {
    document.getElementById('chat-search').value = '';
});
// メモを初期化
document.addEventListener('DOMContentLoaded', () => {
    initializeMemos();
});

// IPC レスポンスのハンドラー
ipcRenderer.on('save_schedule_response', (event, response) => {
    console.log('Received save_schedule_response:', response);
    if (response) {
        if (response.success) {
            console.log('スケジュールが正常に保存されました');
        } else {
            console.error('Failed to save schedule:', response.error);
            // 追加のログ
            console.error('エラーメッセージ:', response.error);
        }
    } else {
        console.error('save_schedule_response が未定義です');
    }
});

document.getElementById('updateButton').addEventListener('click', () => {
    if (!selectedItem) {
        console.error('No item selected for update');
        return;
    }

    // 入力値を取得
    const selectedDates = document.getElementById('editDateRange')._flatpickr.selectedDates;
    const startTime = document.getElementById('editStartTime').value;
    const endTime = document.getElementById('editEndTime').value;
    const title = document.getElementById('editTitle').value;
    const memo = document.getElementById('editMemo').value;
    const layer = parseInt(document.getElementById('editGroup').value, 10);
    const color = document.getElementById('editColor').value;
    const remind = document.getElementById('editRemind').checked;

    console.log('Remind value:', remind); // デバッグログ追加

    // バリデーションと更新処理
    if (!selectedDates || selectedDates.length !== 2 || !startTime || !endTime || !title || !memo) {
        document.getElementById('edit-error-message').textContent = '編集を適応するためには必須項目を入力してください';
        document.getElementById('edit-error-message').style.display = 'block';
        return;
    }

    const startDate = selectedDates[0];
    const endDate = selectedDates[1];

    // 日付と時間を結合
    const [startHours, startMinutes] = startTime.split(':');
    const [endHours, endMinutes] = endTime.split(':');
    
    const startDateTime = new Date(startDate);
    startDateTime.setHours(parseInt(startHours), parseInt(startMinutes), 0);
    
    const endDateTime = new Date(endDate);
    endDateTime.setHours(parseInt(endHours), parseInt(endMinutes), 0);

    // 更新データを作成
    const updatedItem = {
        id: selectedItem.id,
        content: title,
        title: memo,
        start: startDateTime,
        end: endDateTime,
        group: layer,
        style: `background-color: ${color};`,
        remind: remind
    };

    console.log('Updating item with remind:', updatedItem); // デバッグログ追加

    // タイムラインのアイテムを更新
    items.update(updatedItem);

    // データベースを更新
    saveSchedule();

    // モーダルを閉じる
    hideEditModal();
});

function updateScheduleItem(updatedItem) {
    console.log('Updating timeline item:', updatedItem);
    items.update({
        ...updatedItem,
        remind: updatedItem.remind // remind値を明示的に含める
    });
    saveSchedule();
}

// チャットモーダルの初期化関数を修正
function setupChatModal() {
    console.log('チャットモーダルを初期化します');
    
    // メモリストの初期化
    if (!document.getElementById('memoList')) {
        const chatModal = document.getElementById('chat-modal');
        const memoList = document.createElement('div');
        memoList.id = 'memoList';
        chatModal.insertBefore(memoList, chatModal.firstChild);
    }
    
    const sendButton = document.getElementById('send-button');
    const chatInput = document.getElementById('chat-input');
    
    // 送信ボタンのイベントリスナー
    if (sendButton && chatInput) {
        sendButton.addEventListener('click', () => {
            const message = chatInput.value.trim();
            if (message) {
                window.electron.ipcRenderer.send('save_chat_memo', message);
                chatInput.value = '';
            }
        });

        // エンターキーでの送信
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendButton.click();
            }
        });
    }
}

// メモ表示用のリスナーを修正
window.electron.ipcRenderer.on('get_memos_response', (event, response) => {
    console.log('メモデータを受信:', response);
    
    let memoList = document.getElementById('memoList');
    if (!memoList) {
        console.log('memoList要素が存在しないため作成します');
        const chatModal = document.getElementById('chat-modal');
        if (chatModal) {
            memoList = document.createElement('div');
            memoList.id = 'memoList';
            chatModal.insertBefore(memoList, chatModal.firstChild);
        } else {
            console.error('chat-modal要素が見つかりません');
            return;
        }
    }

    if (response.success && memoList) {
        // メモリストを更新
        memoList.innerHTML = response.memos.map(memo => {
            const date = new Date(memo.createdAt);
            const formattedDate = date.toLocaleString('ja-JP', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });

            return `
                <div class="memo-item">
                    <div class="memo-content">${memo.message}</div>
                    <div class="memo-date">${formattedDate}</div>
                </div>
            `;
        }).join('');

        // 最新のメッセージが見えるようにスクロール
        memoList.scrollTop = memoList.scrollHeight;
        console.log('メモの表示を更新しました');
    } else {
        console.error('メモの取得に失敗:', response.error);
    }
});

// ...existing code...
