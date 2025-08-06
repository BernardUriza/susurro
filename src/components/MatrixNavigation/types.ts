export interface MatrixNavigationProps {
  initialView?: 'terminal' | 'processor' | 'analytics' | 'settings' | 'export' | 'history';
  initialModel?: 'tiny' | 'base' | 'medium';
}