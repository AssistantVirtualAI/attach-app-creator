import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.lovable.d91c259879a6408e9f0352317572ea4c",
  appName: "attach-app-creator",
  webDir: "dist",
  server: {
    url: "https://d91c2598-79a6-408e-9f03-52317572ea4c.lovableproject.com?forceHideBadge=true",
    cleartext: true,
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
    LocalNotifications: {
      smallIcon: "ic_stat_icon_config_sample",
      iconColor: "#0023e6",
      sound: "beep.wav",
    },
  },
};

export default config;
