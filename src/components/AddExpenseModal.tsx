import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useFinanceStore } from '@/store/finance-store';
import { formatINR } from '@/utils/currency';
import { toast } from '@/hooks/use-toast';
import { Loader2, X, School, Home, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SCHOOL_EXPENSE_CATEGORIES, HOME_EXPENSE_CATEGORIES } from '@/types/finance';
import type { ExpenseEntry } from '@/types/finance';

const MONTHLY_CATEGORIES = ['Land Rent', 'Electricity Bill', 'Internet & Phone Bill'];

interface AddExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  editEntry?: ExpenseEntry;
  onEditExisting?: (entry: ExpenseEntry) => void;
}

type DuplicateWarning = {
  type: 'exact' | 'similar' | 'monthly';
  message: string;
  existing?: ExpenseEntry;
};

export function AddExpenseModal({ isOpen, onClose, editEntry, onEditExisting }: AddExpenseModalProps) {
  const { accounts, expenseEntries, currentYearId, addExpense, updateExpense, deleteExpense, getYearForDate } = useFinanceStore();

  const [step, setStep] = useState(1);
  const [expenseType, setExpenseType] = useState<'school' | 'home' | ''>('');
  const [category, setCategory] = useState('');
  const [subCategory, setSubCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [accountId, setAccountId] = useState('');
  const [description, setDescription] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<DuplicateWarning | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isEdit = !!editEntry;
  const activeAccounts = accounts.filter((a) => !a.isArchived);
  const categories = expenseType === 'school' ? SCHOOL_EXPENSE_CATEGORIES : HOME_EXPENSE_CATEGORIES;

  const detectedYear = useMemo(() => {
    if (!date) return undefined;
    return getYearForDate(new Date(date));
  }, [date, getYearForDate]);

  const academicYearId = detectedYear?.id || currentYearId;

  useEffect(() => {
    if (isOpen) {
      if (editEntry) {
        setStep(3);
        setExpenseType(editEntry.expenseType);
        setCategory(editEntry.category);
        setAmount(editEntry.amount.toString());
        setDate(editEntry.date.toISOString().split('T')[0]);
        setAccountId(editEntry.accountId);
        setDescription(editEntry.description);
        setTags(editEntry.tags);
      } else {
        setStep(1);
        setExpenseType('');
        setCategory('');
        setSubCategory('');
        setAmount('');
        setDate(new Date().toISOString().split('T')[0]);
        setAccountId(activeAccounts[0]?.id || '');
        setDescription('');
        setTags([]);
      }
      setErrors({});
      setTagInput('');
      setDuplicateWarning(null);
    }
  }, [isOpen, editEntry]);

  function validate(): boolean {
    const errs: Record<string, string> = {};
    const amt = parseFloat(amount);
    if (!amount || isNaN(amt) || amt <= 0) errs.amount = 'Amount must be greater than zero';
    if (!date) errs.date = 'Date is required';
    if (!accountId) errs.accountId = 'Select an account';
    if (!academicYearId) errs.year = 'No academic year found for this date';

    // Block home expenses from school bank accounts
    if (expenseType === 'home') {
      const selectedAcc = accounts.find((a) => a.id === accountId);
      if (selectedAcc?.type === 'school_bank') {
        errs.accountId = '❌ Home expenses cannot be paid from School Bank Account';
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function checkDuplicates(): DuplicateWarning | null {
    const amt = parseFloat(amount);
    const entryDate = new Date(date);
    const entryMonth = entryDate.getMonth();
    const entryYear = entryDate.getFullYear();

    // Exclude current entry in edit mode
    const entries = isEdit
      ? expenseEntries.filter((e) => e.id !== editEntry?.id)
      : expenseEntries;

    // Check 1: Exact duplicate
    const exact = entries.find(
      (e) => e.date.toISOString().split('T')[0] === date && e.amount === amt && e.category === category
    );
    if (exact) {
      return {
        type: 'exact',
        message: `You already recorded ${category} for ${formatINR(amt)} on ${exact.date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}.`,
        existing: exact,
      };
    }

    // Check 2: Similar description
    if (description.trim()) {
      const words = description.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
      const similar = entries.find((e) => {
        if (e.date.getMonth() !== entryMonth || e.date.getFullYear() !== entryYear) return false;
        const eWords = (e.description || '').toLowerCase().split(/\s+/);
        return words.some((w) => eWords.some((ew) => ew.includes(w) || w.includes(ew)));
      });
      if (similar) {
        return {
          type: 'similar',
          message: `Entry '${similar.description || similar.category}' on ${similar.date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} for ${formatINR(similar.amount)} looks similar.`,
          existing: similar,
        };
      }
    }

    // Check 3: Monthly category repeat
    if (MONTHLY_CATEGORIES.includes(category)) {
      const monthRepeat = entries.find(
        (e) => e.category === category && e.date.getMonth() === entryMonth && e.date.getFullYear() === entryYear
      );
      if (monthRepeat) {
        return {
          type: 'monthly',
          message: `${category} already recorded for ${entryDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}: ${formatINR(monthRepeat.amount)} on ${monthRepeat.date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}.`,
          existing: monthRepeat,
        };
      }
    }

    return null;
  }

  function addTag() {
    const newTags = tagInput.split(',').map((t) => t.trim()).filter((t) => t && !tags.includes(t));
    if (newTags.length) setTags([...tags, ...newTags]);
    setTagInput('');
  }

  async function handleSave(force = false) {
    if (!validate()) return;

    if (!force && !isEdit) {
      const warning = checkDuplicates();
      if (warning) {
        setDuplicateWarning(warning);
        return;
      }
    }

    setSaving(true);
    try {
      const isOther = category.startsWith('Other');
      const payload = {
        expense_type: expenseType as 'school' | 'home',
        category,
        sub_category: isOther ? subCategory : null,
        amount: parseFloat(amount),
        date,
        academic_year_id: academicYearId,
        account_id: accountId,
        description: description || null,
        tags: tags.length > 0 ? tags : null,
        is_recurring_instance: false,
        recurring_template_id: null,
      };

      if (isEdit && editEntry) {
        await updateExpense(editEntry.id, payload);
        toast({ title: '✅ Expense updated' });
      } else {
        await addExpense(payload);
        toast({ title: '✅ Expense recorded' });
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
      await deleteExpense(editEntry.id);
      toast({ title: 'Expense entry deleted' });
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
            <DialogTitle>
              {isEdit ? 'Edit Expense' : step === 1 ? 'Expense Type' : step === 2 ? 'Select Category' : 'Expense Details'}
            </DialogTitle>
          </DialogHeader>

          {/* Step 1: Type Selection */}
          {step === 1 && (
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => { setExpenseType('school'); setStep(2); }}
                className="flex w-full items-center gap-3 rounded-lg border-2 border-border p-4 text-left transition-all hover:border-primary hover:bg-primary/5"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <School className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold">🏫 School Expense</p>
                  <p className="text-fit text-xs text-muted-foreground">Salary, rent, bills, supplies...</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => { setExpenseType('home'); setStep(2); }}
                className="flex w-full items-center gap-3 rounded-lg border-2 border-border p-4 text-left transition-all hover:border-warning hover:bg-warning/5"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10">
                  <Home className="h-5 w-5 text-warning" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold">🏠 Home Expense</p>
                  <p className="text-fit text-xs text-muted-foreground">Fuel, groceries, personal...</p>
                </div>
              </button>
            </div>
          )}

          {/* Step 2: Category */}
          {step === 2 && (
            <div className="space-y-3">
              <Button variant="ghost" size="sm" onClick={() => setStep(1)} className="gap-1">
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
              <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => { setCategory(cat); setStep(3); }}
                    className={cn(
                      'rounded-lg border p-3 text-left text-sm font-medium transition-all hover:border-primary hover:bg-primary/5',
                      category === cat ? 'border-primary bg-primary/10' : 'border-border'
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Details */}
          {step === 3 && (
            <div className="space-y-4">
              {/* Header showing type + category */}
              <div className="flex items-center gap-2 rounded-lg bg-muted p-2">
                {expenseType === 'school' ? <School className="h-4 w-4 text-primary" /> : <Home className="h-4 w-4 text-warning" />}
                <span className="text-fit text-sm font-medium">{expenseType === 'school' ? '🏫 School' : '🏠 Home'} → {category}</span>
                {!isEdit && (
                  <Button variant="link" size="sm" className="ml-auto h-auto p-0 text-xs" onClick={() => setStep(1)}>
                    Change
                  </Button>
                )}
              </div>

              {category.startsWith('Other') && (
                <div>
                  <Label>Specify expense type</Label>
                  <Input placeholder="What was this for?" value={subCategory} onChange={(e) => setSubCategory(e.target.value)} />
                </div>
              )}

              <div>
                <Label htmlFor="exp-amount">Amount (₹)</Label>
                <Input id="exp-amount" type="number" min="1" placeholder="Enter amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
                {amount && parseFloat(amount) > 0 && (
                  <p className="mt-1 text-xs text-muted-foreground">{formatINR(parseFloat(amount))}</p>
                )}
                {errors.amount && <p className="mt-1 text-xs text-destructive">{errors.amount}</p>}
              </div>

              <div>
                <Label htmlFor="exp-date">Date</Label>
                <Input id="exp-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                {detectedYear && <p className="mt-1 text-xs text-muted-foreground">AY: {detectedYear.label}</p>}
                {errors.date && <p className="mt-1 text-xs text-destructive">{errors.date}</p>}
                {errors.year && <p className="mt-1 text-xs text-destructive">{errors.year}</p>}
              </div>

              <div>
                <Label>Payment From</Label>
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

              <div>
                <Label htmlFor="exp-desc">Description (optional)</Label>
                <Textarea id="exp-desc" placeholder="What was this for?" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
              </div>

              <div>
                <Label>Tags (optional)</Label>
                <div className="flex flex-col gap-2 min-[360px]:flex-row">
                  <Input placeholder="Comma separated" value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())} />
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

              <div className="grid grid-cols-2 gap-2 pt-2 sm:flex sm:items-center">
                {isEdit && (
                  <Button variant="destructive" size="sm" onClick={() => setShowDeleteConfirm(true)} disabled={saving} className="col-span-2 sm:col-span-1">
                    Delete
                  </Button>
                )}
                <div className="hidden flex-1 sm:block" />
                <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
                <Button onClick={() => handleSave()} disabled={saving} variant="destructive" className="gap-1.5">
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {isEdit ? 'Update' : 'Save'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Duplicate Warning Dialog */}
      <AlertDialog open={!!duplicateWarning} onOpenChange={(open) => !open && setDuplicateWarning(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className={cn(
              duplicateWarning?.type === 'exact' && 'text-destructive',
              duplicateWarning?.type === 'similar' && 'text-warning',
              duplicateWarning?.type === 'monthly' && 'text-orange-500',
            )}>
              {duplicateWarning?.type === 'exact' && '⚠️ Possible Duplicate'}
              {duplicateWarning?.type === 'similar' && '⚠️ Similar Entry Found'}
              {duplicateWarning?.type === 'monthly' && '⚠️ Already Recorded This Month'}
            </AlertDialogTitle>
            <AlertDialogDescription>{duplicateWarning?.message}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            {duplicateWarning?.type === 'monthly' && duplicateWarning.existing && onEditExisting && (
              <Button
                variant="outline"
                onClick={() => {
                  setDuplicateWarning(null);
                  onClose();
                  onEditExisting(duplicateWarning.existing!);
                }}
              >
                Update Existing
              </Button>
            )}
            <AlertDialogAction onClick={() => { setDuplicateWarning(null); handleSave(true); }}>
              {duplicateWarning?.type === 'exact' ? 'Save Anyway' : duplicateWarning?.type === 'similar' ? "They're Different — Save" : 'Yes, Add Another'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirm */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Expense Entry</AlertDialogTitle>
            <AlertDialogDescription>
              Delete this expense of {editEntry ? formatINR(editEntry.amount) : ''}? This cannot be undone.
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
