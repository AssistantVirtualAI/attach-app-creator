import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2, Download, Upload, FileSpreadsheet, CheckCircle2, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const HEADERS = ['extension', 'password', 'voicemail_password', 'first_name', 'last_name', 'email', 'call_group', 'user_record', 'enabled', 'description'];

const TEMPLATE_CSV = HEADERS.join(',') + '\n' +
  '1001,,1001,Jane,Doe,jane@example.com,sales,none,true,Sales rep\n' +
  '1002,,1002,John,Smith,john@example.com,support,all,true,Support agent\n';

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length);
  if (!lines.length) return [];
  const header = lines.shift()!.split(',').map((h) => h.replace(/^"|"$/g, '').trim().toLowerCase());
  return lines.map((line) => {
    const parts = line.match(/("([^"]|"")*"|[^,]*)/g)?.filter((_, i, arr) => i < arr.length - 1) || [];
    const row: Record<string, string> = {};
    header.forEach((h, i) => {
      row[h] = (parts[i] || '').replace(/^"|"$/g, '').replace(/""/g, '"').trim();
    });
    return row;
  });
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  organizationId: string;
  organizationName?: string;
  onComplete?: () => void;
}

export function CsvUserImportDialog({ open, onOpenChange, organizationId, organizationName, onComplete }: Props) {
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [generate, setGenerate] = useState(true);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<Array<{ extension: string; ok: boolean; error?: string }> | null>(null);

  const downloadTemplate = () => {
    const blob = new Blob([TEMPLATE_CSV], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'fusionpbx-users-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const onFile = async (f: File) => {
    setResults(null);
    const text = await f.text();
    const parsed = parseCsv(text);
    setRows(parsed);
  };

  const submit = async () => {
    if (!rows.length) return;
    setImporting(true);
    try {
      const { data, error } = await supabase.functions.invoke('import-pbx-users-csv', {
        body: { organization_id: organizationId, rows, generate_passwords: generate },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setResults(data.results || []);
      toast.success(`${data.succeeded} created, ${data.failed} failed`);
      onComplete?.();
    } catch (e: any) {
      toast.error(e.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  const reset = () => { setRows([]); setResults(null); };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FileSpreadsheet className="w-5 h-5" /> Import users from CSV</DialogTitle>
          <DialogDescription>
            Bulk-create extensions + softphone users for <b>{organizationName || 'this customer'}</b>. Synced live to FusionPBX.
          </DialogDescription>
        </DialogHeader>

        {!rows.length && !results && (
          <div className="space-y-4">
            <Alert>
              <AlertDescription>
                CSV columns: <code className="text-xs">{HEADERS.join(', ')}</code>. Download the template to start.
              </AlertDescription>
            </Alert>
            <div className="flex gap-2">
              <Button variant="outline" onClick={downloadTemplate}><Download className="w-4 h-4 mr-2" /> Download template</Button>
              <Label htmlFor="csv-file" className="inline-flex items-center gap-2 px-3 py-2 border rounded-md cursor-pointer hover:bg-muted">
                <Upload className="w-4 h-4" /> Choose CSV file
                <input
                  id="csv-file" type="file" accept=".csv,text/csv" className="hidden"
                  onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
                />
              </Label>
            </div>
          </div>
        )}

        {rows.length > 0 && !results && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">{rows.length} rows ready to import</div>
              <div className="flex items-center gap-2">
                <Switch id="gen-pw" checked={generate} onCheckedChange={setGenerate} />
                <Label htmlFor="gen-pw" className="text-sm">Generate strong passwords</Label>
              </div>
            </div>
            <div className="border rounded-md max-h-72 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ext</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Record</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.slice(0, 50).map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-mono">{r.extension || <span className="text-destructive">missing</span>}</TableCell>
                      <TableCell>{`${r.first_name || ''} ${r.last_name || ''}`.trim() || '—'}</TableCell>
                      <TableCell className="text-xs">{r.email || '—'}</TableCell>
                      <TableCell className="text-xs">{r.user_record || 'none'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {rows.length > 50 && <div className="p-2 text-center text-xs text-muted-foreground">+{rows.length - 50} more rows…</div>}
            </div>
          </div>
        )}

        {results && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <Badge><CheckCircle2 className="w-3 h-3 mr-1" /> {results.filter((r) => r.ok).length} succeeded</Badge>
              <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" /> {results.filter((r) => !r.ok).length} failed</Badge>
            </div>
            <div className="border rounded-md max-h-72 overflow-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Ext</TableHead><TableHead>Status</TableHead><TableHead>Error</TableHead></TableRow></TableHeader>
                <TableBody>
                  {results.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-mono">{r.extension}</TableCell>
                      <TableCell>{r.ok ? <Badge>OK</Badge> : <Badge variant="destructive">Failed</Badge>}</TableCell>
                      <TableCell className="text-xs text-destructive">{r.error || ''}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        <DialogFooter>
          {results ? (
            <Button onClick={() => onOpenChange(false)}>Close</Button>
          ) : (
            <>
              {rows.length > 0 && <Button variant="outline" onClick={reset}>Choose another file</Button>}
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={submit} disabled={!rows.length || importing}>
                {importing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Import {rows.length || ''} users
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
