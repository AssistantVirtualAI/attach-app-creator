import { Download, Apple, Monitor } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const RELEASES =
  "https://github.com/AssistantVirtualAI/ava-softphone-releases/releases/latest/download";
const VERSION = "1.0.0";

export function DesktopDownloadCard() {
  return (
    <Card className="p-6 bg-gradient-to-br from-primary/10 to-background border-primary/20">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold">Download Desktop App</h3>
            <Badge variant="secondary">Latest v{VERSION}</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Native AVA Softphone for Windows, macOS, and Linux. Auto-updates
            included — the app refreshes silently in the background.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
        <Button asChild variant="default" className="gap-2">
          <a href={`${RELEASES}/AVA-Softphone-Setup-${VERSION}.exe`}>
            <Download className="h-4 w-4" />
            Windows (.exe)
          </a>
        </Button>
        <Button asChild variant="default" className="gap-2">
          <a href={`${RELEASES}/AVA-Softphone-${VERSION}.dmg`}>
            <Apple className="h-4 w-4" />
            macOS (.dmg)
          </a>
        </Button>
        <Button asChild variant="default" className="gap-2">
          <a href={`${RELEASES}/AVA-Softphone-${VERSION}.AppImage`}>
            <Monitor className="h-4 w-4" />
            Linux (.AppImage)
          </a>
        </Button>
      </div>

      <div className="mt-4 text-xs text-muted-foreground space-y-1">
        <div>
          <strong>System requirements:</strong> Windows 10+ · macOS 11+ ·
          Ubuntu 20.04+
        </div>
        <div>Microphone access and an internet connection are required.</div>
      </div>

      <div className="mt-4 pt-4 border-t border-border flex items-center gap-4">
        <div className="h-16 w-16 rounded-md bg-muted/40 border border-border flex items-center justify-center text-[10px] text-muted-foreground">
          QR
        </div>
        <div>
          <div className="text-sm font-medium">Scan to download on mobile</div>
          <Badge variant="outline" className="mt-1">Coming Soon</Badge>
        </div>
      </div>
    </Card>
  );
}
