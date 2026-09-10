import { useMemo, useState } from 'react';
import { HandCoins, Loader2, Plus, RotateCcw } from 'lucide-react';
import { useFinanceStore } from '@/store/finance-store';
import { useTranslation } from '@/lib/i18n';
import { getRecoverableSummary, parsePositiveAmount, dateKey } from '@/lib/finance-domain';
import { PageHeader } from '@/components/PageHeader';
import { formatINR, formatINRAbbr } from '@/utils/currency';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StatCard } from '@/components/StatCard';
import { toast } from '@/hooks/use-toast';
import type { Recoverable, RecoverableRepayment } from '@/types/finance';

export default function RecoverablesPage() {
  const { t } = useTranslation();
  const { recoverables, recoverableRepayments, accounts } = useFinanceStore();
  const [editAdvance, setEditAdvance] = useState<Recoverable | null | undefined>();
  const [repaymentTarget, setRepaymentTarget] = useState<Recoverable | null>(null);
  const [editRepayment, setEditRepayment] = useState<RecoverableRepayment | undefined>();

  const rows = useMemo(() => recoverables.map((recoverable) => ({
    recoverable,
    ...getRecoverableSummary(recoverable, recoverableRepayments),
  })).sort((a, b) => b.recoverable.dateGiven.getTime() - a.recoverable.dateGiven.getTime()), [recoverables, recoverableRepayments]);
  const totals = rows.reduce((result, row) => ({
    given: result.given + row.recoverable.originalAmount,
    recovered: result.recovered + row.recovered,
    outstanding: result.outstanding + row.outstanding,
  }), { given: 0, recovered: 0, outstanding: 0 });

  const accountName = (id: string) => accounts.find((account) => account.id === id)?.name || 'Unknown Account';

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title={t('recoverablesAndAdvances')}
        subtitle={t('recoverablesPageSubtitle')}
        action={
          <Button className="gap-1.5" onClick={() => setEditAdvance(null)}><Plus className="h-4 w-4" /> {t('giveAdvance')}</Button>
        }
      />
      <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2 sm:grid-cols-3">
        <StatCard title={t('stillOutstanding')} value={formatINRAbbr(totals.outstanding)} fullValue={formatINR(totals.outstanding)} icon={HandCoins} variant="pending" />
        <StatCard title={t('moneyGiven')} value={formatINRAbbr(totals.given)} fullValue={formatINR(totals.given)} icon={HandCoins} variant="balance" />
        <StatCard title={t('repaymentsReceived')} value={formatINRAbbr(totals.recovered)} fullValue={formatINR(totals.recovered)} icon={RotateCcw} variant="balance" />
      </div>
      {rows.length === 0 ? <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">{t('noRecoverablesRecorded')}</div> : (
        <div className="divide-y rounded-lg border bg-card">
          {rows.map((row) => (
            <div key={row.recoverable.id} className="p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <button className="min-w-0 text-left" onClick={() => setEditAdvance(row.recoverable)}>
                  <p className="font-semibold">{row.recoverable.partyName}</p>
                  <p className="text-xs text-muted-foreground">{row.recoverable.dateGiven.toLocaleDateString('en-IN')} • {accountName(row.recoverable.sourceAccountId)}</p>
                  {row.recoverable.notes && <p className="mt-1 text-sm text-muted-foreground">{row.recoverable.notes}</p>}
                </button>
                <div className="text-left sm:text-right"><p className="font-mono font-bold text-warning">{formatINR(row.outstanding)} {t('remainingWord')}</p><p className="text-xs capitalize text-muted-foreground">{row.status.replace('_', ' ')}</p></div>
              </div>
              <div className="mt-3 grid grid-cols-1 gap-2 text-xs min-[360px]:grid-cols-2 sm:grid-cols-3">
                <Metric label={t('metricGiven')} value={row.recoverable.originalAmount} />
                <Metric label={t('metricRecovered')} value={row.recovered} />
                <Metric label={t('metricRemaining')} value={row.outstanding} />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {row.outstanding > 0 && <Button size="sm" onClick={() => { setRepaymentTarget(row.recoverable); setEditRepayment(undefined); }}>{t('recordRepayment')}</Button>}
                <Button size="sm" variant="outline" onClick={() => setEditAdvance(row.recoverable)}>{t('editAdvance')}</Button>
              </div>
              {recoverableRepayments.filter((p) => p.recoverableId === row.recoverable.id).length > 0 && (
                <div className="mt-3 divide-y rounded-md border">
                  {recoverableRepayments.filter((p) => p.recoverableId === row.recoverable.id).sort((a, b) => b.date.getTime() - a.date.getTime()).map((p) => (
                    <button key={p.id} className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-xs" onClick={() => { setRepaymentTarget(row.recoverable); setEditRepayment(p); }}>
                      <span>{p.date.toLocaleDateString('en-IN')} • {accountName(p.accountId)} • {t('liquidityRestored')}</span><span className="font-mono font-semibold text-primary">{formatINR(p.amount)} {t('repaymentReturned')}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <AdvanceModal key={editAdvance?.id ?? (editAdvance === null ? 'new' : 'closed')} open={editAdvance !== undefined} entry={editAdvance || undefined} onClose={() => setEditAdvance(undefined)} />
      <RepaymentModal key={editRepayment?.id ?? repaymentTarget?.id ?? 'closed'} open={!!repaymentTarget} recoverable={repaymentTarget} entry={editRepayment} onClose={() => { setRepaymentTarget(null); setEditRepayment(undefined); }} />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded bg-muted/50 p-2"><p className="text-muted-foreground">{label}</p><p className="font-mono font-semibold">{formatINR(value)}</p></div>;
}

function AdvanceModal({ open, entry, onClose }: { open: boolean; entry?: Recoverable; onClose: () => void }) {
  const { accounts, addRecoverable, updateRecoverable, deleteRecoverable } = useFinanceStore();
  const [party, setParty] = useState(entry?.partyName || '');
  const [amount, setAmount] = useState(entry?.originalAmount.toString() || '');
  const [date, setDate] = useState(entry ? dateKey(entry.dateGiven) : dateKey(new Date()));
  const [accountId, setAccountId] = useState(entry?.sourceAccountId || accounts.find((a) => !a.isArchived)?.id || '');
  const [notes, setNotes] = useState(entry?.notes || '');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const selectable = accounts.filter((a) => !a.isArchived || a.id === entry?.sourceAccountId);

  async function save() {
    const parsed = parsePositiveAmount(amount);
    if (!party.trim() || parsed === null || !date || !accountId) { toast({ title: 'Complete all required fields with a valid amount', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      const payload = { party_name: party.trim(), original_amount: parsed, date_given: date, source_account_id: accountId, notes: notes || null };
      if (entry) await updateRecoverable(entry.id, payload); else await addRecoverable(payload);
      toast({ title: entry ? 'Advance updated' : 'Advance recorded' }); onClose();
    } catch (err) { toast({ title: 'Save failed', description: err instanceof Error ? err.message : 'Database error', variant: 'destructive' }); }
    finally { setSaving(false); }
  }
  async function remove() {
    if (!entry) return;
    setSaving(true);
    try { await deleteRecoverable(entry.id); toast({ title: 'Advance deleted' }); onClose(); }
    catch (err) { toast({ title: 'Delete blocked', description: err instanceof Error ? err.message : 'Delete repayments first', variant: 'destructive' }); }
    finally { setSaving(false); setConfirmDelete(false); }
  }
  return <>
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md"><DialogHeader><DialogTitle>{entry ? 'Edit Recoverable Advance' : 'Give Recoverable Advance'}</DialogTitle></DialogHeader><div className="space-y-3">
      <div><Label>Person / Party</Label><Input value={party} onChange={(e) => setParty(e.target.value)} /></div>
      <div><Label>Amount Given (₹)</Label><Input type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
      <div><Label>Date Given</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
      <div><Label>Source Account</Label><Select value={accountId} onValueChange={setAccountId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{selectable.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}{a.isArchived ? ' (Archived)' : ''}</SelectItem>)}</SelectContent></Select></div>
      <div><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
      <div className="flex gap-2">{entry && <Button variant="destructive" onClick={() => setConfirmDelete(true)}>Delete</Button>}<div className="flex-1"/><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save} disabled={saving}>{saving && <Loader2 className="mr-1 h-4 w-4 animate-spin"/>}Save</Button></div>
    </div></DialogContent></Dialog>
    <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete advance?</AlertDialogTitle><AlertDialogDescription>An advance with repayments cannot be deleted. Delete its repayments first.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={remove}>Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </>;
}

function RepaymentModal({ open, recoverable, entry, onClose }: { open: boolean; recoverable: Recoverable | null; entry?: RecoverableRepayment; onClose: () => void }) {
  const { accounts, recoverableRepayments, addRecoverableRepayment, updateRecoverableRepayment, deleteRecoverableRepayment } = useFinanceStore();
  const [amount, setAmount] = useState(entry?.amount.toString() || '');
  const [date, setDate] = useState(entry ? dateKey(entry.date) : dateKey(new Date()));
  const [accountId, setAccountId] = useState(entry?.accountId || accounts.find((a) => !a.isArchived)?.id || '');
  const [notes, setNotes] = useState(entry?.notes || '');
  const [saving, setSaving] = useState(false);
  if (!recoverable) return null;
  const available = getRecoverableSummary(recoverable, recoverableRepayments.filter((p) => p.id !== entry?.id)).outstanding;
  const selectable = accounts.filter((a) => !a.isArchived || a.id === entry?.accountId);
  async function save() {
    const parsed = parsePositiveAmount(amount);
    if (parsed === null || parsed > available || !date || !accountId) { toast({ title: `Repayment must be between ₹0 and ${formatINR(available)}`, variant: 'destructive' }); return; }
    setSaving(true);
    try {
      const payload = { recoverable_id: recoverable!.id, amount: parsed, date, account_id: accountId, notes: notes || null };
      if (entry) await updateRecoverableRepayment(entry.id, payload); else await addRecoverableRepayment(payload);
      toast({ title: entry ? 'Repayment updated' : 'Repayment recorded' }); onClose();
    } catch (err) { toast({ title: 'Save failed', description: err instanceof Error ? err.message : 'Database error', variant: 'destructive' }); }
    finally { setSaving(false); }
  }
  async function remove() { if (!entry) return; setSaving(true); try { await deleteRecoverableRepayment(entry.id); toast({ title: 'Repayment deleted' }); onClose(); } catch (err) { toast({ title: 'Delete failed', description: err instanceof Error ? err.message : 'Database error', variant: 'destructive' }); } finally { setSaving(false); } }
  return <Dialog open={open} onOpenChange={(value) => !value && onClose()}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md"><DialogHeader><DialogTitle>{entry ? 'Edit Repayment' : 'Record Repayment'} — {recoverable.partyName}</DialogTitle></DialogHeader><div className="space-y-3">
    <p className="text-sm text-muted-foreground">Available outstanding: {formatINR(available)}</p>
    <div><Label>Amount Received (₹)</Label><Input type="number" min="0.01" step="0.01" max={available} value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
    <div><Label>Date Received</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
    <div><Label>Received In</Label><Select value={accountId} onValueChange={setAccountId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{selectable.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}{a.isArchived ? ' (Archived)' : ''}</SelectItem>)}</SelectContent></Select></div>
    <div><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
    <div className="flex gap-2">{entry && <Button variant="destructive" onClick={remove}>Delete</Button>}<div className="flex-1"/><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save} disabled={saving}>{saving && <Loader2 className="mr-1 h-4 w-4 animate-spin"/>}Save</Button></div>
  </div></DialogContent></Dialog>;
}
