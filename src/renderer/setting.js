const { ipcRenderer } = window.electron;

// 設定の初期値
const DEFAULT_SETTINGS = {
    theme: 'dark',
    reloadFile: false,
    chatRetentionDays: 30,
    remindEnabled: false,
    remindTime: '15',
    loadWeather: false
};

// リマインド設定の制御
function setupRemindControls() {
    const remindEnabled = document.getElementById('remind-enabled');
    const remindSettings = document.getElementById('remind-settings');
    const remindTimeRadios = document.getElementsByName('remind-time');
    const customTimeContainer = document.getElementById('custom-time-container');
    const customRemindTimeInput = document.getElementById('custom-remind-time');

    // リマインド有効/無効の切り替え
    remindEnabled?.addEventListener('change', function() {
        remindSettings.style.display = this.checked ? 'block' : 'none';
        ipcRenderer.send('update_remind_enabled', this.checked);
    });

    // カスタム時間の制御
    remindTimeRadios.forEach(radio => {
        radio.addEventListener('change', function() {
            customTimeContainer.style.display = this.value === 'custom' ? 'block' : 'none';
            const interval = this.value === 'custom' 
                ? parseInt(customRemindTimeInput.value) || 1 
                : parseInt(this.value) || 15;
            ipcRenderer.send('update_remind_interval', interval);
        });
    });

    // カスタム時間の入力制御
    customRemindTimeInput?.addEventListener('input', function() {
        const interval = parseInt(this.value) || 1;
        ipcRenderer.send('update_remind_interval', interval);
    });
}

// 設定の読み込みと反映
async function loadSettings() {
    try {
        const settings = await window.electron.ipcRenderer.invoke('get-settings');

        // リマインドの有効/無効を設定
        const remindEnabled = document.getElementById('remind-enabled');
        const remindSettings = document.getElementById('remind-settings');
        remindEnabled.checked = settings.remindEnabled;
        remindSettings.style.display = remindEnabled.checked ? 'block' : 'none';

        // リマインド時間の設定
        const remindTimeValue = settings.remindTime === '0' ? 'simultaneous' : settings.remindTime;
        const radioButton = document.querySelector(`input[name="remind-time"][value="${remindTimeValue}"]`);
        if (radioButton) {
            radioButton.checked = true;
            const customTimeContainer = document.getElementById('custom-time-container');
            customTimeContainer.style.display = remindTimeValue === 'custom' ? 'block' : 'none';
            if (remindTimeValue === 'custom') {
                const customRemindTimeInput = document.getElementById('custom-remind-time');
                customRemindTimeInput.value = settings.customRemindTime || 1;
            }
        }
    } catch (error) {
        console.error('【setting.js】設定の読み込み中にエラーが発生しました:', error);
    }
}

// 設定の保存処理
async function saveSettings() {

    const remindTimeRadio = document.querySelector('input[name="remind-time"]:checked');
    const customRemindTime = document.getElementById('custom-remind-time');
    try {
        const newSettings = {
            theme: document.getElementById('theme')?.value || DEFAULT_SETTINGS.theme,
            reloadFile: document.getElementById('reload-file')?.checked || DEFAULT_SETTINGS.reloadFile,
            chatRetentionDays: parseInt(document.getElementById('chat-retention')?.value) || DEFAULT_SETTINGS.chatRetentionDays,
            remindEnabled: document.getElementById('remind-enabled')?.checked || DEFAULT_SETTINGS.remindEnabled,
            remindTime: remindTimeRadio?.value || DEFAULT_SETTINGS.remindTime,
            customRemindTime: remindTimeRadio?.value === 'custom' ? parseInt(customRemindTime.value) || 1 : null,
            loadWeather: document.getElementById('load-weather')?.checked || DEFAULT_SETTINGS.loadWeather
        };

        if (newSettings.remindTime === 'simultaneous') {
            newSettings.remindTime = '0';
        }

        const result = await window.electron.ipcRenderer.invoke('save-settings', newSettings);
        
        if (result.success) {
            console.log('【setting.js】設定を保存しました');
            window.electron.ipcRenderer.send('theme-change', newSettings.theme);
            window.electron.ipcRenderer.send('close-settings-window');
        } else {
            console.error('【setting.js】設定の保存に失敗しました');
        }
    } catch (error) {
        console.error('【setting.js】設定の保存中にエラーが発生しました:', error);
    }
}

// 初期化処理
document.addEventListener('DOMContentLoaded', async () => {
    setupRemindControls();
    await loadSettings();
    
    // 設定保存ボタンのイベントリスナー
    document.getElementById('apply-settings')?.addEventListener('click', saveSettings);
});

// リマインド有効状態の確認用関数
function isRemindEnabled() {
    const remindEnabledCheckbox = document.getElementById('remind-enabled');
    return remindEnabledCheckbox?.checked || false;
}
