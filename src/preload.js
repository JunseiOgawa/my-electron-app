const { contextBridge, ipcRenderer } = require('electron');

// UUID生成関数
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// コンテキストブリッジの設定
contextBridge.exposeInMainWorld('electron', {
    ipcRenderer: {
        send: (channel, data) => {
            ipcRenderer.send(channel, data);
        },
        on: (channel, func) => {
            ipcRenderer.on(channel, (event, ...args) => func(event, ...args));
        },
        invoke: (channel, data) => ipcRenderer.invoke(channel, data)//非同期用のivoke　setting用
    },
    // UUID生成関数を公開
    generateUUID: () => generateUUID()
});
contextBridge.exposeInMainWorld('api', {
    closeSettingsWindow: () => ipcRenderer.send('close-settings-window'),
});