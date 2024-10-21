const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('electron', {
    // Any functions you want to expose to the renderer
});
