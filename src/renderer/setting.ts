import { Settings } from '../types';

const { ipcRenderer } = window.electron;

// 設定の初期値
const DEFAULT_SETTINGS: Settings = {
  theme: 'dark',
  reloadFile: false,
  chatRetentionDays: 30,
  remindEnabled: false,
  remindInterval: 15,
  remindTime: '15',
  loadWeather: false,
};

// リマインド設定の制御
function setupRemindControls(): void {
  const remindEnabled = document.getElementById('remind-enabled') as HTMLInputElement;
  const remindSettings = document.getElementById('remind-settings') as HTMLElement;
  const remindTimeRadios = document.getElementsByName('remind-time') as NodeListOf<HTMLInputElement>;
  const customTimeContainer = document.getElementById('custom-time-container') as HTMLElement;
  const customRemindTimeInput = document.getElementById('custom-remind-time') as HTMLInputElement;

  // リマインド有効/無効の切り替え
  remindEnabled?.addEventListener('change', function (this: HTMLInputElement) {
    remindSettings.style.display = this.checked ? 'block' : 'none';
    ipcRenderer.send('update_remind_enabled', this.checked);
  });

  // カスタム時間の制御
  remindTimeRadios.forEach((radio) => {
    radio.addEventListener('change', function (this: HTMLInputElement) {
      customTimeContainer.style.display = this.value === 'custom' ? 'block' : 'none';
      const interval =
        this.value === 'custom'
          ? parseInt(customRemindTimeInput.value) || 1
          : parseInt(this.value) || 15;
      ipcRenderer.send('update_remind_interval', interval);
    });
  });

  // カスタム時間の入力制御
  customRemindTimeInput?.addEventListener('input', function (this: HTMLInputElement) {
    const interval = parseInt(this.value) || 1;
    ipcRenderer.send('update_remind_interval', interval);
  });
}

// 設定の読み込みと反映
async function loadSettings(): Promise<void> {
  try {
    const settings: Settings = await window.electron.ipcRenderer.invoke('get-settings');

    // DOM要素に設定を反映
    const themeSelect = document.getElementById('theme') as HTMLSelectElement;
    const reloadFileCheckbox = document.getElementById('reload-file') as HTMLInputElement;
    const chatRetentionInput = document.getElementById('chat-retention') as HTMLInputElement;
    const remindEnabledCheckbox = document.getElementById('remind-enabled') as HTMLInputElement;
    const loadWeatherCheckbox = document.getElementById('load-weather') as HTMLInputElement;

    if (themeSelect) themeSelect.value = settings.theme || DEFAULT_SETTINGS.theme;
    if (reloadFileCheckbox) reloadFileCheckbox.checked = settings.reloadFile || DEFAULT_SETTINGS.reloadFile;
    if (chatRetentionInput)
      chatRetentionInput.value = String(settings.chatRetentionDays || DEFAULT_SETTINGS.chatRetentionDays);
    if (remindEnabledCheckbox)
      remindEnabledCheckbox.checked = settings.remindEnabled || DEFAULT_SETTINGS.remindEnabled;

    // リマインド時間のラジオボタン設定
    const remindTimeValue = settings.remindTime || DEFAULT_SETTINGS.remindTime;
    const radioButton = document.querySelector(
      `input[name="remind-time"][value="${remindTimeValue}"]`
    ) as HTMLInputElement;
    if (radioButton) {
      radioButton.checked = true;

      // カスタム時間の設定
      if (remindTimeValue === 'custom') {
        const customTimeContainer = document.getElementById('custom-time-container') as HTMLElement;
        const customRemindTimeInput = document.getElementById('custom-remind-time') as HTMLInputElement;

        customTimeContainer.style.display = 'block';
        customRemindTimeInput.value = String(settings.customRemindTime || 1);
      }
    }

    if (loadWeatherCheckbox)
      loadWeatherCheckbox.checked = settings.loadWeather || DEFAULT_SETTINGS.loadWeather;

    // リマインド設定の表示制御
    const remindSettings = document.getElementById('remind-settings') as HTMLElement;
    remindSettings.style.display = settings.remindEnabled ? 'block' : 'none';

    // テーマの適用
    window.electron.ipcRenderer.send('theme-change', settings.theme || DEFAULT_SETTINGS.theme);
  } catch (error) {
    console.error('設定の読み込みに失敗しました:', error);
  }
}

// 設定の保存処理
async function saveSettings(): Promise<void> {
  const remindTimeRadio = document.querySelector('input[name="remind-time"]:checked') as HTMLInputElement;
  const customRemindTime = document.getElementById('custom-remind-time') as HTMLInputElement;

  try {
    const themeSelect = document.getElementById('theme') as HTMLSelectElement;
    const reloadFileCheckbox = document.getElementById('reload-file') as HTMLInputElement;
    const chatRetentionInput = document.getElementById('chat-retention') as HTMLInputElement;
    const remindEnabledCheckbox = document.getElementById('remind-enabled') as HTMLInputElement;
    const loadWeatherCheckbox = document.getElementById('load-weather') as HTMLInputElement;

    const newSettings: Settings = {
      theme: (themeSelect?.value as 'light' | 'dark') || DEFAULT_SETTINGS.theme,
      reloadFile: reloadFileCheckbox?.checked || DEFAULT_SETTINGS.reloadFile,
      chatRetentionDays: parseInt(chatRetentionInput?.value) || DEFAULT_SETTINGS.chatRetentionDays,
      remindEnabled: remindEnabledCheckbox?.checked || DEFAULT_SETTINGS.remindEnabled,
      remindInterval: DEFAULT_SETTINGS.remindInterval,
      remindTime: remindTimeRadio?.value || DEFAULT_SETTINGS.remindTime,
      customRemindTime:
        remindTimeRadio?.value === 'custom' ? parseInt(customRemindTime.value) || 1 : undefined,
      loadWeather: loadWeatherCheckbox?.checked || DEFAULT_SETTINGS.loadWeather,
    };

    const result = await window.electron.ipcRenderer.invoke('save-settings', newSettings);

    if (result.success) {
      console.log('【setting.ts】設定を保存しました');
      window.electron.ipcRenderer.send('theme-change', newSettings.theme);
      window.electron.ipcRenderer.send('close-settings-window');
    } else {
      console.error('【setting.ts】設定の保存に失敗しました');
    }
  } catch (error) {
    console.error('【setting.ts】設定の保存中にエラーが発生しました:', error);
  }
}

// 初期化処理
document.addEventListener('DOMContentLoaded', async () => {
  setupRemindControls();
  await loadSettings();

  // 設定保存ボタンのイベントリスナー
  const applyButton = document.getElementById('apply-settings') as HTMLButtonElement;
  applyButton?.addEventListener('click', saveSettings);
});

// リマインド有効状態の確認用関数
function isRemindEnabled(): boolean {
  const remindEnabledCheckbox = document.getElementById('remind-enabled') as HTMLInputElement;
  return remindEnabledCheckbox?.checked || false;
}
