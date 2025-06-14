/// <reference types="vite/client" />

interface Window {
  ipcRenderer: {
    on: (channel: string, listener: (...args: any[]) => void) => void;
    off: (channel: string, ...args: any[]) => void;
    send: (channel: string, ...args: any[]) => void;
    invoke: (channel: string, ...args: any[]) => Promise<any>;
    
    openFileDialog: () => Promise<{ canceled: boolean; filePaths: string[] }>;
    readFile: (filePath: string) => Promise<{ success: boolean; data?: string; error?: string }>;
    apiProxy: (endpoint: string, method: string, data: any) => Promise<any>;
    
    // State persistence functions
    saveAppState: (state: any) => Promise<{ success: boolean; error?: string }>;
    loadAppState: () => Promise<{ success: boolean; data?: any; error?: string }>;
  };
}

interface OpenDialogResult {
  canceled: boolean
  filePaths: string[]
}

interface IpcRenderer {
  on(channel: string, listener: (event: any, ...args: any[]) => void): void
  off(channel: string, ...args: any[]): void
  send(channel: string, ...args: any[]): void
  invoke(channel: string, ...args: any[]): Promise<any>
  openFileDialog(): Promise<OpenDialogResult>
  readFile(filePath: string): Promise<{ success: boolean, data?: string, error?: string }>
  apiProxy(endpoint: string, method: string, data: any): Promise<{ 
    status: number, 
    data?: any, 
    error?: string 
  }>
}

interface Window {
  ipcRenderer: IpcRenderer
}
