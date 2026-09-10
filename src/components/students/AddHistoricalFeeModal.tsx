import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFinanceStore } from '@/store/finance-store';
import { useStudentStore } from '@/store/student-store';
import type { Student, StudentEnrollment, StudentMedium } from '@/types/students';
import { parseNonNegativeAmount } from '@/lib/finance-domain';
import { formatINR } from '@/utils/currency';
import { toast } from '@/hooks/use-toast';
import { Loader2, UserCheck, ChevronDown, ChevronUp } from 'lucide-react';

interface AddHistoricalFeeModalProps {
  open: boolean;
  onClose: () => void;
  student: Student;
  existingEnrollments: StudentEnrollment[];
  editingEnrollment?: StudentEnrollment | null;
}

export function AddHistoricalFeeModal({
  open,
  onClose,
  student,
  existingEnrollments,
  editingEnrollment,
}: AddHistoricalFeeModalProps) {
  const { academicYears } = useFinanceStore();
  const { saveStudent } = useStudentStore();

  const [yearId, setYearId] = useState('');
  const [amountLeft, setAmountLeft] = useState('');
  const [className, setClassName] = useState('');
  const [medium, setMedium] = useState<StudentMedium>('english');
  const [notes, setNotes] = useState('');
  const [showOptionalFields, setShowOptionalFields] = useState(false);
  const [saving, setSaving] = useState(false);

  // Available academic years where this student doesn't already have an enrollment record (excluding the one being edited)
  const existingYearIds = new Set(
    existingEnrollments
      .filter((e) => !editingEnrollment || e.id !== editingEnrollment.id)
      .map((e) => e.academicYearId)
  );
  const availableYears = academicYears.filter((y) => !existingYearIds.has(y.id));

  useEffect(() => {
    if (!open) return;

    if (editingEnrollment) {
      setYearId(editingEnrollment.academicYearId);
      setAmountLeft(String(editingEnrollment.annualFeeAmount || ''));
      setClassName(editingEnrollment.className || '');
      setMedium(editingEnrollment.medium || 'english');
      setNotes(editingEnrollment.notes || '');
      setShowOptionalFields(false);
    } else {
      const defaultYear = availableYears[0]?.id || '';
      const fallbackClass = existingEnrollments[0]?.className || 'Previous Year';
      const fallbackMedium = existingEnrollments[0]?.medium || 'english';

      setYearId(defaultYear);
      setAmountLeft('');
      setClassName(fallbackClass);
      setMedium(fallbackMedium);
      setNotes('');
      setShowOptionalFields(false);
    }
  }, [open, editingEnrollment, availableYears.length, existingEnrollments]);

  async function handleSave() {
    const fee = parseNonNegativeAmount(amountLeft);

    if (!yearId) {
      toast({ title: 'Select an academic year', variant: 'destructive' });
      return;
    }
    if (fee === null) {
      toast({ title: 'Enter a valid amount left (₹)', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      await saveStudent(
        {
          id: student.id,
          admission_number: student.admissionNumber || null,
          full_name: student.fullName,
          status: student.status,
          notes: student.notes || null,
        },
        {
          id: editingEnrollment?.id,
          academic_year_id: yearId,
          class_name: className.trim() || existingEnrollments[0]?.className || 'Previous Year',
          medium,
          annual_fee_amount: fee,
          additional_outstanding_amount: 0,
          opening_collected_cash: 0,
          opening_collected_upi: 0,
          opening_collected_other: 0,
          opening_snapshot_date: null,
          status: 'active',
          notes: notes.trim() || null,
        }
      );

      toast({
        title: editingEnrollment
          ? 'Previous-year fee record updated'
          : 'Previous-year fee record added',
        description: `Pending fee balance of ${formatINR(fee)} recorded.`,
      });
      onClose();
    } catch (error) {
      toast({
        title: 'Failed to save previous-year fee',
        description: error instanceof Error ? error.message : 'Database error',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }

  const selectedYear = academicYears.find((y) => y.id === yearId);

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-bold">
            {editingEnrollment ? 'Edit Previous-Year Fee' : 'Add Previous-Year Fee'}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Enter the unpaid fee amount left from a previous academic year. Adding this directly updates pending fee collection across the system.
          </DialogDescription>
        </DialogHeader>

        {/* Read-only Student Context Card */}
        <div className="flex items-center gap-2 rounded-lg border bg-muted/40 p-2.5 text-xs">
          <UserCheck className="h-4 w-4 text-primary shrink-0" />
          <div className="min-w-0">
            <p className="font-semibold text-foreground truncate">{student.fullName}</p>
            <p className="text-muted-foreground text-[11px]">
              Admission: {student.admissionNumber || '—'} · Class: {existingEnrollments[0]?.className || '—'}
            </p>
          </div>
        </div>

        <div className="space-y-4 text-xs pt-1">
          {/* Academic Year Selection */}
          <div>
            <Label htmlFor="historical-year" className="text-xs font-medium">
              Academic Year *
            </Label>
            {editingEnrollment ? (
              <div className="mt-1 h-9 rounded-md border bg-muted/30 px-3 flex items-center text-xs font-medium">
                Academic Year {selectedYear?.label || '—'}
              </div>
            ) : availableYears.length > 0 ? (
              <Select value={yearId} onValueChange={setYearId}>
                <SelectTrigger id="historical-year" className="mt-1 h-9 text-xs">
                  <SelectValue placeholder="Select historical academic year" />
                </SelectTrigger>
                <SelectContent>
                  {availableYears.map((y) => (
                    <SelectItem key={y.id} value={y.id} className="text-xs">
                      Academic Year {y.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="mt-1 text-[11px] text-muted-foreground">
                All configured academic years already have records for this student.
              </p>
            )}
          </div>

          {/* Pending Fee Left (Primary Input) */}
          <div>
            <div className="flex items-center justify-between">
              <Label htmlFor="hist-amount-left" className="text-xs font-semibold text-foreground">
                Pending Fee Left (₹) *
              </Label>
              {amountLeft && !isNaN(Number(amountLeft)) && (
                <span className="font-mono text-xs font-semibold text-warning font-mono-nums">
                  {formatINR(Number(amountLeft))}
                </span>
              )}
            </div>
            <Input
              id="hist-amount-left"
              type="number"
              min="0"
              step="any"
              placeholder="e.g. 5000"
              value={amountLeft}
              onChange={(e) => setAmountLeft(e.target.value)}
              className="mt-1 h-10 text-sm font-mono font-medium"
              autoFocus
            />
            <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">
              How much is still left to pay for this year. This will directly reflect in total fees to collect on the dashboard.
            </p>
          </div>

          {/* Optional Class / Medium / Notes Toggle */}
          <div className="border-t pt-2">
            <button
              type="button"
              onClick={() => setShowOptionalFields((prev) => !prev)}
              className="flex items-center justify-between w-full text-xs font-medium text-muted-foreground hover:text-foreground py-1 transition-colors"
            >
              <span>Optional Class & Notes</span>
              {showOptionalFields ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>

            {showOptionalFields && (
              <div className="mt-2 space-y-3 pl-0.5 animate-fade-in">
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <Label htmlFor="hist-class" className="text-xs text-muted-foreground">Previous Class</Label>
                    <Input
                      id="hist-class"
                      placeholder="e.g. Class 4"
                      value={className}
                      onChange={(e) => setClassName(e.target.value)}
                      className="mt-1 h-8 text-xs"
                    />
                  </div>

                  <div>
                    <Label htmlFor="hist-medium" className="text-xs text-muted-foreground">Medium</Label>
                    <Select value={medium} onValueChange={(v) => setMedium(v as StudentMedium)}>
                      <SelectTrigger id="hist-medium" className="mt-1 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="english" className="text-xs">English</SelectItem>
                        <SelectItem value="gujarati" className="text-xs">Gujarati</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="hist-notes" className="text-xs text-muted-foreground">Notes (optional)</Label>
                  <Textarea
                    id="hist-notes"
                    rows={2}
                    placeholder="e.g. Unpaid fees from previous session"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="mt-1 text-xs"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Actions */}
        <div className="mt-4 flex justify-end gap-2 pt-2 border-t">
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving} className="text-xs">
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving || (!editingEnrollment && availableYears.length === 0)}
            className="text-xs gap-1.5"
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            <span>{editingEnrollment ? 'Update Fee Record' : 'Save Fee Record'}</span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
