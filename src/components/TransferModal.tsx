import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFinanceStore } from '@/store/finance-store';
import { formatINR } from '@/utils/currency';
import { toast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import type { Transfer, TransferCategory } from '@/types/finance';
import { inferTransferCategory, parsePositiveAmount } from '@/lib/finance-domain';

const TRANSFER_CATEGORIES: { value: TransferCategory; label: string }[] = [
  { value: 'school_to_personal', label: 'School → Personal' },
  { value: 'personal_to_school', label: 'Personal → School' },
  { value: 'cash_deposit', label: 'Cash Deposit' },
  { value: 'cash_withdrawal', label: 'Cash Withdrawal' },
  { value: 'internal', label: 'Internal Transfer' },
];

interface TransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  editEntry?: Transfer;
}

export function TransferModal({ isOpen, onClose, editEntry }: TransferModalProps) {
  const { accounts, addTransfer, updateTransfer, deleteTransfer, getAccountBalance } = useFinanceStore();

  const [fromAccountId, setFromAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [category, setCategory] = useState<TransferCategory>('internal');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isEdit = !!editEntry;
  const activeAccounts = useMemo(
    () => accounts.filter((account) => !account.isArchived || account.id === editEntry?.fromAccountId || account.id === editEntry?.toAccountId),
    [accounts, editEntry?.fromAccountId, editEntry?.toAccountId],
  );

  useEffect(() => {
    if (isOpen) {
      if (editEntry) {
        setFromAccountId(editEntry.fromAccountId);
        setToAccountId(editEntry.toAccountId);
        setAmount(editEntry.amount.toString());
        setDate(editEntry.date.toISOString().split('T')[0]);
        setCategory(editEntry.category);
        setNotes(editEntry.notes);
      } else {
        setFromAccountId('');
        setToAccountId('');
        setAmount('');
        setDate(new Date().toISOString().split('T')[0]);
        setCategory('internal');
        setNotes('');
      }
      setErrors({});
    }
  }, [isOpen, editEntry]);

  function validate(): boolean {
    const errs: Record<string, string> = {};
    const amt = parsePositiveAmount(amount);
    if (amt === null) errs.amount = 'Enter a finite amount greater than zero';
    if (!fromAccountId) errs.from = 'Select source account';
    if (!toAccountId) errs.to = 'Select destination account';
    if (fromAccountId && toAccountId && fromAccountId === toAccountId) errs.to = 'Cannot transfer to same account';
    if (!date) errs.date = 'Date is required';
    if (amt !== null && fromAccountId) {
      let available = getAccountBalance(fromAccountId);
      if (editEntry?.fromAccountId === fromAccountId) available += editEntry.amount;
      if (editEntry?.toAccountId === fromAccountId) available -= editEntry.amount;
      if (amt > available) errs.amount = `Available balance is ${formatINR(available)}`;
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    try {
      const fromAccount = accounts.find((account) => account.id === fromAccountId)!;
      const toAccount = accounts.find((account) => account.id === toAccountId)!;
      const payload = {
        from_account_id: fromAccountId,
        to_account_id: toAccountId,
        amount: parsePositiveAmount(amount)!,
        date,
        category: inferTransferCategory(fromAccount.type, toAccount.type),
        notes: notes || null,
      };

      if (isEdit && editEntry) {
        await updateTransfer(editEntry.id, payload);
        toast({ title: '✅ Transfer updated' });
      } else {
        await addTransfer(payload);
        toast({ title: '✅ Transfer recorded' });
      }
      onClose();
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to save', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!editEntry) return;
    setSaving(true);
    try {
      await deleteTransfer(editEntry.id);
      toast({ title: 'Transfer deleted' });
      setShowDeleteConfirm(false);
      onClose();
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to delete', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{isEdit ? 'Edit Transfer' : 'Transfer Money'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>From Account</Label>
              <Select value={fromAccountId} onValueChange={setFromAccountId}>
                <SelectTrigger><SelectValue placeholder="Select source" /></SelectTrigger>
                <SelectContent>
                  {activeAccounts.filter((a) => a.id !== toAccountId).map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}{a.isArchived ? ' (Archived)' : ''}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.from && <p className="mt-1 text-xs text-destructive">{errors.from}</p>}
            </div>

            <div>
              <Label>To Account</Label>
              <Select value={toAccountId} onValueChange={setToAccountId}>
                <SelectTrigger><SelectValue placeholder="Select destination" /></SelectTrigger>
                <SelectContent>
                  {activeAccounts.filter((a) => a.id !== fromAccountId).map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}{a.isArchived ? ' (Archived)' : ''}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.to && <p className="mt-1 text-xs text-destructive">{errors.to}</p>}
            </div>

            <div>
              <Label htmlFor="tr-amount">Amount (₹)</Label>
              <Input id="tr-amount" type="number" min="1" placeholder="Enter amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
              {amount && parseFloat(amount) > 0 && (
                <p className="mt-1 text-xs text-muted-foreground">{formatINR(parseFloat(amount))}</p>
              )}
              {errors.amount && <p className="mt-1 text-xs text-destructive">{errors.amount}</p>}
            </div>

            <div>
              <Label htmlFor="tr-date">Date</Label>
              <Input id="tr-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              {errors.date && <p className="mt-1 text-xs text-destructive">{errors.date}</p>}
            </div>

            <div>
              <Label>Transfer Type</Label>
              <Input
                value={fromAccountId && toAccountId
                  ? TRANSFER_CATEGORIES.find((item) => item.value === inferTransferCategory(
                      accounts.find((account) => account.id === fromAccountId)!.type,
                      accounts.find((account) => account.id === toAccountId)!.type,
                    ))?.label || 'Internal Transfer'
                  : 'Select both accounts'}
                readOnly
              />
            </div>

            <div>
              <Label htmlFor="tr-notes">Notes (optional)</Label>
              <Textarea id="tr-notes" placeholder="Reason for transfer..." value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 sm:flex sm:items-center">
              {isEdit && (
                <Button variant="destructive" size="sm" onClick={() => setShowDeleteConfirm(true)} disabled={saving} className="col-span-2 sm:col-span-1">
                  Delete
                </Button>
              )}
              <div className="hidden flex-1 sm:block" />
              <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving} className="gap-1.5">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {isEdit ? 'Update' : 'Transfer'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Transfer</AlertDialogTitle>
            <AlertDialogDescription>
              Delete this transfer of {editEntry ? formatINR(editEntry.amount) : ''}? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              {saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              Yes, Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
