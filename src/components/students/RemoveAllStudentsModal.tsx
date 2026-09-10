import React, { useState } from 'react';
import { AlertTriangle, Trash2, Loader2, Calendar, Users } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { useStudentStore } from '@/store/student-store';
import { useFinanceStore } from '@/store/finance-store';
import { toast } from '@/hooks/use-toast';

interface RemoveAllStudentsModalProps {
  open: boolean;
  onClose: () => void;
  yearId: string;
  yearLabel?: string;
  yearStudentCount: number;
  totalStudentCount: number;
}

export function RemoveAllStudentsModal({
  open,
  onClose,
  yearId,
  yearLabel,
  yearStudentCount,
  totalStudentCount,
}: RemoveAllStudentsModalProps) {
  const { removeAllStudents } = useStudentStore();
  const [scope, setScope] = useState<'year' | 'all'>('year');
  const [deletePayments, setDeletePayments] = useState(false);
  const [confirmInput, setConfirmInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset local state whenever modal opens/closes
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setConfirmInput('');
      setDeletePayments(false);
      setScope('year');
      onClose();
    }
  };

  const isConfirmed = confirmInput.trim().toUpperCase() === 'REMOVE';

  const handleRemove = async () => {
    if (!isConfirmed) return;

    setIsSubmitting(true);
    try {
      const options = {
        academicYearId: scope === 'year' ? yearId : undefined,
        deletePayments,
      };

      const result = await removeAllStudents(options);

      // Refresh finance store to reflect unlinked / deleted fee records
      await useFinanceStore.getState().init(true);

      const targetLabel = scope === 'year' ? `for AY ${yearLabel || 'this year'}` : 'across all years';
      toast({
        title: 'Students removed',
        description: `Successfully removed ${result.removedEnrollments} enrollment(s) and ${result.removedStudents} student record(s) ${targetLabel}.`,
      });

      handleOpenChange(false);
    } catch (err) {
      toast({
        title: 'Removal failed',
        description: err instanceof Error ? err.message : 'Database error while removing students',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const countToRemove = scope === 'year' ? yearStudentCount : totalStudentCount;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md p-6">
        <DialogHeader className="space-y-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <Trash2 className="h-6 w-6" />
          </div>
          <div>
            <DialogTitle className="text-xl font-bold tracking-tight text-foreground">
              Remove All Students
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              Bulk remove student records and rosters. This action is permanent and cannot be undone.
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Scope Selector */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Removal Scope
            </Label>
            <RadioGroup
              value={scope}
              onValueChange={(val) => setScope(val as 'year' | 'all')}
              className="grid gap-2.5"
            >
              {/* Scope: Current Academic Year */}
              <label
                htmlFor="scope-year"
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3.5 transition-colors ${
                  scope === 'year'
                    ? 'border-destructive/60 bg-destructive/5 ring-1 ring-destructive/40'
                    : 'border-border bg-card hover:bg-accent/40'
                }`}
              >
                <RadioGroupItem value="year" id="scope-year" className="mt-1" />
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                      AY {yearLabel || 'Current Year'} Only
                    </span>
                    <Badge variant="outline" className="text-[11px] font-mono">
                      {yearStudentCount} students
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Removes all student enrollments for AY {yearLabel}. Student profiles without other years will also be removed.
                  </p>
                </div>
              </label>

              {/* Scope: All Students Across All Years */}
              <label
                htmlFor="scope-all"
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3.5 transition-colors ${
                  scope === 'all'
                    ? 'border-destructive/60 bg-destructive/5 ring-1 ring-destructive/40'
                    : 'border-border bg-card hover:bg-accent/40'
                }`}
              >
                <RadioGroupItem value="all" id="scope-all" className="mt-1" />
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5 text-muted-foreground" />
                      All Students (Entire Database)
                    </span>
                    <Badge variant="destructive" className="text-[11px] font-mono">
                      {totalStudentCount} students
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Completely clears all students and enrollments across all academic years from the system.
                  </p>
                </div>
              </label>
            </RadioGroup>
          </div>

          {/* Fee Payments Handling */}
          <div className="rounded-lg border bg-muted/30 p-3.5 space-y-2">
            <div className="flex items-start gap-2.5">
              <Checkbox
                id="delete-payments"
                checked={deletePayments}
                onCheckedChange={(checked) => setDeletePayments(Boolean(checked))}
                className="mt-0.5"
              />
              <div className="grid gap-1">
                <Label htmlFor="delete-payments" className="text-xs font-medium cursor-pointer">
                  Also delete linked fee payment transactions
                </Label>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {deletePayments
                    ? 'Recorded income entries linked to these students will be deleted from your finance ledger.'
                    : 'Safe default: Finance ledger entries are unlinked from students, keeping your bank & cash balances intact.'}
                </p>
              </div>
            </div>
          </div>

          {/* Type Confirmation */}
          <div className="space-y-1.5">
            <Label htmlFor="confirm-remove" className="text-xs font-medium text-foreground">
              Type <strong className="text-destructive font-mono font-bold">REMOVE</strong> to confirm
            </Label>
            <Input
              id="confirm-remove"
              placeholder="Type REMOVE to confirm"
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              className="h-9 text-xs font-mono"
              autoComplete="off"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleOpenChange(false)}
            disabled={isSubmitting}
            className="text-xs"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={handleRemove}
            disabled={!isConfirmed || isSubmitting || countToRemove === 0}
            className="text-xs gap-1.5"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Removing {countToRemove} students...</span>
              </>
            ) : (
              <>
                <Trash2 className="h-3.5 w-3.5" />
                <span>Remove All Students ({countToRemove})</span>
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
