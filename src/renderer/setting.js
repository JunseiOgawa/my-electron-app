const { ipcRenderer } = window.electron;


document.addEventListener('DOMContentLoaded', async () => {
    // リマインド有効/無効の切り替え
    const remindEnabled = document.getElementById('remind-enabled');
    const remindSettings = document.getElementById('remind-settings');
    
    remindEnabled.addEventListener('change', function() {
        remindSettings.style.display = this.checked ? 'block' : 'none';
        ipcRenderer.send('update_remind_enabled', this.checked);
    });

    // カスタム時間の表示/非表示
    const remindTimeRadios = document.getElementsByName('remind-time');
    const customTimeContainer = document.getElementById('custom-time-container');
    
    remindTimeRadios.forEach(radio => {
        radio.addEventListener('change', function() {
            customTimeContainer.style.display = this.value === 'custom' ? 'block' : 'none';
            // リマインド間隔を更新
            let interval;
            if (this.value === 'custom') {
                interval = parseInt(document.getElementById('custom-remind-time').value) || 1;
            } else {
                interval = parseInt(this.value) || 15;
            }
                ipcRenderer.send('update_remind_interval', interval);
        });
    });

    const customRemindTimeInput = document.getElementById('custom-remind-time');
    customRemindTimeInput.addEventListener('input', function() {
        const interval = parseInt(this.value) || 1;
        ipcRenderer.send('update_remind_interval', interval);
    });

    // 設定を取得
    const settings = await window.electron.ipcRenderer.invoke('get-settings');
    
    // フォームに設定を反映
    document.getElementById('theme').value = settings.theme || 'dark';
    document.getElementById('autoSaveInterval').value = settings.autoSaveInterval ?? 300;
    document.getElementById('load-weather').checked = settings.loadWeather || false;
    document.getElementById('chat-retention').value = settings.chatRetentionDays ?? 30;
});

// 設定保存ボタンの送信物
document.getElementById('apply-settings').addEventListener('click', async () => {
    // すべての要素の存在を確認してから設定オブジェクトを作成
    const theme = document.getElementById('theme');
    const reloadFile = document.getElementById('reload-file');
    const chatRetention = document.getElementById('chat-retention');
    const remindEnabled = document.getElementById('remind-enabled');
    const remindInterval = document.getElementById('remind-interval');
    const loadWeather = document.getElementById('load-weather');
    const selectedRemindTime = document.querySelector('input[name="remind-time"]:checked');

    // 安全に設定オブジェクトを作成
    const newSettings = {
        theme: theme ? theme.value : 'dark',
        reloadFile: reloadFile ? reloadFile.checked : false,
        chatRetentionDays: chatRetention ? parseInt(chatRetention.value, 10) : 30,
        remindEnabled: remindEnabled ? remindEnabled.checked : false,
        remindInterval: remindInterval ? parseInt(remindInterval.value, 10) : 15,
        remindTime: selectedRemindTime ? selectedRemindTime.value : '15',
        loadWeather: loadWeather ? loadWeather.checked : false
    };

    // 設定を保存
    try {
        const result = await window.electron.ipcRenderer.invoke('save-settings', newSettings);
        if (result.success) {
            console.log('【setting.js】設定が保存されました。');
        } else {
            console.log('【setting.js】設定の保存に失敗しました。');
        }
    } catch (error) {
        console.error('【setting.js】設定の保存中にエラーが発生しました:', error);
    }
});

function isRemindEnabled() {
    const remindEnabledCheckbox = document.getElementById('remind-enabled');// チェックボックスの要素を取得
    return remindEnabledCheckbox ? remindEnabledCheckbox.checked : false;
}
