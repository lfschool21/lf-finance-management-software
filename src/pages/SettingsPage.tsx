import { useEffect, useState } from 'react';
import {
  User,
  Landmark,
  GraduationCap,
  Repeat,
  Palette,
  Database,
  Info,
  Moon,
  Sun,
  Shield,
  Trash2,
  Plus,
  Loader2,
  Download,
  Upload,
  LogOut,
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { useNavigate } from 'react-router-dom';
import { useFinanceStore } from '@/store/finance-store';
import { useTranslation } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatINR } from '@/utils/currency';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/services/supabase';
import * as accountsService from '@/services/accounts';
import * as academicYearsService from '@/services/academicYears';
import * as recurringService from '@/services/recurring';
import { signOut, getCurrentUser } from '@/services/auth';
import { isDemoUser } from '@/lib/demo-mode';
import { exitDemo } from '@/services/demo';
import type { RecurringTemplate } from '@/types/finance';
import { parseNonNegativeAmount, parseStrictNumber } from '@/lib/finance-domain';
import { parseFinanceBackup } from '@/lib/finance-backup';
import type { Json } from '@/integrations/supabase/types';

export default function SettingsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const {
    isDarkMode, toggleDarkMode, accounts, academicYears, recurringTemplates,
    refreshAccounts, refreshAcademicYears, refreshRecurringTemplates, init,
    getAccountBalance, getPendingForYear,
  } = useFinanceStore();

  // Password change
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwLoading, setPwLoading] = useState(false);

  // Account management
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [editAccountId, setEditAccountId] = useState<string | null>(null);
  const [accName, setAccName] = useState('');
  const [accType, setAccType] = useState<'school_bank' | 'personal_bank' | 'cash'>('personal_bank');
  const [accBalance, setAccBalance] = useState('');
  const [accSaving, setAccSaving] = useState(false);

  // Academic year management
  const [showYearModal, setShowYearModal] = useState(false);
  const [editYearId, setEditYearId] = useState<string | null>(null);
  const [yearLabel, setYearLabel] = useState('');
  const [yearStart, setYearStart] = useState('');
  const [yearEnd, setYearEnd] = useState('');
  const [yearTarget, setYearTarget] = useState('');
  const [yearCarry, setYearCarry] = useState('');
  const [yearSaving, setYearSaving] = useState(false);

  // Recurring
  const [showRecurringModal, setShowRecurringModal] = useState(false);
  const [editRecurringId, setEditRecurringId] = useState<string | null>(null);
  const [recCategory, setRecCategory] = useState('');
  const [recAmount, setRecAmount] = useState('');
  const [recInterval, setRecInterval] = useState<'monthly' | 'bimonthly' | 'quarterly'>('monthly');
  const [recType, setRecType] = useState<'school' | 'home'>('school');
  const [recSaving, setRecSaving] = useState(false);

  // Wipe
  const [showWipeConfirm, setShowWipeConfirm] = useState(false);
  const [wipeText, setWipeText] = useState('');
  const [wiping, setWiping] = useState(false);

  // Backup
  const [backupLoading, setBackupLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [restoreConfirm, setRestoreConfirm] = useState<{ date: string; counts: string; execute: () => Promise<void> } | null>(null);

  const [userEmail, setUserEmail] = useState('');
  const [isDemo, setIsDemo] = useState(false);

  useEffect(() => {
    getCurrentUser().then((u) => {
      if (u?.email) setUserEmail(u.email);
      setIsDemo(isDemoUser(u));
    });
  }, []);

  function handleOpenPasswordModal() {
    if (isDemo) {
      toast({
        title: 'Demo Session',
        description: 'Password management is available after creating a permanent account.',
      });
      return;
    }
    setShowPasswordModal(true);
  }

  // Password
  async function handleChangePassword() {
    if (newPassword.length < 8) { toast({ title: 'Password must be at least 8 characters', variant: 'destructive' }); return; }
    if (newPassword !== confirmPassword) { toast({ title: 'Passwords do not match', variant: 'destructive' }); return; }
    setPwLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPwLoading(false);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Password updated' });
    setShowPasswordModal(false);
    setNewPassword(''); setConfirmPassword('');
  }

  // Account
  function openAccountAdd() {
    setEditAccountId(null); setAccName(''); setAccType('personal_bank'); setAccBalance('');
    setShowAccountModal(true);
  }
  function openAccountEdit(id: string) {
    const acc = accounts.find((a) => a.id === id);
    if (!acc) return;
    setEditAccountId(id); setAccName(acc.name); setAccType(acc.type); setAccBalance(getAccountBalance(id).toString());
    setShowAccountModal(true);
  }
  async function saveAccount() {
    if (!accName.trim()) { toast({ title: 'Name required', variant: 'destructive' }); return; }
    const balance = parseStrictNumber(accBalance);
    if (balance === null) { toast({ title: 'Enter a valid finite balance', variant: 'destructive' }); return; }
    setAccSaving(true);
    try {
      const result = editAccountId
        ? await accountsService.setCurrentBalance(editAccountId, {
            name: accName, type: accType, currentBalance: balance,
          })
        : await accountsService.create({ name: accName, type: accType, starting_balance: balance, is_archived: false });
      if (result.error) throw result.error;
      await refreshAccounts();
      setShowAccountModal(false);
      toast({ title: editAccountId ? 'Account updated' : 'Account added' });
    } catch (err) {
      toast({ title: 'Account save failed', description: err instanceof Error ? err.message : 'Database error', variant: 'destructive' });
    } finally {
      setAccSaving(false);
    }
  }
  async function archiveAccount(id: string) {
    const balance = getAccountBalance(id);
    if (Math.abs(balance) > 0.000001) {
      toast({ title: 'Account cannot be archived', description: `Move or reconcile the remaining ${formatINR(balance)} first.`, variant: 'destructive' });
      return;
    }
    const { error } = await accountsService.archive(id);
    if (error) { toast({ title: 'Archive failed', description: error.message, variant: 'destructive' }); return; }
    await refreshAccounts();
    toast({ title: 'Account archived' });
  }
  async function unarchiveAccount(id: string) {
    const { error } = await accountsService.unarchive(id);
    if (error) { toast({ title: 'Unarchive failed', description: error.message, variant: 'destructive' }); return; }
    await refreshAccounts();
    toast({ title: 'Account restored' });
  }

  // Academic Year
  function openYearAdd() {
    setEditYearId(null); setYearLabel(''); setYearStart(''); setYearEnd(''); setYearTarget(''); setYearCarry('');
    setShowYearModal(true);
  }
  function openYearEdit(id: string) {
    const y = academicYears.find((yr) => yr.id === id);
    if (!y) return;
    setEditYearId(id); setYearLabel(y.label);
    setYearStart(y.startDate.toISOString().split('T')[0]);
    setYearEnd(y.endDate.toISOString().split('T')[0]);
    setYearTarget(y.targetTuitionFees.toString());
    setYearCarry((y.carryForwardFees || 0) > 0 ? (y.carryForwardFees || 0).toString() : '');
    setShowYearModal(true);
  }
  async function saveYear() {
    if (!yearLabel.trim()) { toast({ title: 'Label required', variant: 'destructive' }); return; }
    const target = parseNonNegativeAmount(yearTarget || '0');
    const carry = parseNonNegativeAmount(yearCarry || '0');
    if (!yearStart || !yearEnd || yearStart > yearEnd || target === null || carry === null) {
      toast({ title: 'Enter valid dates and non-negative amounts', variant: 'destructive' }); return;
    }
    setYearSaving(true);
    try {
      const result = editYearId ? await academicYearsService.update(editYearId, {
        label: yearLabel, start_date: yearStart, end_date: yearEnd,
        target_tuition_fees: target,
        carry_forward_fees: carry,
      }) : await academicYearsService.create({
        label: yearLabel, start_date: yearStart, end_date: yearEnd,
        target_tuition_fees: target,
        carry_forward_fees: carry,
        status: 'active',
      });
      if (result.error) throw result.error;
      await refreshAcademicYears();
      setShowYearModal(false);
      toast({ title: editYearId ? 'Year updated' : 'Year added' });
    } catch (err) {
      toast({ title: 'Academic year save failed', description: err instanceof Error ? err.message : 'Database error', variant: 'destructive' });
    } finally {
      setYearSaving(false);
    }
  }

  // Recurring
  function openRecurringAdd() {
    setEditRecurringId(null); setRecCategory(''); setRecAmount(''); setRecInterval('monthly'); setRecType('school');
    setShowRecurringModal(true);
  }
  function openRecurringEdit(t: RecurringTemplate) {
    setEditRecurringId(t.id); setRecCategory(t.category); setRecAmount(t.defaultAmount.toString());
    setRecInterval(t.recurrenceInterval); setRecType(t.expenseType);
    setShowRecurringModal(true);
  }
  async function saveRecurring() {
    if (!recCategory.trim()) { toast({ title: 'Category required', variant: 'destructive' }); return; }
    setRecSaving(true);
    const amount = parseNonNegativeAmount(recAmount || '0');
    if (amount === null) { toast({ title: 'Enter a non-negative default amount', variant: 'destructive' }); return; }
    try {
      const result = editRecurringId ? await recurringService.update(editRecurringId, {
        category: recCategory, default_amount: amount,
        recurrence_interval: recInterval, expense_type: recType,
      }) : await recurringService.create({
        category: recCategory, default_amount: amount,
        recurrence_interval: recInterval, expense_type: recType,
        is_active: true, last_generated_date: null,
      });
      if (result.error) throw result.error;
      await refreshRecurringTemplates();
      setShowRecurringModal(false);
      toast({ title: editRecurringId ? 'Template updated' : 'Template added' });
    } catch (err) {
      toast({ title: 'Template save failed', description: err instanceof Error ? err.message : 'Database error', variant: 'destructive' });
    } finally {
      setRecSaving(false);
    }
  }
  async function toggleRecurringActive(id: string) {
    const { error } = await recurringService.toggleActive(id);
    if (error) { toast({ title: 'Update failed', description: error.message, variant: 'destructive' }); return; }
    await refreshRecurringTemplates();
  }

  // Backup
  async function handleCreateBackup() {
    setBackupLoading(true);
    try {
      const tables = ['academic_years', 'accounts', 'income_entries', 'expense_entries', 'transfers', 'recurring_templates', 'recoverables', 'recoverable_repayments', 'students', 'student_enrollments'] as const;
      const backup: Record<string, unknown[]> = {};
      for (const table of tables) {
        const { data, error } = await supabase.from(table).select('*');
        if (error) throw error;
        backup[table] = data || [];
      }
      const json = JSON.stringify({ version: '3.0', date: new Date().toISOString(), data: backup }, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `little-flowers-backup-${new Date().toISOString().split('T')[0]}.lfbackup`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: 'Backup created and downloaded' });
    } catch (err) {
      toast({ title: 'Backup failed', description: err instanceof Error ? err.message : 'Database error', variant: 'destructive' });
    } finally {
      setBackupLoading(false);
    }
  }

  async function handleRestoreBackup() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.lfbackup,.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      setRestoreLoading(true);
      try {
        const text = await file.text();
        const backup = parseFinanceBackup(JSON.parse(text));

        const counts = Object.entries(backup.data)
          .map(([table, rows]) => `${table}: ${rows.length} rows`)
          .join(', ');

        setRestoreConfirm({
          date: backup.date,
          counts,
          execute: async () => {
            const { error } = await supabase.rpc('restore_finance_backup', { p_backup: backup as unknown as Json });
            if (error) throw error;
            await init();
            toast({ title: 'Backup restored successfully' });
          },
        });
      } catch (err) {
        toast({ title: 'Restore failed', description: err instanceof Error ? err.message : 'Invalid file', variant: 'destructive' });
      }
      setRestoreLoading(false);
    };
    input.click();
  }

  async function executeRestore() {
    if (!restoreConfirm) return;
    setRestoreLoading(true);
    try {
      await restoreConfirm.execute();
    } catch (err) {
      toast({ title: 'Restore failed', description: err instanceof Error ? err.message : 'Database error', variant: 'destructive' });
    } finally {
      setRestoreLoading(false);
      setRestoreConfirm(null);
    }
  }

  // Wipe
  async function handleWipe() {
    if (wipeText !== 'DELETE EVERYTHING PERMANENTLY') return;
    setWiping(true);
    try {
      const { error } = await supabase.rpc('wipe_finance_data');
      if (error) throw error;
      await init();
      toast({ title: 'All data wiped' });
      setShowWipeConfirm(false);
      navigate('/setup', { replace: true });
    } catch (err) {
      toast({ title: 'Wipe failed', description: err instanceof Error ? err.message : 'Database error', variant: 'destructive' });
    } finally {
      setWiping(false);
    }
  }

  async function handleLogout() {
    if (isDemo) {
      await exitDemo();
      navigate('/login', { replace: true });
      return;
    }
    const { error } = await signOut();
    if (error) { toast({ title: 'Sign out failed', description: error.message, variant: 'destructive' }); return; }
    navigate('/login', { replace: true });
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title={t('settingsTitle')} />

      <div className="space-y-3">
        {/* Appearance */}
        <SettingsCard icon={Palette} title={t('themeAppearance')}>
          <div className="flex flex-col gap-3 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-medium">{t('darkMode')}</p>
              <p className="text-fit text-xs text-muted-foreground">Toggle between light and dark themes</p>
            </div>
            <div className="flex items-center gap-2">
              <Sun className="h-4 w-4 text-muted-foreground" />
              <Switch checked={isDarkMode} onCheckedChange={toggleDarkMode} />
              <Moon className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>
        </SettingsCard>

        {/* Profile */}
        <SettingsCard icon={User} title="Profile">
          <div className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground">{isDemo ? 'Account Type' : 'Email'}</p>
              <p className="text-fit text-sm font-medium">
                {isDemo ? 'Demo Visitor (Temporary workspace)' : (userEmail || '—')}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-2">
              <Button size="sm" variant="outline" onClick={handleOpenPasswordModal}>
                <Shield className="mr-1.5 h-3.5 w-3.5" /> Change Password
              </Button>
              <Button size="sm" variant="outline" onClick={handleLogout} className="gap-1.5">
                <LogOut className="h-3.5 w-3.5" /> {isDemo ? 'Exit Demo' : 'Sign Out'}
              </Button>
            </div>
          </div>
        </SettingsCard>

        {/* Accounts */}
        <SettingsCard icon={Landmark} title={t('manageAccounts')}>
          <div className="space-y-2">
            {accounts.map((acc) => (
              <div key={acc.id} className="flex flex-col gap-2 rounded-md bg-secondary/50 px-3 py-2 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between">
                <div className="min-w-0">
                  <p className="text-fit text-sm font-medium">{acc.name}</p>
                  <p className="text-[10px] uppercase text-muted-foreground">{acc.type.replace('_', ' ')}</p>
                </div>
                <div className="flex flex-wrap gap-1">
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => openAccountEdit(acc.id)}>{t('actionEdit')}</Button>
                  {!acc.isArchived && acc.type !== 'cash' && (
                    <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" onClick={() => archiveAccount(acc.id)}>Archive</Button>
                  )}
                  {acc.isArchived && (
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => unarchiveAccount(acc.id)}>Unarchive</Button>
                  )}
                </div>
              </div>
            ))}
            <Button size="sm" variant="outline" className="w-full gap-1" onClick={openAccountAdd}>
              <Plus className="h-3.5 w-3.5" /> {t('addAccount')}
            </Button>
          </div>
        </SettingsCard>

        {/* Academic Years */}
        <SettingsCard icon={GraduationCap} title={t('manageAcademicYears')}>
          <div className="space-y-2">
            {academicYears.map((y) => (
              <div key={y.id} className="flex flex-col gap-2 rounded-md bg-secondary/50 px-3 py-2 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium">AY {y.label}</p>
                  <p className="text-fit text-xs text-muted-foreground">Tuition target: {formatINR(y.targetTuitionFees)} • {y.status.replace('_', ' ')}</p>
                  {(y.carryForwardFees || 0) > 0 && <p className="text-fit text-xs text-muted-foreground">Last year's pending balance: {formatINR(y.carryForwardFees || 0)}</p>}
                  {getPendingForYear(y.id).remaining > 0 && <p className="text-fit text-xs font-medium text-warning">Current outstanding: {formatINR(getPendingForYear(y.id).remaining)}</p>}
                </div>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => openYearEdit(y.id)}>{t('actionEdit')}</Button>
              </div>
            ))}
            <Button size="sm" variant="outline" className="w-full gap-1" onClick={openYearAdd}>
              <Plus className="h-3.5 w-3.5" /> {t('academicYearPrefix')} {t('actionAdd')}
            </Button>
          </div>
        </SettingsCard>

        {/* Recurring */}
        <SettingsCard icon={Repeat} title={t('manageRecurringExpenses')}>
          <div className="space-y-2">
            {recurringTemplates.map((t) => (
              <div key={t.id} className="flex flex-col gap-2 rounded-md bg-secondary/50 px-3 py-2 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between">
                <div className="min-w-0">
                  <p className="text-fit text-sm font-medium">{t.category}</p>
                  <p className="money-fit text-xs text-muted-foreground">{formatINR(t.defaultAmount)} / {t.recurrenceInterval}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={t.isActive} onCheckedChange={() => toggleRecurringActive(t.id)} />
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => openRecurringEdit(t)}>Edit</Button>
                </div>
              </div>
            ))}
            <Button size="sm" variant="outline" className="w-full gap-1" onClick={openRecurringAdd}>
              <Plus className="h-3.5 w-3.5" /> Add Template
            </Button>
          </div>
        </SettingsCard>

        {/* Data & Backup */}
        <SettingsCard icon={Database} title="Data & Backup">
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
              <Button size="sm" variant="outline" onClick={handleCreateBackup} disabled={backupLoading} className="gap-1.5">
                {backupLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                Create Backup
              </Button>
              <Button size="sm" variant="outline" onClick={handleRestoreBackup} disabled={restoreLoading} className="gap-1.5">
                {restoreLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                Restore from Backup
              </Button>
            </div>
            <div className="border-t pt-3">
              <Button size="sm" variant="destructive" className="w-full gap-1.5 min-[420px]:w-auto" onClick={() => setShowWipeConfirm(true)}>
                <Trash2 className="h-3.5 w-3.5" /> Wipe All Data
              </Button>
              <p className="mt-1 text-[10px] text-muted-foreground">
                Requires typing "DELETE EVERYTHING PERMANENTLY" to confirm
              </p>
            </div>
          </div>
        </SettingsCard>

        {/* About */}
        <SettingsCard icon={Info} title="About">
          <div className="space-y-1 text-sm">
            <div className="flex justify-between gap-3"><span className="text-muted-foreground">Version</span><span>1.0.0</span></div>
            <div className="flex justify-between gap-3"><span className="text-muted-foreground">Database</span><span className="text-income">Connected</span></div>
          </div>
        </SettingsCard>
      </div>

      {/* Password Modal */}
      <Dialog open={showPasswordModal} onOpenChange={setShowPasswordModal}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Change Password</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="new-password">New Password</Label>
              <Input id="new-password" type="password" placeholder="Min 8 characters" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="confirm-password">Confirm New Password</Label>
              <Input id="confirm-password" type="password" placeholder="Re-enter new password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            </div>
            <Button onClick={handleChangePassword} disabled={pwLoading} className="w-full">
              {pwLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Update Password
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Account Modal */}
      <Dialog open={showAccountModal} onOpenChange={setShowAccountModal}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>{editAccountId ? 'Edit Account' : 'Add Account'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="acc-name">Account Name</Label>
              <Input id="acc-name" placeholder="e.g. HDFC Main, Cash Drawer" value={accName} onChange={(e) => setAccName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="acc-type">Account Type</Label>
              <Select value={accType} onValueChange={(v) => setAccType(v as typeof accType)}>
                <SelectTrigger id="acc-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="school_bank">School Bank</SelectItem>
                  <SelectItem value="personal_bank">Personal Bank</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="acc-balance">{editAccountId ? 'Current Balance (₹)' : 'Opening Balance (₹)'}</Label>
              <Input id="acc-balance" type="number" placeholder="0" value={accBalance} onChange={(e) => setAccBalance(e.target.value)} />
              <p className="mt-1 text-[11px] text-muted-foreground">
                {editAccountId ? 'Sets the current balance without changing transaction history.' : 'Amount held before recorded transactions.'}
              </p>
            </div>
            <Button onClick={saveAccount} disabled={accSaving} className="w-full">
              {accSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {editAccountId ? 'Update' : 'Add'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Year Modal */}
      <Dialog open={showYearModal} onOpenChange={setShowYearModal}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>{editYearId ? 'Edit Academic Year' : 'Add Academic Year'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label htmlFor="year-label">Academic Year Name</Label><Input id="year-label" placeholder="e.g. 2025-26" value={yearLabel} onChange={(e) => setYearLabel(e.target.value)} /></div>
            <div><Label htmlFor="year-start">Start Date</Label><Input id="year-start" type="date" value={yearStart} onChange={(e) => setYearStart(e.target.value)} /></div>
            <div><Label htmlFor="year-end">End Date</Label><Input id="year-end" type="date" value={yearEnd} onChange={(e) => setYearEnd(e.target.value)} /></div>
            <div><Label htmlFor="year-target">Current-Year Tuition Target (₹)</Label><Input id="year-target" type="number" placeholder="Enter target" value={yearTarget} onChange={(e) => setYearTarget(e.target.value)} /></div>
            <div>
              <Label htmlFor="year-additional-balance">Last Year's Pending Fee Balance (₹)</Label>
              <Input id="year-additional-balance" type="number" placeholder="Optional" value={yearCarry} onChange={(e) => setYearCarry(e.target.value)} />
              <p className="mt-1 text-[11px] text-muted-foreground">Unpaid fees belonging to this academic year that are not already included in its tuition target. Do not enter the same balance under another year.</p>
            </div>
            <Button onClick={saveYear} disabled={yearSaving} className="w-full">
              {yearSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {editYearId ? 'Update' : 'Add'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Recurring Modal */}
      <Dialog open={showRecurringModal} onOpenChange={setShowRecurringModal}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>{editRecurringId ? 'Edit Template' : 'Add Template'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Category" value={recCategory} onChange={(e) => setRecCategory(e.target.value)} />
            <Select value={recType} onValueChange={(v) => setRecType(v as 'school' | 'home')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="school">School</SelectItem>
                <SelectItem value="home">Home</SelectItem>
              </SelectContent>
            </Select>
            <Input type="number" placeholder="Default amount (₹)" value={recAmount} onChange={(e) => setRecAmount(e.target.value)} />
            <Select value={recInterval} onValueChange={(v) => setRecInterval(v as typeof recInterval)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="bimonthly">Bimonthly</SelectItem>
                <SelectItem value="quarterly">Quarterly</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={saveRecurring} disabled={recSaving} className="w-full">
              {recSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {editRecurringId ? 'Update' : 'Add'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Wipe Confirmation */}
      <AlertDialog open={showWipeConfirm} onOpenChange={setShowWipeConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">Wipe All Data</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete ALL financial data. This cannot be undone.
              <br /><br />
              Type <strong>DELETE EVERYTHING PERMANENTLY</strong> to confirm:
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={wipeText}
            onChange={(e) => setWipeText(e.target.value)}
            placeholder="Type the phrase exactly..."
            className="font-mono"
          />
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setWipeText('')}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleWipe}
              disabled={wipeText !== 'DELETE EVERYTHING PERMANENTLY' || wiping}
              className="bg-destructive text-destructive-foreground"
            >
              {wiping && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Wipe Everything
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Restore Confirmation */}
      <AlertDialog open={!!restoreConfirm} onOpenChange={(open) => { if (!open) setRestoreConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore Backup</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>Restore backup from <strong className="text-foreground">{restoreConfirm?.date}</strong>?</p>
                <p className="rounded bg-muted px-3 py-2 font-mono text-xs">{restoreConfirm?.counts}</p>
                <p className="font-medium text-destructive">This will replace ALL current data.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={restoreLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={executeRestore} disabled={restoreLoading} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {restoreLoading ? 'Restoring...' : 'Yes, Replace All Data'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SettingsCard({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof User;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-lg border bg-card p-4">
      <div className="mb-3 flex min-w-0 items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <h3 className="text-fit text-sm font-semibold">{title}</h3>
      </div>
      {children}
    </div>
  );
}
