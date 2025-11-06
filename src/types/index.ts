// Schedule types
export interface Schedule {
  id: string;
  title: string;
  content: string;
  start: Date | string;
  end: Date | string;
  group: number;
  style: string;
  remind: boolean;
  notified?: boolean;
}

export interface ScheduleData {
  id: string;
  title: string;
  content: string;
  start: Date;
  end: Date;
  group: number;
  style: string;
  remind: boolean;
  notified: boolean;
}

// Settings types
export interface Settings {
  theme: 'light' | 'dark';
  reloadFile: boolean;
  chatRetentionDays: number;
  remindEnabled: boolean;
  remindInterval: number;
  remindTime: string;
  customRemindTime?: number;
  loadWeather: boolean;
}

// Memo types
export interface Memo {
  id: number;
  message: string;
  createdAt: Date | string;
}

// ChatMemo types
export interface ChatMemo {
  id: number;
  message: string;
  createdAt: Date | string;
}

// IPC Response types
export interface IPCResponse<T = any> {
  success: boolean;
  error?: string;
  data?: T;
}

export interface SaveScheduleResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export interface GetMemosResponse {
  success: boolean;
  memos?: Memo[];
  error?: string;
}

// Window types
export interface WindowConfig {
  width: number;
  height: number;
  title?: string;
  autoHideMenuBar?: boolean;
}

// Notification types
export interface NotificationData {
  title: string;
  body: string;
  icon?: string;
  subtitle?: string;
  silent?: boolean;
}

// UUID generator type
export type UUIDGenerator = () => string;
