import logoImage from '@/assets/ava-logo.png';

export function AvaFooter() {
  return (
    <footer className="border-t border-border/40 bg-background/50 backdrop-blur-sm py-4 px-6">
      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <span>Powered by</span>
        <a
          href="https://avastatistic.ca"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 font-semibold text-foreground hover:text-primary transition-colors"
        >
          <img src={logoImage} alt="AVA Statistics" className="h-4 w-4 rounded-sm object-cover" />
          AVA Statistics
        </a>
        <span className="text-muted-foreground/60">· avastatistic.ca</span>
      </div>
    </footer>
  );
}
