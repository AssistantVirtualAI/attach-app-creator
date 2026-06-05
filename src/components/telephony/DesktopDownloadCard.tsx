import { useEffect, useState } from "react";
import { Download, Apple, Monitor, Cpu, CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const REPO = "AssistantVirtualAI/attach-app-creator";
const RELEASES = `https://github.com/${REPO}/releases/latest/download`;
const API_LATEST = `https://api.github.com/repos/${REPO}/releases/latest`;

type DownloadItem = {
  label: string;
  subtitle: string;
  href: string;
  icon: React.ReactNode;
};

export function DesktopDownloadCard() {
  const [version, setVersion] = useState<string | null>(null);
  const [publishedAt, setPublishedAt] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(API_LATEST)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        setVersion(data.tag_name?.replace(/^v/, "") || null);
        setPublishedAt(data.published_at || null);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const downloads: DownloadItem[] = [
    {
      label: "Download for Windows",
      subtitle: "Windows 10 or later · 64-bit",
      href: `${RELEASES}/AVA-Softphone-Setup.exe`,
      icon: <Download className="h-4 w-4" />,
    },
    {
      label: "Download for Mac (Intel)",
      subtitle: "macOS 11 or later",
      href: `${RELEASES}/AVA-Softphone-x64.dmg`,
      icon: <Apple className="h-4 w-4" />,
    },
    {
      label: "Download for Mac (Apple Silicon)",
      subtitle: "M1, M2, M3, M4 Macs",
      href: `${RELEASES}/AVA-Softphone-arm64.dmg`,
      icon: <Cpu className="h-4 w-4" />,
    },
    {
      label: "Download for Linux",
      subtitle: "Ubuntu 20.04+ · AppImage",
      href: `${RELEASES}/AVA-Softphone.AppImage`,
      icon: <Monitor className="h-4 w-4" />,
    },
  ];

  const requirements = [
    "Windows 10+ (64-bit)",
    "macOS 11+ (Intel or Apple Silicon)",
    "Ubuntu 20.04+ / Debian 11+",
    "Microphone required for calls",
    "HTTPS internet connection required",
    "Auto-updates included — always stay current",
  ];

  return (
    <Card className="p-6 bg-gradient-to-br from-primary/10 to-background border-primary/20">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-lg font-semibold">Download AVA Softphone</h3>
            {version ? (
              <Badge variant="secondary">Latest v{version}</Badge>
            ) : (
              <Badge variant="outline">Latest version</Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {version && publishedAt
              ? `Latest version: v${version} — Released ${new Date(publishedAt).toLocaleDateString()}`
              : "Native softphone for Windows, macOS, and Linux. Auto-updates included."}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
        {downloads.map((d) => (
          <Button
            key={d.label}
            asChild
            variant="default"
            className="h-auto py-3 px-4 justify-start gap-3"
          >
            <a href={d.href} download>
              {d.icon}
              <div className="flex flex-col items-start text-left">
                <span className="text-sm font-medium">{d.label}</span>
                <span className="text-xs opacity-80">{d.subtitle}</span>
              </div>
            </a>
          </Button>
        ))}
      </div>

      <div className="mt-5 pt-4 border-t border-border">
        <div className="text-sm font-medium mb-2">System requirements</div>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-y-1 gap-x-4 text-xs text-muted-foreground">
          {requirements.map((r) => (
            <li key={r} className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
              {r}
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
