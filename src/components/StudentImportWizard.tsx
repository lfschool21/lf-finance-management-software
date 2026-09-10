import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Calendar, Download, FileSpreadsheet, Loader2, Plus, Upload } from 'lucide-react';
import { useFinanceStore } from '@/store/finance-store';
import { useStudentStore } from '@/store/student-store';
import * as academicYearsService from '@/services/academicYears';
import type { StudentMedium } from '@/types/students';
import { downloadStudentImportTemplate, IMPORT_FIELDS, parseStudentWorkbook, suggestMapping, validateImportRows, type ColumnMapping, type ParsedSheet } from '@/lib/student-import';
import { formatINR } from '@/utils/currency';
import { toast } from '@/hooks/use-toast';

import { StudentMediumBadge } from './students/StudentMediumBadge';

type Step = 'upload' | 'map' | 'preview' | 'result';

function getAcademicYearDates(label: string) {
  const match = label.match(/^(\d{4})-(\d{2,4})$/);
  if (match) {
    const startYear = parseInt(match[1], 10);
    const endYear = match[2].length === 2 ? Math.floor(startYear / 100) * 100 + parseInt(match[2], 10) : parseInt(match[2], 10);
    return { startDate: `${startYear}-06-01`, endDate: `${endYear}-05-31` };
  }
  const currentYear = new Date().getFullYear();
  return { startDate: `${currentYear}-06-01`, endDate: `${currentYear + 1}-05-31` };
}

export function StudentImportWizard({
  open,
  onClose,
  defaultYearId,
  defaultMedium: contextualDefaultMedium,
}: {
  open: boolean;
  onClose: () => void;
  defaultYearId: string;
  defaultMedium?: StudentMedium;
}) {
  const { academicYears, currentYearId, refreshAcademicYears } = useFinanceStore();
  const { students, enrollments, importRoster } = useStudentStore();
  const activeYearFallback = defaultYearId || currentYearId || academicYears.find((y) => y.status === 'active')?.id || academicYears[0]?.id || '';
  const [step, setStep] = useState<Step>('upload');
  const [yearId, setYearId] = useState(defaultYearId || activeYearFallback);
  const [detectedYear, setDetectedYear] = useState('2026-27');
  const [creatingYear, setCreatingYear] = useState(false);
  const [sheets, setSheets] = useState<ParsedSheet[]>([]);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [snapshotDate, setSnapshotDate] = useState(new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [defaultMedium, setDefaultMedium] = useState<StudentMedium>(contextualDefaultMedium || 'gujarati');
  const [defaultAnnualFee, setDefaultAnnualFee] = useState<string>('');
  const [result, setResult] = useState<{ added: number; updated: number; failed: number; total: number }>();

  useEffect(() => {
    if (open) {
      if (!yearId || !academicYears.some((y) => y.id === yearId)) {
        if (activeYearFallback) setYearId(activeYearFallback);
      }
      if (contextualDefaultMedium) {
        setDefaultMedium(contextualDefaultMedium);
      }
    }
  }, [open, defaultYearId, contextualDefaultMedium, currentYearId, academicYears, yearId, activeYearFallback]);

  const sheet = sheets[sheetIndex];
  const duplicateFields = useMemo(() => {
    const values = Object.values(mapping).filter((f) => f !== 'ignore');
    return new Set(values.filter((item, idx) => values.indexOf(item) !== idx));
  }, [mapping]);

  const parsedDefaultFee = defaultAnnualFee.trim() ? Number(defaultAnnualFee) : 0;
  const importOptions = useMemo(() => ({
    defaultMedium,
    defaultAnnualFee: Number.isFinite(parsedDefaultFee) && parsedDefaultFee >= 0 ? parsedDefaultFee : 0,
  }), [defaultMedium, parsedDefaultFee]);

  const targetAcademicYearId = yearId || activeYearFallback || currentYearId || academicYears.find((y) => y.status === 'active')?.id || academicYears[0]?.id || '';
  const preview = useMemo(() => {
    if (!sheet || step === 'upload') return [];
    try {
      return validateImportRows(sheet.rows, mapping, students, enrollments, targetAcademicYearId, academicYears, snapshotDate, importOptions);
    } catch {
      return [];
    }
  }, [sheet, step, mapping, students, enrollments, targetAcademicYearId, academicYears, snapshotDate, importOptions]);

  const valid = preview.filter((row) => row.errors.length === 0);
  const invalid = preview.filter((row) => row.errors.length > 0);

  function reset() {
    setStep('upload');
    setSheets([]);
    setSheetIndex(0);
    setMapping({});
    setResult(undefined);
    setYearId(activeYearFallback);
    setDefaultMedium(contextualDefaultMedium || 'gujarati');
    setDefaultAnnualFee('');
  }

  async function handleCreateYear(labelToCreate: string) {
    setCreatingYear(true);
    try {
      const { startDate, endDate } = getAcademicYearDates(labelToCreate);
      const initialTarget = parsedDefaultFee > 0 ? parsedDefaultFee : 0;
      const { data, error } = await academicYearsService.create({
        label: labelToCreate,
        start_date: startDate,
        end_date: endDate,
        target_tuition_fees: initialTarget,
        carry_forward_fees: 0,
        status: 'active',
      });
      if (error) throw error;
      await refreshAcademicYears();
      if (data?.id) {
        setYearId(data.id);
      }
      toast({
        title: `Academic Year AY ${labelToCreate} created!`,
        description: 'Selected as target academic year for this import.',
      });
      return data;
    } catch (err) {
      toast({
        title: 'Could not create academic year',
        description: err instanceof Error ? err.message : 'Database error',
        variant: 'destructive',
      });
      return null;
    } finally {
      setCreatingYear(false);
    }
  }

  async function chooseFile(file?: File) {
    if (!file) return;
    setBusy(true);
    try {
      const parsed = await parseStudentWorkbook(file);
      if (!parsed.length || parsed.every((item) => !item.rows.length)) throw new Error('No student rows were found');
      setSheets(parsed);
      setSheetIndex(0);

      const filenameMatch = file.name.match(/\b(20\d{2}-\d{2})\b/);
      const suggestedLabel = filenameMatch ? filenameMatch[1] : '2026-27';
      setDetectedYear(suggestedLabel);

      const matchingYear = academicYears.find((y) => y.label.toLowerCase() === suggestedLabel.toLowerCase());
      if (matchingYear) {
        setYearId(matchingYear.id);
      } else if (!yearId && activeYearFallback) {
        setYearId(activeYearFallback);
      }

      setMapping(suggestMapping(parsed[0].headers));
      setStep('map');
    } catch (error) {
      toast({
        title: 'File could not be read',
        description: error instanceof Error ? error.message : 'Invalid spreadsheet',
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  }

  function continueToPreview() {
    try {
      validateImportRows(sheet.rows, mapping, students, enrollments, targetAcademicYearId, academicYears, snapshotDate, importOptions);
      setStep('preview');
    } catch (error) {
      toast({
        title: 'Column mapping is incomplete',
        description: error instanceof Error ? error.message : 'Review the mapping',
        variant: 'destructive',
      });
    }
  }

  async function confirmImport() {
    let effectiveYearId = targetAcademicYearId || yearId || activeYearFallback;
    if (!effectiveYearId) {
      if (academicYears.length === 0) {
        const created = await handleCreateYear(detectedYear || '2026-27');
        if (created?.id) {
          effectiveYearId = created.id;
        }
      }
    }
    if (!effectiveYearId) {
      toast({
        title: 'Academic year required',
        description: 'Please select or create an academic year to import students into.',
        variant: 'destructive',
      });
      return;
    }
    if (!valid.length || invalid.length) return;
    setBusy(true);
    try {
      const value = await importRoster(effectiveYearId, valid);
      const totalObligations = valid.reduce(
        (sum, r) => sum + (Number(r.annualFeeAmount) || 0) + (Number(r.additionalOutstandingAmount) || 0),
        0
      );
      if (effectiveYearId && totalObligations > 0) {
        const curYear = academicYears.find((y) => y.id === effectiveYearId);
        if (!curYear || curYear.targetTuitionFees < totalObligations) {
          try {
            await academicYearsService.update(effectiveYearId, { target_tuition_fees: totalObligations });
          } catch {
            // non-blocking
          }
        }
      }
      await refreshAcademicYears();
      setResult(value);
      setStep('result');
    } catch (error: unknown) {
      console.error('Import roster failed:', error);
      const message = error instanceof Error
        ? error.message
        : (error && typeof error === 'object' && 'message' in error)
          ? String((error as { message: unknown }).message)
          : 'No rows were committed';
      toast({ title: 'Import failed safely', description: message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(value) => { if (!value) { reset(); onClose(); } }}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Import Student Roster</DialogTitle>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <Label>Academic Year</Label>
                {!academicYears.some((y) => y.label === (detectedYear || '2026-27')) && (
                  <button
                    type="button"
                    onClick={() => void handleCreateYear(detectedYear || '2026-27')}
                    disabled={creatingYear}
                    className="text-xs text-primary hover:underline font-medium"
                  >
                    + Create AY {detectedYear || '2026-27'}
                  </button>
                )}
              </div>
              {academicYears.length > 0 ? (
                <Select value={targetAcademicYearId} onValueChange={setYearId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select academic year" />
                  </SelectTrigger>
                  <SelectContent>
                    {academicYears.map((year) => (
                      <SelectItem key={year.id} value={year.id}>AY {year.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                  onClick={() => void handleCreateYear(detectedYear || '2026-27')}
                  disabled={creatingYear}
                >
                  {creatingYear ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Plus className="mr-1 h-3.5 w-3.5" />}
                  Create AY {detectedYear || '2026-27'}
                </Button>
              )}
            </div>
            <div className="rounded-xl border-2 border-dashed p-8 text-center">
              <FileSpreadsheet className="mx-auto mb-3 h-10 w-10 text-primary" />
              <p className="font-medium">Choose an Excel or CSV roster</p>
              <p className="mb-4 text-sm text-muted-foreground">.xlsx, .xls, or .csv · up to 10 MB and 5,000 rows</p>
              <Input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="mx-auto max-w-sm"
                onChange={(event) => void chooseFile(event.target.files?.[0])}
                disabled={busy}
              />
              {busy && <Loader2 className="mx-auto mt-3 h-5 w-5 animate-spin" />}
            </div>
            <Button type="button" variant="outline" onClick={downloadStudentImportTemplate}>
              <Download className="mr-2 h-4 w-4" />Download Import Template
            </Button>
          </div>
        )}

        {step === 'map' && sheet && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label>Target AY</Label>
                  {!academicYears.some((y) => y.label === (detectedYear || '2026-27')) && (
                    <button
                      type="button"
                      onClick={() => void handleCreateYear(detectedYear || '2026-27')}
                      disabled={creatingYear}
                      className="text-[11px] text-primary hover:underline font-medium"
                    >
                      + Add
                    </button>
                  )}
                </div>
                {academicYears.length > 0 ? (
                  <Select value={targetAcademicYearId} onValueChange={setYearId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select year" />
                    </SelectTrigger>
                    <SelectContent>
                      {academicYears.map((item) => (
                        <SelectItem key={item.id} value={item.id}>AY {item.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full text-xs"
                    onClick={() => void handleCreateYear(detectedYear || '2026-27')}
                    disabled={creatingYear}
                  >
                    {creatingYear ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Plus className="mr-1 h-3 w-3" />}
                    Create AY {detectedYear || '2026-27'}
                  </Button>
                )}
              </div>
              <div>
                <Label>Sheet</Label>
                <Select
                  value={String(sheetIndex)}
                  onValueChange={(value) => {
                    const next = Number(value);
                    setSheetIndex(next);
                    setMapping(suggestMapping(sheets[next].headers));
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {sheets.map((item, index) => (
                      <SelectItem key={item.name} value={String(index)}>{item.name} ({item.rows.length} rows)</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Opening Date</Label>
                <Input type="date" value={snapshotDate} onChange={(e) => setSnapshotDate(e.target.value)} />
              </div>
              <div>
                <Label>Default Medium</Label>
                <Select value={defaultMedium} onValueChange={(value) => setDefaultMedium(value as StudentMedium)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="english">English</SelectItem>
                    <SelectItem value="gujarati">Gujarati</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Default Annual Fee</Label>
                <Input type="number" min="0" placeholder="0" value={defaultAnnualFee} onChange={(e) => setDefaultAnnualFee(e.target.value)} />
              </div>
            </div>

            {duplicateFields.size > 0 && (
              <Alert variant="destructive">
                <AlertTitle>Duplicate destination fields selected</AlertTitle>
                <AlertDescription>
                  Each field can only be mapped once. Conflicting fields: {Array.from(duplicateFields).map((f) => IMPORT_FIELDS.find((item) => item.value === f)?.label ?? f).join(', ')}. Please change or set duplicates to "Ignore".
                </AlertDescription>
              </Alert>
            )}

            <div className="rounded-lg border">
              <div className="grid grid-cols-2 border-b bg-muted/50 px-3 py-2 text-xs font-semibold">
                <span>Your Column</span>
                <span>Import As</span>
              </div>
              {sheet.headers.map((header, index) => {
                const isDuplicate = mapping[index] && mapping[index] !== 'ignore' && duplicateFields.has(mapping[index]);
                return (
                  <div key={`${header}-${index}`} className={`grid grid-cols-2 items-center gap-3 border-b px-3 py-2 last:border-0 ${isDuplicate ? 'bg-destructive/10' : ''}`}>
                    <span className="truncate text-sm flex items-center gap-2">
                      <span>{header || `Column ${index + 1}`}</span>
                      {isDuplicate && <span className="text-xs text-destructive font-medium">(Duplicate)</span>}
                    </span>
                    <Select
                      value={mapping[index] || 'ignore'}
                      onValueChange={(value) => setMapping((current) => ({ ...current, [index]: value as ColumnMapping[number] }))}
                    >
                      <SelectTrigger className={isDuplicate ? 'border-destructive ring-destructive' : ''}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {IMPORT_FIELDS.map((field) => (
                          <SelectItem key={field.value} value={field.value}>{field.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep('upload')}>Back</Button>
              <Button onClick={continueToPreview} disabled={duplicateFields.size > 0}>Validate & Preview</Button>
            </div>
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-4">
            <Alert>
              <AlertTitle>Opening collections do not create income</AlertTitle>
              <AlertDescription>These values only establish each student's fee history. Account balances and the finance ledger are unchanged.</AlertDescription>
            </Alert>

            {/* Dedicated Interactive Academic Year Selector Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border bg-muted/40 p-3">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Target Academic Year</p>
                  <p className="text-xs text-muted-foreground">Students will be enrolled into this academic year</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {academicYears.length > 0 ? (
                  <Select value={targetAcademicYearId} onValueChange={setYearId}>
                    <SelectTrigger className="w-[180px] bg-card h-8 text-xs font-medium">
                      <SelectValue placeholder="Choose Academic Year" />
                    </SelectTrigger>
                    <SelectContent>
                      {academicYears.map((y) => (
                        <SelectItem key={y.id} value={y.id}>AY {y.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => void handleCreateYear(detectedYear || '2026-27')}
                    disabled={creatingYear}
                    className="h-8 text-xs"
                  >
                    {creatingYear ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Plus className="mr-1.5 h-3.5 w-3.5" />}
                    Create AY {detectedYear || '2026-27'}
                  </Button>
                )}
                {!academicYears.some((y) => y.label === (detectedYear || '2026-27')) && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void handleCreateYear(detectedYear || '2026-27')}
                    disabled={creatingYear}
                    className="h-8 text-xs"
                  >
                    {creatingYear ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Plus className="mr-1.5 h-3.5 w-3.5" />}
                    + AY {detectedYear || '2026-27'}
                  </Button>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-primary/10 px-3 py-1 font-medium">{valid.length} ready</span>
                <span className="rounded-full bg-destructive/10 px-3 py-1 text-destructive">{invalid.length} blocked</span>
                <span className="rounded-full bg-muted px-3 py-1">{preview.filter((row) => row.action === 'update').length} updates</span>
              </div>
              <span className="text-xs text-muted-foreground">
                Target Academic Year: <strong className="text-foreground">AY {academicYears.find((y) => y.id === targetAcademicYearId)?.label || (detectedYear ? `${detectedYear} (New)` : 'Not set')}</strong>
              </span>
            </div>

            {/* Medium Stream Breakdown Summary */}
            {valid.length > 0 && (
              <div className="rounded-lg border bg-muted/20 p-3 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-semibold text-foreground">Import Stream Breakdown:</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-500/30 px-2.5 py-0.5 text-xs text-amber-800 dark:text-amber-300 font-semibold">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-600 dark:bg-amber-400" />
                    {valid.filter((r) => r.medium === 'gujarati').length} Gujarati Medium
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/15 border border-sky-500/30 px-2.5 py-0.5 text-xs text-sky-800 dark:text-sky-300 font-semibold">
                    <span className="h-1.5 w-1.5 rounded-full bg-sky-600 dark:bg-sky-400" />
                    {valid.filter((r) => r.medium === 'english').length} English Medium
                  </span>
                </div>
                {valid.filter((r) => r.medium === 'gujarati').length > 0 && valid.filter((r) => r.medium === 'english').length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    ℹ️ This import contains a mixed roster of both <strong>Gujarati Medium</strong> and <strong>English Medium</strong> students. Medium values from your spreadsheet will be accurately recorded on each student profile.
                  </p>
                )}
              </div>
            )}

            <div className="max-h-[48vh] overflow-auto rounded-lg border">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="sticky top-0 bg-card">
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="p-2">Row</th>
                    <th>Name</th>
                    <th>Class</th>
                    <th>Medium</th>
                    <th>Fee</th>
                    <th>Opening Paid</th>
                    <th>Action</th>
                    <th>Validation</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row) => (
                    <tr key={row.rowNumber} className="border-b align-top text-xs">
                      <td className="p-2 font-mono">{row.rowNumber}</td>
                      <td>
                        <span className="font-medium text-foreground text-xs sm:text-sm">{row.fullName || '—'}</span><br/>
                        <span className="text-xs text-muted-foreground font-mono">{row.admissionNumber || 'No admission no.'}</span>
                      </td>
                      <td className="font-medium text-foreground">{row.className || '—'}</td>
                      <td>
                        {row.medium ? (
                          <StudentMediumBadge medium={row.medium} size="xs" variant="compact" />
                        ) : (
                          <span className="text-destructive font-medium">Invalid</span>
                        )}
                      </td>
                      <td className="font-mono">{row.annualFeeAmount === null ? 'Invalid' : formatINR(row.annualFeeAmount + row.additionalOutstandingAmount)}</td>
                      <td className="font-mono">
                        {formatINR(row.openingCollectedCash + row.openingCollectedUpi + row.openingCollectedOther)}
                        {row.inferredOpening && <span className="block text-[11px] text-warning">Inferred</span>}
                      </td>
                      <td className="capitalize font-medium">{row.action.replace('_',' ')}</td>
                      <td className="max-w-xs p-2 text-xs">
                        {row.errors.map((error) => <p key={error} className="text-destructive font-medium">{error}</p>)}
                        {row.warnings.map((warning) => <p key={warning} className="text-warning">{warning}</p>)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {invalid.length > 0 && (
              <p className="text-sm text-destructive font-medium">Resolve all blocked rows in the source file before importing. No partial import will run.</p>
            )}

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep('map')}>Back</Button>
              <Button onClick={confirmImport} disabled={busy || valid.length === 0 || invalid.length > 0 || creatingYear}>
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                Confirm Import
              </Button>
            </div>
          </div>
        )}

        {step === 'result' && result && (
          <div className="space-y-5 py-4 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-income/10">
              <FileSpreadsheet className="h-7 w-7 text-income" />
            </div>
            <div>
              <h3 className="text-xl font-semibold">{result.total} students imported</h3>
              <p className="text-sm text-muted-foreground">{result.added} added · {result.updated} updated · {result.failed} failed</p>
            </div>
            <Button onClick={() => { reset(); onClose(); }}>Done</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
