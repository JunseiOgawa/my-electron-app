import * as fs from 'fs';
import * as path from 'path';
import { Settings } from '../types';

const settingsPath = path.join(__dirname, '..', '..', 'config', 'settings.json');

const DEFAULT_SETTINGS: Settings = {
  theme: 'dark',
  reloadFile: false,
  chatRetentionDays: 30,
  remindEnabled: false,
  remindInterval: 15,
  remindTime: '15',
  loadWeather: false,
};

export class SettingsManager {
  private settings: Settings = DEFAULT_SETTINGS;

  constructor() {
    this.loadSettings();
  }

  loadSettings(): Settings {
    try {
      if (fs.existsSync(settingsPath)) {
        const data = fs.readFileSync(settingsPath, 'utf-8');
        this.settings = { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
      } else {
        this.settings = DEFAULT_SETTINGS;
      }
      return this.settings;
    } catch (error) {
      console.error('設定の読み込みに失敗しました:', error);
      return DEFAULT_SETTINGS;
    }
  }

  saveSettings(newSettings: Settings): void {
    try {
      this.settings = newSettings;
      fs.writeFileSync(settingsPath, JSON.stringify(newSettings, null, 2), 'utf-8');
      console.log('設定を保存しました:', newSettings);
    } catch (error) {
      console.error('設定の保存に失敗しました:', error);
      throw error;
    }
  }

  getSettings(): Settings {
    return this.settings;
  }

  getSetting<K extends keyof Settings>(key: K): Settings[K] {
    return this.settings[key];
  }
}

export const settingsManager = new SettingsManager();
