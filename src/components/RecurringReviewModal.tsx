import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFinanceStore, type PendingRecurringItem } from '@/store/finance-store';
import { formatINR } from '@/utils/currency';
import { toast } from '@/hooks/use-toast';
import { Loader2, Check, SkipForward } from 'lucide-react';
import * as recurringService from '@/services/recurring';

interface RecurringReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function RecurringReviewModal({ isOpen, onClose }: RecurringReviewModalProps) {
  const { pendingRecurringItems, accounts, currentYearId, addExpense } = useFinanceStore();
  const activeAccounts = accounts.filter((a) => !a.isArchived);

  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [accountIds, setAccountIds] = useState<Record<string, string>>({});
  const [processing, setProcessing] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const visibleItems = pendingRecurringItems.filter((item) => !dismissed.has(item.template.id));

  function getAmount(item: PendingRecurringItem): string {
    return amounts[item.template.id] ?? '';
  }

  function getAccountId(item: PendingRecurringItem): string {
    return accountIds[item.template.id] ?? activeAccounts[0]?.id ?? '';
  }

  async function handleConfirm(item: PendingRecurringItem) {
    const amt = parseFloat(getAmount(item));
    if (!amt || amt <= 0) {
      toast({ title: 'Enter a valid amount', variant: 'destructive' });
      return;
    }
    const accId = getAccountId(item);
    if (!accId) {
      toast({ title: 'Select an account', variant: 'destructive' });
      return;
    }

    setProcessing(item.template.id);
    try {
      const today = new Date();
      await addExpense({
        expense_type: item.template.expenseType as 'school' | 'home',
        category: item.template.category,
        sub_category: null,
        amount: amt,
        date: today.toISOString().split('T')[0],
        academic_year_id: currentYearId,
        account_id: accId,
        description: `Recurring — ${today.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}`,
        tags: null,
        is_recurring_instance: true,
        recurring_template_id: item.template.id,
      });

      await recurringService.update(item.template.id, {
        last_generated_date: today.toISOString().split('T')[0],
      });

      setDismissed((prev) => new Set(prev).add(item.template.id));
      toast({ title: `✅ ${item.template.category} recorded` });
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to save',
        variant: 'destructive',
      });
    } finally {
      setProcessing(null);
    }
  }

  function handleSkip(id: string) {
    setDismissed((prev) => new Set(prev).add(id));
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>📋 Recurring Expenses Review</DialogTitle>
        </DialogHeader>

        {visibleItems.length === 0 ? (
          <div className="py-8 text-center">
            <Check className="mx-auto mb-3 h-10 w-10 text-income" />
            <p className="text-sm text-muted-foreground">All items reviewed!</p>
            <Button className="mt-4" onClick={onClose}>Done</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {visibleItems.length} expense{visibleItems.length !== 1 ? 's' : ''} need your review for this month.
            </p>

            {visibleItems.map((item) => (
              <div key={item.template.id} className="rounded-lg border bg-card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">{item.template.category}</p>
                    <p className="text-xs text-muted-foreground">
                      Last: {formatINR(item.lastAmount)} • {item.template.recurrenceInterval}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Amount (₹)</Label>
                    <Input
                      type="number"
                      min="1"
                      placeholder={formatINR(item.lastAmount)}
                      value={getAmount(item)}
                      onChange={(e) => setAmounts((prev) => ({ ...prev, [item.template.id]: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Account</Label>
                    <Select value={getAccountId(item)} onValueChange={(v) => setAccountIds((prev) => ({ ...prev, [item.template.id]: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {activeAccounts.map((a) => (
                          <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="gap-1 bg-income text-income-foreground hover:bg-income/90"
                    onClick={() => handleConfirm(item)}
                    disabled={processing === item.template.id}
                  >
                    {processing === item.template.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Check className="h-3.5 w-3.5" />
                    )}
                    Confirm
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1"
                    onClick={() => handleSkip(item.template.id)}
                    disabled={processing === item.template.id}
                  >
                    <SkipForward className="h-3.5 w-3.5" />
                    Skip
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
