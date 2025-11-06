import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import { UUIDGenerator } from './types';

// UUID生成関数
const generateUUID: UUIDGenerator = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

// IPC通信用の型定義
interface ElectronAPI {
  ipcRenderer: {
    send: (channel: string, data?: any) => void;
    on: (channel: string, func: (...args: any[]) => void) => void;
    invoke: (channel: string, data?: any) => Promise<any>;
  };
  generateUUID: UUIDGenerator;
}

// コンテキストブリッジの設定
contextBridge.exposeInMainWorld('electron', {
  ipcRenderer: {
    send: (channel: string, data?: any) => {
      ipcRenderer.send(channel, data);
    },
    on: (channel: string, func: (...args: any[]) => void) => {
      ipcRenderer.on(channel, (event: IpcRendererEvent, ...args: any[]) => func(event, ...args));
    },
    invoke: (channel: string, data?: any) => ipcRenderer.invoke(channel, data),
  },
  generateUUID: () => generateUUID(),
} as ElectronAPI);

// グローバルな型定義を拡張
declare global {
  interface Window {
    electron: ElectronAPI;
  }
}
