const GITHUB_REPO = 'AssistantVirtualAI/attach-app-creator';
const GITHUB_API = 'https://api.github.com/repos';

export interface ReleaseAsset {
  name: string;
  browser_download_url: string;
  size: number;
  download_count: number;
}

export interface LatestRelease {
  tag_name: string;
  name: string;
  published_at: string;
  html_url: string;
  body?: string;
  assets: ReleaseAsset[];
  urls: {
    mac_arm64?: string;
    mac_x64?: string;
    windows?: string;
    linux?: string;
    android?: string;
    chrome?: string;
  };
}

export async function getLatestRelease(): Promise<LatestRelease> {
  const base = `https://github.com/${GITHUB_REPO}/releases/latest/download`;
  try {
    const res = await fetch(`${GITHUB_API}/${GITHUB_REPO}/releases/latest`, {
      headers: { Accept: 'application/vnd.github.v3+json' },
    });
    if (!res.ok) throw new Error('GitHub API error');
    const data = await res.json();

    const urls: LatestRelease['urls'] = {};
    (data.assets ?? []).forEach((asset: ReleaseAsset) => {
      const name = asset.name.toLowerCase();
      if (name.includes('arm64') && name.endsWith('.dmg')) urls.mac_arm64 = asset.browser_download_url;
      else if (name.includes('x64') && name.endsWith('.dmg')) urls.mac_x64 = asset.browser_download_url;
      else if (name.endsWith('.exe')) urls.windows = asset.browser_download_url;
      else if (name.endsWith('.appimage')) urls.linux = asset.browser_download_url;
      else if (name.endsWith('.apk')) urls.android = asset.browser_download_url;
      else if (name.includes('extension') && name.endsWith('.zip')) urls.chrome = asset.browser_download_url;
    });

    if (!urls.mac_arm64) urls.mac_arm64 = `${base}/Lemtel.Telecom-arm64.dmg`;
    if (!urls.mac_x64) urls.mac_x64 = `${base}/Lemtel.Telecom-x64.dmg`;
    if (!urls.windows) urls.windows = `${base}/Lemtel.Telecom.Setup.exe`;
    if (!urls.linux) urls.linux = `${base}/Lemtel.Telecom.AppImage`;

    return {
      tag_name: data.tag_name,
      name: data.name,
      published_at: data.published_at,
      html_url: data.html_url,
      assets: data.assets ?? [],
      urls,
    };
  } catch (err) {
    console.error('Failed to fetch release:', err);
    return {
      tag_name: 'latest',
      name: 'Lemtel Telecom',
      published_at: new Date().toISOString(),
      html_url: `https://github.com/${GITHUB_REPO}/releases/latest`,
      assets: [],
      urls: {
        mac_arm64: `${base}/Lemtel.Telecom-arm64.dmg`,
        mac_x64: `${base}/Lemtel.Telecom-x64.dmg`,
        windows: `${base}/Lemtel.Telecom.Setup.exe`,
        linux: `${base}/Lemtel.Telecom.AppImage`,
      },
    };
  }
}
