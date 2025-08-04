export interface AlertHandle {
  update: (config: Partial<AlertConfig>) => void;
  close: () => void;
}

export interface AlertConfig {
  title: string;
  message: string;
  type: 'loading' | 'error' | 'success' | 'warning' | 'info';
  progress?: number;
}

export interface ToastService {
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
  info: (message: string) => void;
}

export interface AlertService {
  show: (config: AlertConfig) => AlertHandle;
}

// Default implementations (no-op)
export const defaultAlertService: AlertService = {
  show: () => ({
    update: () => {},
    close: () => {}
  })
};

export const defaultToastService: ToastService = {
  success: () => {},
  error: () => {},
  warning: () => {},
  info: () => {}
};