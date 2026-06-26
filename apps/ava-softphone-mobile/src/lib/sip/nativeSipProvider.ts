import { registerPlugin } from '@capacitor/core';

export interface CapacitorSipPlugin {
  initAccount(options: {
    extension: string;
    domain: string;
    password: string;
    host: string;
  }): Promise<void>;
  makeCall(options: { number: string }): Promise<void>;
  hangup(): Promise<void>;
  answer(): Promise<void>;
  setMute(options: { muted: boolean }): Promise<void>;
  setHold(options: { held: boolean }): Promise<void>;
  sendDTMF(options: { digits: string }): Promise<void>;
  addListener(event: string, callback: (data: any) => void): Promise<any>;
  removeAllListeners(): Promise<void>;
}

export const CapacitorSipNative = registerPlugin<CapacitorSipPlugin>('CapacitorSip');
