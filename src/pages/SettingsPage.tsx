import { useState } from 'react';
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
import { useNavigate } from 'react-router-dom';
import { useFinanceStore } from '@/store/finance-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import type { RecurringTemplate } from '@/types/finance';

export default function SettingsPage() {
  const navigate = useNavigate();
  const {
    isDarkMode, toggleDarkMode, accounts, academicYears, recurringTemplates,
    refreshAccounts, refreshAcademicYears, refreshRecurringTemplates, init,
  } = useFinanceStore();

  // Password change
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
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

  const [userEmail, setUserEmail] = useState('');
  useState(() => {
    getCurrentUser().then((u) => { if (u?.email) setUserEmail(u.email); });
  });

  // Password
  async function handleChangePassword() {
    if (newPassword.length < 8) { toast({ title: 'Password must be at least 8 characters', variant: 'destructive' }); return; }
    if (newPassword !== confirmPassword) { toast({ title: 'Passwords do not match', variant: 'destructive' }); return; }
    setPwLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPwLoading(false);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: '✅ Password updated' });
    setShowPasswordModal(false);
    setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
  }

  // Account
  function openAccountAdd() {
    setEditAccountId(null); setAccName(''); setAccType('personal_bank'); setAccBalance('');
    setShowAccountModal(true);
  }
  function openAccountEdit(id: string) {
    const acc = accounts.find((a) => a.id === id);
    if (!acc) return;
    setEditAccountId(id); setAccName(acc.name); setAccType(acc.type); setAccBalance(acc.startingBalance.toString());
    setShowAccountModal(true);
  }
  async function saveAccount() {
    if (!accName.trim()) { toast({ title: 'Name required', variant: 'destructive' }); return; }
    setAccSaving(true);
    if (editAccountId) {
      await accountsService.update(editAccountId, { name: accName, type: accType, starting_balance: parseFloat(accBalance) || 0 });
    } else {
      await accountsService.create({ name: accName, type: accType, starting_balance: parseFloat(accBalance) || 0, is_archived: false });
    }
    await refreshAccounts();
    setAccSaving(false); setShowAccountModal(false);
    toast({ title: editAccountId ? '✅ Account updated' : '✅ Account added' });
  }
  async function archiveAccount(id: string) {
    await accountsService.archive(id);
    await refreshAccounts();
    toast({ title: 'Account archived' });
  }

  // Academic Year
  function openYearAdd() {
    setEditYearId(null); setYearLabel(''); setYearStart(''); setYearEnd(''); setYearTarget('');
    setShowYearModal(true);
  }
  function openYearEdit(id: string) {
    const y = academicYears.find((yr) => yr.id === id);
    if (!y) return;
    setEditYearId(id); setYearLabel(y.label);
    setYearStart(y.startDate.toISOString().split('T')[0]);
    setYearEnd(y.endDate.toISOString().split('T')[0]);
    setYearTarget(y.targetTuitionFees.toString());
    setShowYearModal(true);
  }
  async function saveYear() {
    if (!yearLabel.trim()) { toast({ title: 'Label required', variant: 'destructive' }); return; }
    setYearSaving(true);
    if (editYearId) {
      await academicYearsService.update(editYearId, {
        label: yearLabel, start_date: yearStart, end_date: yearEnd,
        target_tuition_fees: parseFloat(yearTarget) || 0,
      });
    } else {
      await academicYearsService.create({
        label: yearLabel, start_date: yearStart, end_date: yearEnd,
        target_tuition_fees: parseFloat(yearTarget) || 0, status: 'active',
      });
    }
    await refreshAcademicYears();
    setYearSaving(false); setShowYearModal(false);
    toast({ title: editYearId ? '✅ Year updated' : '✅ Year added' });
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
    if (editRecurringId) {
      await recurringService.update(editRecurringId, {
        category: recCategory, default_amount: parseFloat(recAmount) || 0,
        recurrence_interval: recInterval, expense_type: recType,
      });
    } else {
      await recurringService.create({
        category: recCategory, default_amount: parseFloat(recAmount) || 0,
        recurrence_interval: recInterval, expense_type: recType,
        is_active: true, last_generated_date: null,
      });
    }
    await refreshRecurringTemplates();
    setRecSaving(false); setShowRecurringModal(false);
    toast({ title: editRecurringId ? '✅ Template updated' : '✅ Template added' });
  }
  async function toggleRecurringActive(id: string) {
    await recurringService.toggleActive(id);
    await refreshRecurringTemplates();
  }

  // Backup
  async function handleCreateBackup() {
    setBackupLoading(true);
    try {
      const tables = ['academic_years', 'accounts', 'income_entries', 'expense_entries', 'transfers', 'recurring_templates'] as const;
      const backup: Record<string, unknown[]> = {};
      for (const table of tables) {
        const { data } = await supabase.from(table).select('*');
        backup[table] = data || [];
      }
      const json = JSON.stringify({ version: '1.0', date: new Date().toISOString(), data: backup }, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `little-flowers-backup-${new Date().toISOString().split('T')[0]}.lfbackup`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: '✅ Backup created and downloaded' });
    } catch {
      toast({ title: 'Backup failed', variant: 'destructive' });
    }
    setBackupLoading(false);
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
        const backup = JSON.parse(text);
        if (!backup.data) throw new Error('Invalid backup file');

        const counts = Object.entries(backup.data as Record<string, unknown[]>)
          .map(([table, rows]) => `${table}: ${(rows as unknown[]).length} rows`)
          .join(', ');

        if (!confirm(`Restore backup from ${backup.date}?\n\nData: ${counts}\n\nThis will replace ALL current data.`)) {
          setRestoreLoading(false);
          return;
        }

        // Delete existing data
        const tables = ['transfers', 'expense_entries', 'income_entries', 'recurring_templates', 'accounts', 'academic_years'] as const;
        for (const table of tables) {
          await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
        }

        // Restore in order
        const restoreOrder = ['academic_years', 'accounts', 'income_entries', 'expense_entries', 'transfers', 'recurring_templates'] as const;
        for (const table of restoreOrder) {
          const rows = (backup.data as Record<string, unknown[]>)[table];
          if (rows && rows.length > 0) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await supabase.from(table).insert(rows as any);
          }
        }

        await init();
        toast({ title: '✅ Backup restored successfully' });
      } catch (err) {
        toast({ title: 'Restore failed', description: err instanceof Error ? err.message : 'Invalid file', variant: 'destructive' });
      }
      setRestoreLoading(false);
    };
    input.click();
  }

  // Wipe
  async function handleWipe() {
    if (wipeText !== 'DELETE EVERYTHING PERMANENTLY') return;
    setWiping(true);
    try {
      const tables = ['transfers', 'expense_entries', 'income_entries', 'recurring_templates', 'backups_log', 'accounts', 'academic_years'] as const;
      for (const table of tables) {
        await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
      }
      toast({ title: 'All data wiped' });
      setShowWipeConfirm(false);
      navigate('/setup', { replace: true });
    } catch {
      toast({ title: 'Wipe failed', variant: 'destructive' });
    }
    setWiping(false);
  }

  async function handleLogout() {
    await signOut();
    navigate('/login', { replace: true });
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold">Settings</h1>

      <div className="space-y-3">
        {/* Appearance */}
        <SettingsCard icon={Palette} title="Appearance">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Dark Mode</p>
              <p className="text-xs text-muted-foreground">Toggle between light and dark themes</p>
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
              <p className="text-xs text-muted-foreground">Email</p>
              <p className="text-sm font-medium">{userEmail || '—'}</p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setShowPasswordModal(true)}>
                <Shield className="mr-1.5 h-3.5 w-3.5" /> Change Password
              </Button>
              <Button size="sm" variant="outline" onClick={handleLogout} className="gap-1.5">
                <LogOut className="h-3.5 w-3.5" /> Sign Out
              </Button>
            </div>
          </div>
        </SettingsCard>

        {/* Accounts */}
        <SettingsCard icon={Landmark} title="Bank Accounts">
          <div className="space-y-2">
            {accounts.map((acc) => (
              <div key={acc.id} className="flex items-center justify-between rounded-md bg-secondary/50 px-3 py-2">
                <div>
                  <p className="text-sm font-medium">{acc.name}</p>
                  <p className="text-[10px] uppercase text-muted-foreground">{acc.type.replace('_', ' ')}</p>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => openAccountEdit(acc.id)}>Edit</Button>
                  {!acc.isArchived && acc.type !== 'cash' && (
                    <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" onClick={() => archiveAccount(acc.id)}>Archive</Button>
                  )}
                </div>
              </div>
            ))}
            <Button size="sm" variant="outline" className="w-full gap-1" onClick={openAccountAdd}>
              <Plus className="h-3.5 w-3.5" /> Add Account
            </Button>
          </div>
        </SettingsCard>

        {/* Academic Years */}
        <SettingsCard icon={GraduationCap} title="Academic Years">
          <div className="space-y-2">
            {academicYears.map((y) => (
              <div key={y.id} className="flex items-center justify-between rounded-md bg-secondary/50 px-3 py-2">
                <div>
                  <p className="text-sm font-medium">AY {y.label}</p>
                  <p className="text-xs text-muted-foreground">Target: {formatINR(y.targetTuitionFees)} • {y.status.replace('_', ' ')}</p>
                </div>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => openYearEdit(y.id)}>Edit</Button>
              </div>
            ))}
            <Button size="sm" variant="outline" className="w-full gap-1" onClick={openYearAdd}>
              <Plus className="h-3.5 w-3.5" /> Add Year
            </Button>
          </div>
        </SettingsCard>

        {/* Recurring */}
        <SettingsCard icon={Repeat} title="Recurring Templates">
          <div className="space-y-2">
            {recurringTemplates.map((t) => (
              <div key={t.id} className="flex items-center justify-between rounded-md bg-secondary/50 px-3 py-2">
                <div>
                  <p className="text-sm font-medium">{t.category}</p>
                  <p className="text-xs text-muted-foreground">{formatINR(t.defaultAmount)} / {t.recurrenceInterval}</p>
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
            <div className="flex flex-wrap gap-2">
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
              <Button size="sm" variant="destructive" className="gap-1.5" onClick={() => setShowWipeConfirm(true)}>
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
            <div className="flex justify-between"><span className="text-muted-foreground">Version</span><span>1.0.0</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Database</span><span className="text-income">Connected</span></div>
          </div>
        </SettingsCard>
      </div>

      {/* Password Modal */}
      <Dialog open={showPasswordModal} onOpenChange={setShowPasswordModal}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Change Password</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input type="password" placeholder="New password (min 8 chars)" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            <Input type="password" placeholder="Confirm new password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
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
            <Input placeholder="Account name" value={accName} onChange={(e) => setAccName(e.target.value)} />
            <Select value={accType} onValueChange={(v) => setAccType(v as typeof accType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="school_bank">School Bank</SelectItem>
                <SelectItem value="personal_bank">Personal Bank</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
              </SelectContent>
            </Select>
            <Input type="number" placeholder="Starting balance (₹)" value={accBalance} onChange={(e) => setAccBalance(e.target.value)} />
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
            <Input placeholder="Label e.g. 2025-26" value={yearLabel} onChange={(e) => setYearLabel(e.target.value)} />
            <Input type="date" value={yearStart} onChange={(e) => setYearStart(e.target.value)} />
            <Input type="date" value={yearEnd} onChange={(e) => setYearEnd(e.target.value)} />
            <Input type="number" placeholder="Target tuition fees (₹)" value={yearTarget} onChange={(e) => setYearTarget(e.target.value)} />
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
            <AlertDialogTitle className="text-destructive">⚠️ Wipe All Data</AlertDialogTitle>
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
    <div className="rounded-lg border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      {children}
    </div>
  );
}
