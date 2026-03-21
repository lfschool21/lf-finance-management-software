import {
  Settings2,
  User,
  Landmark,
  GraduationCap,
  Repeat,
  Tag,
  Palette,
  Database,
  Info,
  Moon,
  Sun,
  Shield,
  Trash2,
} from 'lucide-react';
import { useFinanceStore } from '@/store/finance-store';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

const SECTIONS = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'accounts', label: 'Accounts', icon: Landmark },
  { id: 'academic', label: 'Academic Years', icon: GraduationCap },
  { id: 'recurring', label: 'Recurring Expenses', icon: Repeat },
  { id: 'categories', label: 'Categories', icon: Tag },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'data', label: 'Data & Backup', icon: Database },
  { id: 'about', label: 'About', icon: Info },
];

export default function SettingsPage() {
  const { isDarkMode, toggleDarkMode, accounts, academicYears } = useFinanceStore();

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
              <p className="text-sm font-medium">admin@littleflowers.school</p>
            </div>
            <Button size="sm" variant="outline">
              <Shield className="mr-1.5 h-3.5 w-3.5" />
              Change Password
            </Button>
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
                <Button size="sm" variant="ghost" className="h-7 text-xs">
                  Edit
                </Button>
              </div>
            ))}
            <Button size="sm" variant="outline" className="w-full">
              + Add Account
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
                  <p className="text-xs text-muted-foreground capitalize">{y.status.replace('_', ' ')}</p>
                </div>
                <Button size="sm" variant="ghost" className="h-7 text-xs">
                  Edit
                </Button>
              </div>
            ))}
            <Button size="sm" variant="outline" className="w-full">
              + Set Up New Year
            </Button>
          </div>
        </SettingsCard>

        {/* Data */}
        <SettingsCard icon={Database} title="Data & Backup">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Auto-Backup</p>
                <p className="text-xs text-muted-foreground">Weekly encrypted backup</p>
              </div>
              <span className="text-xs text-income">✅ Active</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline">Create Backup Now</Button>
              <Button size="sm" variant="outline">Restore from Backup</Button>
              <Button size="sm" variant="outline">Export All Data</Button>
            </div>
            <div className="border-t pt-3">
              <Button size="sm" variant="destructive" className="gap-1.5">
                <Trash2 className="h-3.5 w-3.5" />
                Wipe All Data
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
            <div className="flex justify-between"><span className="text-muted-foreground">Last Sync</span><span>Demo Mode</span></div>
          </div>
        </SettingsCard>
      </div>
    </div>
  );
}

function SettingsCard({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Settings2;
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
