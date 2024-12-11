document.addEventListener('DOMContentLoaded', function() {
    // リマインド有効/無効の切り替え
    const remindEnabled = document.getElementById('remind-enabled');
    const remindSettings = document.getElementById('remind-settings');
    
    remindEnabled.addEventListener('change', function() {
        remindSettings.style.display = this.checked ? 'block' : 'none';
    });

    // カスタム時間の表示/非表示
    const remindTimeRadios = document.getElementsByName('remind-time');
    const customTimeContainer = document.getElementById('custom-time-container');
    
    remindTimeRadios.forEach(radio => {
        radio.addEventListener('change', function() {
            customTimeContainer.style.display = this.value === 'custom' ? 'block' : 'none';
        });
    });
});


function isRemindEnabled() {
    const remindEnabledCheckbox = document.getElementById('remind-enabled');// チェックボックスの要素を取得
    return remindEnabledCheckbox ? remindEnabledCheckbox.checked : false;
}

// // 2. リマインド処理の条件追加
// function scheduleReminder(item) {
//     if (!isRemindEnabled()) {
//         console.log('リマインドが無効化されています。');
//         return;
//     }
//     // リマインド処理のロジック
//     // 例: setTimeout や通知の表示
// }

// // スケジュール保存時やリマインド設定時に呼び出し
// function saveSchedule() {
//     // 既存の保存ロジック
//     // ...

//     // リマインドの設定
//     if (isRemindEnabled()) {
//         scheduleReminder(savedItem);
//     }
// }

// // 3. 設定変更のリスナー追加
// document.getElementById('remind-enabled').addEventListener('change', (event) => {
//     if (!event.target.checked) {
//         // リマインドをキャンセルするロジック
//         cancelAllReminders();
//     }
// });　　　　　　　　　スケジュールのリマインドが出来てから実装する