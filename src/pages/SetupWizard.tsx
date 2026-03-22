import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { GraduationCap, Plus, Trash2, Loader2, CheckCircle2 } from 'lucide-react';
import { formatINR } from '@/utils/currency';
import { getCurrentAcademicYear, getAcademicYearDates } from '@/utils/academic-year';
import * as accountsService from '@/services/accounts';
import * as academicYearsService from '@/services/academicYears';
import * as recurringService from '@/services/recurring';
import { useFinanceStore } from '@/store/finance-store';
import { toast } from '@/hooks/use-toast';

interface AccountDraft {
  key: string;
  name: string;
  type: 'school_bank' | 'personal_bank' | 'cash';
  balance: string;
}

interface RecurringDraft {
  category: string;
  interval: 'monthly' | 'bimonthly' | 'quarterly';
  amount: string;
  note: string;
}

export default function SetupWizard() {
  const navigate = useNavigate();
  const init = useFinanceStore((s) => s.init);
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // Step 1: Accounts
  const [schoolAccount, setSchoolAccount] = useState<AccountDraft>({
    key: 'school',
    name: '',
    type: 'school_bank',
    balance: '',
  });
  const [personalAccounts, setPersonalAccounts] = useState<AccountDraft[]>([
    { key: 'p1', name: '', type: 'personal_bank', balance: '' },
  ]);
  const [cashBalance, setCashBalance] = useState('');

  // Step 2: Academic Year
  const currentAY = getCurrentAcademicYear();
  const ayDates = getAcademicYearDates(currentAY);
  const [ayLabel, setAyLabel] = useState(currentAY);
  const [ayStartDate, setAyStartDate] = useState(
    ayDates.start.toISOString().split('T')[0]
  );
  const [ayEndDate, setAyEndDate] = useState(
    ayDates.end.toISOString().split('T')[0]
  );
  const [targetFees, setTargetFees] = useState('');
  const [recurringDrafts, setRecurringDrafts] = useState<RecurringDraft[]>([
    { category: 'Salary & Wages', interval: 'monthly', amount: '', note: 'Varies monthly' },
    { category: 'Land Rent', interval: 'monthly', amount: '', note: 'Enter current rent' },
    { category: 'Electricity Bill', interval: 'monthly', amount: '', note: 'Varies monthly' },
    { category: 'Internet & Phone Bill', interval: 'bimonthly', amount: '', note: 'Varies' },
  ]);

  function addPersonalAccount() {
    if (personalAccounts.length >= 5) return;
    setPersonalAccounts((prev) => [
      ...prev,
      { key: `p${Date.now()}`, name: '', type: 'personal_bank', balance: '' },
    ]);
  }

  function removePersonalAccount(key: string) {
    if (personalAccounts.length <= 1) return;
    setPersonalAccounts((prev) => prev.filter((a) => a.key !== key));
  }

  function canProceedStep1() {
    if (!schoolAccount.name.trim()) return false;
    if (personalAccounts.some((a) => !a.name.trim())) return false;
    return true;
  }

  function canProceedStep2() {
    return ayLabel.trim().length > 0 && ayStartDate && ayEndDate;
  }

  async function handleFinish() {
    setSaving(true);
    try {
      // Create accounts
      const allAccountDrafts = [
        schoolAccount,
        ...personalAccounts,
        { key: 'cash', name: 'Cash at Home', type: 'cash' as const, balance: cashBalance },
      ];

      for (const draft of allAccountDrafts) {
        const { error } = await accountsService.create({
          name: draft.name || 'Cash at Home',
          type: draft.type,
          starting_balance: parseFloat(draft.balance) || 0,
          is_archived: false,
        });
        if (error) throw error;
      }

      // Create academic year
      const { error: ayError } = await academicYearsService.create({
        label: ayLabel,
        start_date: ayStartDate,
        end_date: ayEndDate,
        target_tuition_fees: parseFloat(targetFees) || 0,
        status: 'active',
      });
      if (ayError) throw ayError;

      // Create recurring templates
      for (const draft of recurringDrafts) {
        const { error } = await recurringService.create({
          expense_type: 'school',
          category: draft.category,
          default_amount: parseFloat(draft.amount) || 0,
          recurrence_interval: draft.interval,
          last_generated_date: null,
          is_active: true,
        });
        if (error) throw error;
      }

      // Reload store
      await init();
      toast({ title: 'Setup complete!', description: 'Your finance tracker is ready.' });
      navigate('/', { replace: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Setup failed';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-lg space-y-6">
        {/* Header */}
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary">
            <GraduationCap className="h-7 w-7 text-primary-foreground" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold">First-Time Setup</h1>
            <p className="text-sm text-muted-foreground">Step {step} of 3</p>
          </div>
          {/* Progress */}
          <div className="flex gap-2">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`h-2 w-16 rounded-full ${s <= step ? 'bg-primary' : 'bg-muted'}`}
              />
            ))}
          </div>
        </div>

        {/* Step 1 */}
        {step === 1 && (
          <div className="space-y-5 rounded-lg border bg-card p-5">
            <h2 className="text-lg font-semibold">Set Up Your Accounts</h2>

            {/* School Account */}
            <div className="space-y-2">
              <label className="text-sm font-medium">🏫 School Bank Account</label>
              <Input
                placeholder="e.g., SBI School Account"
                value={schoolAccount.name}
                onChange={(e) => setSchoolAccount({ ...schoolAccount, name: e.target.value })}
              />
              <Input
                type="number"
                placeholder="Starting balance (₹)"
                value={schoolAccount.balance}
                onChange={(e) => setSchoolAccount({ ...schoolAccount, balance: e.target.value })}
              />
            </div>

            {/* Personal Accounts */}
            <div className="space-y-3">
              <label className="text-sm font-medium">👤 Personal Bank Accounts</label>
              {personalAccounts.map((acc) => (
                <div key={acc.key} className="flex gap-2">
                  <div className="flex-1 space-y-2">
                    <Input
                      placeholder="Account name"
                      value={acc.name}
                      onChange={(e) =>
                        setPersonalAccounts((prev) =>
                          prev.map((a) => (a.key === acc.key ? { ...a, name: e.target.value } : a))
                        )
                      }
                    />
                    <Input
                      type="number"
                      placeholder="Starting balance (₹)"
                      value={acc.balance}
                      onChange={(e) =>
                        setPersonalAccounts((prev) =>
                          prev.map((a) => (a.key === acc.key ? { ...a, balance: e.target.value } : a))
                        )
                      }
                    />
                  </div>
                  {personalAccounts.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="mt-1 text-muted-foreground hover:text-destructive"
                      onClick={() => removePersonalAccount(acc.key)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              {personalAccounts.length < 5 && (
                <Button variant="outline" size="sm" onClick={addPersonalAccount} className="gap-1">
                  <Plus className="h-3.5 w-3.5" /> Add Another
                </Button>
              )}
            </div>

            {/* Cash */}
            <div className="space-y-2">
              <label className="text-sm font-medium">💵 Cash at Home</label>
              <Input
                type="number"
                placeholder="Current cash balance (₹)"
                value={cashBalance}
                onChange={(e) => setCashBalance(e.target.value)}
              />
            </div>

            <Button onClick={() => setStep(2)} disabled={!canProceedStep1()} className="w-full">
              Next →
            </Button>
          </div>
        )}

        {/* Step 2 */}
        {step === 2 && (
          <div className="space-y-5 rounded-lg border bg-card p-5">
            <h2 className="text-lg font-semibold">Set Up Academic Year {ayLabel}</h2>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium">Label</label>
                <Input value={ayLabel} onChange={(e) => setAyLabel(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Target Tuition Fees (₹)</label>
                <Input
                  type="number"
                  placeholder="e.g., 3000000"
                  value={targetFees}
                  onChange={(e) => setTargetFees(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Start Date</label>
                <Input type="date" value={ayStartDate} onChange={(e) => setAyStartDate(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">End Date</label>
                <Input type="date" value={ayEndDate} onChange={(e) => setAyEndDate(e.target.value)} />
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Recurring Expense Templates</h3>
              {recurringDrafts.map((draft, idx) => (
                <div key={draft.category} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{draft.category}</span>
                    <span className="rounded bg-muted px-2 py-0.5 text-[10px]">{draft.interval}</span>
                  </div>
                  <Input
                    type="number"
                    placeholder={`Amount (₹) — ${draft.note}`}
                    value={draft.amount}
                    className="mt-2"
                    onChange={(e) =>
                      setRecurringDrafts((prev) =>
                        prev.map((d, i) => (i === idx ? { ...d, amount: e.target.value } : d))
                      )
                    }
                  />
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                ← Back
              </Button>
              <Button onClick={() => setStep(3)} disabled={!canProceedStep2()} className="flex-1">
                Next →
              </Button>
            </div>
          </div>
        )}

        {/* Step 3 */}
        {step === 3 && (
          <div className="space-y-5 rounded-lg border bg-card p-5">
            <h2 className="text-lg font-semibold">Review & Confirm</h2>

            {/* Accounts summary */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Accounts</h3>
              <div className="space-y-1.5">
                <ReviewRow
                  label={`🏫 ${schoolAccount.name || 'School Account'}`}
                  value={formatINR(parseFloat(schoolAccount.balance) || 0)}
                />
                {personalAccounts.map((a) => (
                  <ReviewRow
                    key={a.key}
                    label={`👤 ${a.name}`}
                    value={formatINR(parseFloat(a.balance) || 0)}
                  />
                ))}
                <ReviewRow
                  label="💵 Cash at Home"
                  value={formatINR(parseFloat(cashBalance) || 0)}
                />
              </div>
              <div className="mt-2 rounded bg-muted px-3 py-2 text-sm font-semibold">
                Total Starting Balance:{' '}
                <span className="font-mono">
                  {formatINR(
                    (parseFloat(schoolAccount.balance) || 0) +
                    personalAccounts.reduce((s, a) => s + (parseFloat(a.balance) || 0), 0) +
                    (parseFloat(cashBalance) || 0)
                  )}
                </span>
              </div>
            </div>

            {/* Year summary */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Academic Year</h3>
              <ReviewRow label="Label" value={ayLabel} />
              <ReviewRow label="Period" value={`${ayStartDate} → ${ayEndDate}`} />
              <ReviewRow label="Tuition Target" value={formatINR(parseFloat(targetFees) || 0)} />
            </div>

            {/* Recurring */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Recurring Templates</h3>
              {recurringDrafts.map((d) => (
                <ReviewRow
                  key={d.category}
                  label={d.category}
                  value={`${formatINR(parseFloat(d.amount) || 0)} / ${d.interval}`}
                />
              ))}
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(2)} className="flex-1">
                ← Back
              </Button>
              <Button onClick={handleFinish} disabled={saving} className="flex-1 gap-1.5">
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                🚀 Start Tracking
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded bg-muted/50 px-3 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono font-medium">{value}</span>
    </div>
  );
}
