import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useFinanceStore } from '@/store/finance-store';
import { formatINR } from '@/utils/currency';
import { toast } from '@/hooks/use-toast';
import { Loader2, X, IndianRupee, UtensilsCrossed } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { IncomeEntry } from '@/types/finance';

interface AddIncomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  editEntry?: IncomeEntry;
}

export function AddIncomeModal({ isOpen, onClose, editEntry }: AddIncomeModalProps) {
  const { accounts, academicYears, incomeEntries, currentYearId, addIncome, updateIncome, deleteIncome, getYearForDate } = useFinanceStore();

  const [incomeType, setIncomeType] = useState<'tuition' | 'lunch'>('tuition');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [accountId, setAccountId] = useState('');
  const [isLateCollection, setIsLateCollection] = useState(false);
  const [originalYearId, setOriginalYearId] = useState('');
  const [notes, setNotes] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isEdit = !!editEntry;

  const activeAccounts = accounts.filter((a) => !a.isArchived);

  const detectedYear = useMemo(() => {
    if (!date) return undefined;
    return getYearForDate(new Date(date));
  }, [date, getYearForDate]);

  const academicYearId = detectedYear?.id || currentYearId;

  const pendingYears = useMemo(() => {
    return academicYears.filter((y) => {
      const collected = incomeEntries
        .filter(
          (i) =>
            i.type === 'tuition' &&
            (
              (i.academicYearId === y.id && !i.isLateCollection) ||
              (i.isLateCollection && i.originalYearId === y.id)
            )
        )
        .reduce((s, i) => s + i.amount, 0);
      const totalOwed = y.targetTuitionFees + (y.carryForwardFees || 0);
      return collected < totalOwed;
    });
  }, [academicYears, incomeEntries]);

  useEffect(() => {
    if (isOpen) {
      if (editEntry) {
        setIncomeType(editEntry.type);
        setAmount(editEntry.amount.toString());
        setDate(editEntry.date.toISOString().split('T')[0]);
        setAccountId(editEntry.accountId);
        setIsLateCollection(editEntry.isLateCollection);
        setOriginalYearId(editEntry.originalYearId || '');
        setNotes(editEntry.notes);
        setTags(editEntry.tags);
      } else {
        setIncomeType('tuition');
        setAmount('');
        setDate(new Date().toISOString().split('T')[0]);
        setAccountId(activeAccounts[0]?.id || '');
        setIsLateCollection(false);
        setOriginalYearId('');
        setNotes('');
        setTags([]);
      }
      setErrors({});
      setTagInput('');
    }
  }, [isOpen, editEntry]);

  function validate(): boolean {
    const errs: Record<string, string> = {};
    const amt = parseFloat(amount);
    if (!amount || isNaN(amt) || amt <= 0) errs.amount = 'Amount must be greater than zero';
    if (!date) errs.date = 'Date is required';
    if (!accountId) errs.accountId = 'Select an account';
    if (isLateCollection && !originalYearId) errs.originalYearId = 'Select the original year';
    if (!academicYearId) errs.year = 'No academic year found for this date';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function addTag() {
    const newTags = tagInput.split(',').map((t) => t.trim()).filter((t) => t && !tags.includes(t));
    if (newTags.length) setTags([...tags, ...newTags]);
    setTagInput('');
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        type: incomeType as 'tuition' | 'lunch',
        amount: parseFloat(amount),
        date,
        academic_year_id: academicYearId,
        account_id: accountId,
        is_late_collection: isLateCollection,
        original_year_id: isLateCollection ? originalYearId : null,
        notes: notes || null,
        tags: tags.length > 0 ? tags : null,
      };

      if (isEdit && editEntry) {
        await updateIncome(editEntry.id, payload);
        toast({ title: '✅ Income updated' });
      } else {
        await addIncome(payload);
        toast({ title: '✅ Income recorded' });
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
      await deleteIncome(editEntry.id);
      toast({ title: 'Income entry deleted' });
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
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{isEdit ? 'Edit Income' : 'Add Income'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Income Type Toggle */}
            <div>
              <Label className="mb-2 block text-sm">Income Type</Label>
              <div className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setIncomeType('tuition')}
                  className={cn(
                    'flex items-center justify-center gap-2 rounded-lg border-2 p-3 text-sm font-semibold transition-all',
                    incomeType === 'tuition'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-card text-muted-foreground hover:border-primary/50'
                  )}
                >
                  <IndianRupee className="h-4 w-4" />
                  Tuition Fees
                </button>
                <button
                  type="button"
                  onClick={() => setIncomeType('lunch')}
                  className={cn(
                    'flex items-center justify-center gap-2 rounded-lg border-2 p-3 text-sm font-semibold transition-all',
                    incomeType === 'lunch'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-card text-muted-foreground hover:border-primary/50'
                  )}
                >
                  <UtensilsCrossed className="h-4 w-4" />
                  Lunch Fees
                </button>
              </div>
            </div>

            {/* Amount */}
            <div>
              <Label htmlFor="amount">Amount (₹)</Label>
              <Input
                id="amount"
                type="number"
                min="1"
                placeholder="Enter amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              {amount && parseFloat(amount) > 0 && (
                <p className="mt-1 text-xs text-muted-foreground">{formatINR(parseFloat(amount))}</p>
              )}
              {errors.amount && <p className="mt-1 text-xs text-destructive">{errors.amount}</p>}
            </div>

            {/* Date */}
            <div>
              <Label htmlFor="date">Date</Label>
              <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              {detectedYear && (
                <p className="mt-1 text-xs text-muted-foreground">Academic Year: {detectedYear.label}</p>
              )}
              {errors.date && <p className="mt-1 text-xs text-destructive">{errors.date}</p>}
              {errors.year && <p className="mt-1 text-xs text-destructive">{errors.year}</p>}
            </div>

            {/* Account */}
            <div>
              <Label>Received In</Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                <SelectContent>
                  {activeAccounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.accountId && <p className="mt-1 text-xs text-destructive">{errors.accountId}</p>}
            </div>

            {/* Late Collection */}
            <div className="flex items-center justify-between rounded-lg border bg-card p-3">
              <div>
                <p className="text-sm font-medium">Late Collection</p>
                <p className="text-xs text-muted-foreground">Payment from a previous year</p>
              </div>
              <Switch checked={isLateCollection} onCheckedChange={setIsLateCollection} />
            </div>

            {isLateCollection && (
              <div>
                <Label>This payment belongs to:</Label>
                <Select value={originalYearId} onValueChange={setOriginalYearId}>
                  <SelectTrigger><SelectValue placeholder="Select original year" /></SelectTrigger>
                  <SelectContent>
                    {pendingYears.map((y) => (
                      <SelectItem key={y.id} value={y.id}>AY {y.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.originalYearId && <p className="mt-1 text-xs text-destructive">{errors.originalYearId}</p>}
              </div>
            )}

            {/* Notes */}
            <div>
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea id="notes" placeholder="Add any notes..." value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>

            {/* Tags */}
            <div>
              <Label>Tags (optional)</Label>
              <div className="flex flex-col gap-2 min-[360px]:flex-row">
                <Input
                  placeholder="Add tags, comma separated"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                />
                <Button type="button" size="sm" variant="outline" onClick={addTag}>Add</Button>
              </div>
              {tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="max-w-full gap-1">
                      {tag}
                      <X className="h-3 w-3 cursor-pointer" onClick={() => setTags(tags.filter((t) => t !== tag))} />
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-2 pt-2 sm:flex sm:items-center">
              {isEdit && (
                <Button variant="destructive" size="sm" onClick={() => setShowDeleteConfirm(true)} disabled={saving} className="col-span-2 sm:col-span-1">
                  Delete
                </Button>
              )}
              <div className="hidden flex-1 sm:block" />
              <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving} className="gap-1.5 bg-income text-income-foreground hover:bg-income/90">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {isEdit ? 'Update' : 'Save'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Income Entry</AlertDialogTitle>
            <AlertDialogDescription>
              Delete this income entry of {editEntry ? formatINR(editEntry.amount) : ''}? This cannot be undone.
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
