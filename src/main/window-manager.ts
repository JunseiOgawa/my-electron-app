import { BrowserWindow, Menu, dialog, app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

export class WindowManager {
  private mainWindow: BrowserWindow | null = null;
  private settingsWindow: BrowserWindow | null = null;

  createMainWindow(): BrowserWindow {
    this.mainWindow = new BrowserWindow({
      width: 800,
      height: 700,
      webPreferences: {
        preload: path.join(__dirname, '..', 'preload.js'),
        contextIsolation: true,
        devTools: !app.isPackaged,
        nodeIntegration: false,
        enableRemoteModule: false,
        allowRunningInsecureContent: false,
      },
    });

    this.mainWindow.loadFile(path.join(__dirname, '..', 'view', 'index.html'));

    this.mainWindow.once('ready-to-show', () => {
      this.mainWindow?.show();
      if (!app.isPackaged) {
        this.mainWindow?.webContents.openDevTools();
      }
    });

    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });

    this.createMenu();
    return this.mainWindow;
  }

  createSettingsWindow(): BrowserWindow {
    this.settingsWindow = new BrowserWindow({
      width: 600,
      height: 500,
      title: '設定',
      autoHideMenuBar: true,
      webPreferences: {
        preload: path.join(__dirname, '..', 'preload.js'),
        contextIsolation: true,
        devTools: !app.isPackaged,
        nodeIntegration: false,
        enableRemoteModule: false,
        allowRunningInsecureContent: false,
      },
    });

    this.settingsWindow.loadFile(path.join(__dirname, '..', 'view', 'settings.html'));

    this.settingsWindow.once('ready-to-show', () => {
      this.settingsWindow?.show();
      if (!app.isPackaged) {
        this.settingsWindow?.webContents.openDevTools();
      }
    });

    this.settingsWindow.on('closed', () => {
      this.settingsWindow = null;
    });

    return this.settingsWindow;
  }

  private createMenu(): void {
    const template: Electron.MenuItemConstructorOptions[] = [
      {
        label: 'Electron',
        submenu: [
          {
            label: 'About',
          },
        ],
      },
      {
        label: 'File',
        submenu: [
          {
            label: 'Open..',
            accelerator: 'CmdOrCtrl+O',
            click: () => {
              this.openFile();
            },
          },
          {
            label: 'Save',
            accelerator: 'CmdOrCtrl+S',
            click: () => {
              this.saveSchedule();
            },
          },
          {
            label: 'Exit',
            click: () => {
              app.quit();
            },
          },
        ],
      },
    ];
    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
  }

  private openFile(): void {
    dialog
      .showOpenDialog({
        properties: ['openFile'],
        filters: [{ name: 'JSON Files', extensions: ['json'] }],
      })
      .then((result) => {
        if (!result.canceled && result.filePaths.length > 0) {
          const filePath = result.filePaths[0];
          fs.readFile(filePath, 'utf-8', (err, data) => {
            if (err) {
              console.error('ファイルの読み込みに失敗しました:', err);
              return;
            }
            this.mainWindow?.webContents.send('open_file', JSON.parse(data));
          });
        }
      })
      .catch((err) => {
        console.error('Failed to open file:', err);
      });
  }

  private saveSchedule(): void {
    if (this.mainWindow) {
      this.mainWindow.webContents.send('get_schedule');
    }
  }

  getMainWindow(): BrowserWindow | null {
    return this.mainWindow;
  }

  getSettingsWindow(): BrowserWindow | null {
    return this.settingsWindow;
  }

  closeSettingsWindow(): void {
    if (this.settingsWindow) {
      this.settingsWindow.close();
    }
  }
}

export const windowManager = new WindowManager();
