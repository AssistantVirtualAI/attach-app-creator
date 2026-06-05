export {};

declare global {
  interface Window {
    electronAPI: {
      getCredentials: () => Promise<any>;
      saveCredentials: (creds: object) => Promise<boolean>;
      clearCredentials: () => Promise<boolean>;
      showNotification: (title: string, body: string) => Promise<void>;
      minimize: () => Promise<void>;
      maximize: () => Promise<void>;
      close: () => Promise<void>;
      openExternal: (url: string) => Promise<void>;
      setLaunchOnStartup: (enabled: boolean) => Promise<void>;
      updateTrayStatus: (status: string) => Promise<void>;
      onUpdateAvailable: (cb: () => void) => void;
      onUpdateDownloaded: (cb: () => void) => void;
      checkForUpdates: () => Promise<void>;
      installUpdate: () => Promise<void>;
      onSetStatus: (cb: (s: string) => void) => void;
      platform: NodeJS.Platform;
    };
  }
}
