import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useFinanceStore } from '@/store/finance-store';
import { useStudentStore } from '@/store/student-store';
import type { Student, StudentEnrollment, StudentMedium } from '@/types/students';
import { parseNonNegativeAmount } from '@/lib/finance-domain';
import { toast } from '@/hooks/use-toast';
import { ChevronDown, ChevronUp, Loader2, Info } from 'lucide-react';
import { getPreviousClassName } from '@/utils/class-progression';

const CLASS_OPTIONS = [
  'Playgroup',
  'Nursery',
  'Junior KG',
  'Senior KG',
  ...Array.from({ length: 12 }, (_, index) => `Class ${index + 1}`),
] as const;

interface AddStudentModalProps {
  open: boolean;
  onClose: () => void;
  student?: Student;
  enrollment?: StudentEnrollment;
  defaultYearId?: string;
  defaultMedium?: StudentMedium;
}

export function AddStudentModal({
  open,
  onClose,
  student,
  enrollment,
  defaultYearId,
  defaultMedium,
}: AddStudentModalProps) {
  const { academicYears, currentYearId, refreshAcademicYears } = useFinanceStore();
  const { enrollments, saveStudent } = useStudentStore();

  const [name, setName] = useState('');
  const [admission, setAdmission] = useState('');
  const [yearId, setYearId] = useState('');
  const [className, setClassName] = useState('');
  const [medium, setMedium] = useState<StudentMedium>(defaultMedium || 'gujarati');
  const [annualFee, setAnnualFee] = useState('');
  const [additional, setAdditional] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Opening payment history
  const [openingCash, setOpeningCash] = useState('');
  const [openingUpi, setOpeningUpi] = useState('');
  const [openingOther, setOpeningOther] = useState('');
  const [showOpeningHistory, setShowOpeningHistory] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(student?.fullName || '');
    setAdmission(student?.admissionNumber || '');
    const activeYearId = enrollment?.academicYearId || defaultYearId || currentYearId;
    setYearId(activeYearId);
    setClassName(enrollment?.className || '');
    // If editing existing enrollment, preserve its stored medium! If new, use contextual default.
    setMedium(enrollment?.medium ?? defaultMedium ?? 'gujarati');
    setAnnualFee(enrollment?.annualFeeAmount !== undefined ? enrollment.annualFeeAmount.toString() : '');

    const targetStudentId = student?.id;
    const existingPrevEnr = targetStudentId
      ? enrollments.find(
          (e) => e.studentId === targetStudentId && e.academicYearId !== activeYearId
        )
      : null;

    const initialAdditional = existingPrevEnr
      ? (existingPrevEnr.annualFeeAmount ? String(existingPrevEnr.annualFeeAmount) : '')
      : (enrollment?.additionalOutstandingAmount !== undefined && enrollment.additionalOutstandingAmount > 0
          ? enrollment.additionalOutstandingAmount.toString()
          : '');
    setAdditional(initialAdditional);

    const hasOpening =
      (enrollment?.openingCollectedCash || 0) > 0 ||
      (enrollment?.openingCollectedUpi || 0) > 0 ||
      (enrollment?.openingCollectedOther || 0) > 0;

    setOpeningCash(enrollment?.openingCollectedCash ? enrollment.openingCollectedCash.toString() : '');
    setOpeningUpi(enrollment?.openingCollectedUpi ? enrollment.openingCollectedUpi.toString() : '');
    setOpeningOther(enrollment?.openingCollectedOther ? enrollment.openingCollectedOther.toString() : '');
    setShowOpeningHistory(hasOpening);
    setNotes(student?.notes || '');
  }, [open, student, enrollment, defaultYearId, defaultMedium, currentYearId, enrollments]);

  async function handleSave() {
    const fee = parseNonNegativeAmount(annualFee);
    const extra = parseNonNegativeAmount(additional || '0');
    const cash = parseNonNegativeAmount(openingCash || '0');
    const upi = parseNonNegativeAmount(openingUpi || '0');
    const other = parseNonNegativeAmount(openingOther || '0');

    if (!name.trim()) {
      toast({ title: 'Student name is required', variant: 'destructive' });
      return;
    }
    if (!className.trim()) {
      toast({ title: 'Class is required', variant: 'destructive' });
      return;
    }
    if (!yearId) {
      toast({ title: 'Academic year is required', variant: 'destructive' });
      return;
    }
    if (fee === null || extra === null || cash === null || upi === null || other === null) {
      toast({ title: 'Please enter valid numerical amounts', variant: 'destructive' });
      return;
    }
    if (cash + upi + other > fee + extra) {
      toast({
        title: 'Opening collection exceeds obligation',
        description: `Total opening collections (₹${cash + upi + other}) cannot exceed total fee obligation (₹${fee + extra}).`,
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      await saveStudent(
        {
          id: student?.id,
          admission_number: admission.trim() || null,
          full_name: name.trim(),
          status: student?.status || 'active',
          notes: notes.trim() || null,
        },
        {
          id: enrollment?.id,
          academic_year_id: yearId,
          class_name: className.trim(),
          medium,
          annual_fee_amount: fee,
          additional_outstanding_amount: extra,
          opening_collected_cash: cash,
          opening_collected_upi: upi,
          opening_collected_other: other,
          opening_snapshot_date:
            cash + upi + other > 0
              ? enrollment?.openingSnapshotDate || new Date().toISOString().slice(0, 10)
              : null,
          status: enrollment?.status || 'active',
          notes: enrollment?.notes || null,
        }
      );

      // Synchronize with previous academic year record if student exists
      const targetStudentId = student?.id;
      if (targetStudentId) {
        const existingPrevEnr = enrollments.find(
          (e) => e.studentId === targetStudentId && e.academicYearId !== yearId
        );
        const previousYear = academicYears
          .filter((y) => y.id !== yearId)
          .sort((a, b) => {
            const timeA = a.startDate instanceof Date ? a.startDate.getTime() : new Date(a.startDate).getTime();
            const timeB = b.startDate instanceof Date ? b.startDate.getTime() : new Date(b.startDate).getTime();
            return timeB - timeA;
          })[0];

        if (existingPrevEnr) {
          await saveStudent(
            {
              id: targetStudentId,
              admission_number: admission.trim() || null,
              full_name: name.trim(),
              status: student?.status || 'active',
              notes: notes.trim() || null,
            },
            {
              id: existingPrevEnr.id,
              academic_year_id: existingPrevEnr.academicYearId,
              class_name: existingPrevEnr.className || getPreviousClassName(className.trim()),
              medium: existingPrevEnr.medium || medium,
              annual_fee_amount: extra,
              additional_outstanding_amount: 0,
              opening_collected_cash: existingPrevEnr.openingCollectedCash || 0,
              opening_collected_upi: existingPrevEnr.openingCollectedUpi || 0,
              opening_collected_other: existingPrevEnr.openingCollectedOther || 0,
              opening_snapshot_date: existingPrevEnr.openingSnapshotDate || null,
              status: 'active',
              notes: existingPrevEnr.notes || null,
            }
          );
        } else if (extra > 0 && previousYear) {
          await saveStudent(
            {
              id: targetStudentId,
              admission_number: admission.trim() || null,
              full_name: name.trim(),
              status: student?.status || 'active',
              notes: notes.trim() || null,
            },
            {
              academic_year_id: previousYear.id,
              class_name: getPreviousClassName(className.trim()),
              medium,
              annual_fee_amount: extra,
              additional_outstanding_amount: 0,
              opening_collected_cash: 0,
              opening_collected_upi: 0,
              opening_collected_other: 0,
              opening_snapshot_date: null,
              status: 'active',
              notes: 'Carried forward from last year',
            }
          );
        }
      }

      await refreshAcademicYears();

      toast({ title: student ? 'Student updated successfully' : 'Student added successfully' });
      onClose();
    } catch (error) {
      toast({
        title: 'Could not save student',
        description: error instanceof Error ? error.message : 'Database error',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">
            {student ? 'Edit Student Profile & Fee' : 'Add New Student'}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {student
              ? 'Update student identity and current fee obligations'
              : 'Enter student information and fee structure for the academic year'}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSave();
          }}
          className="space-y-4 text-xs"
        >
          {/* Section 1: Student Information */}
          <div className="space-y-2.5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Student Information
            </h3>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="std-fullname" className="text-xs">Student Full Name *</Label>
                <Input
                  id="std-fullname"
                  placeholder="e.g. Aarav Patel"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={200}
                  className="mt-1 h-9 text-xs"
                  required
                />
              </div>

              <div>
                <Label htmlFor="std-admission" className="text-xs">Admission Number</Label>
                <Input
                  id="std-admission"
                  placeholder="e.g. 1024"
                  value={admission}
                  onChange={(e) => setAdmission(e.target.value)}
                  maxLength={80}
                  className="mt-1 h-9 text-xs font-mono"
                />
              </div>

              <div>
                <Label htmlFor="std-year" className="text-xs">Academic Year *</Label>
                <Select value={yearId} onValueChange={setYearId} disabled={!!enrollment}>
                  <SelectTrigger id="std-year" className="mt-1 h-9 text-xs">
                    <SelectValue placeholder="Select year" />
                  </SelectTrigger>
                  <SelectContent>
                    {academicYears.map((y) => (
                      <SelectItem key={y.id} value={y.id} className="text-xs">
                        AY {y.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Section 2: Enrollment Details */}
          <div className="space-y-3 border-t pt-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Enrollment Details
            </h3>

            {/* Prominent Medium Choice */}
            <div className="space-y-1.5">
              <Label id="std-medium-label" className="text-xs font-semibold">
                Instruction Medium *
              </Label>
              <div
                role="radiogroup"
                aria-labelledby="std-medium-label"
                className="grid grid-cols-2 gap-2"
              >
                <button
                  type="button"
                  role="radio"
                  id="medium-choice-gujarati"
                  aria-checked={medium === 'gujarati'}
                  onClick={() => setMedium('gujarati')}
                  className={`flex items-center justify-center gap-2 p-2.5 rounded-lg border text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    medium === 'gujarati'
                      ? 'border-amber-500 bg-amber-500/10 text-amber-900 dark:text-amber-200 ring-1 ring-amber-500/30 font-bold shadow-sm'
                      : 'border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted/40'
                  }`}
                >
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${
                      medium === 'gujarati' ? 'bg-amber-600 dark:bg-amber-400' : 'bg-muted-foreground/40'
                    }`}
                    aria-hidden="true"
                  />
                  <span>Gujarati Medium</span>
                </button>

                <button
                  type="button"
                  role="radio"
                  id="medium-choice-english"
                  aria-checked={medium === 'english'}
                  onClick={() => setMedium('english')}
                  className={`flex items-center justify-center gap-2 p-2.5 rounded-lg border text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    medium === 'english'
                      ? 'border-sky-500 bg-sky-500/10 text-sky-900 dark:text-sky-200 ring-1 ring-sky-500/30 font-bold shadow-sm'
                      : 'border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted/40'
                  }`}
                >
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${
                      medium === 'english' ? 'bg-sky-600 dark:bg-sky-400' : 'bg-muted-foreground/40'
                    }`}
                    aria-hidden="true"
                  />
                  <span>English Medium</span>
                </button>
              </div>
            </div>

            {/* Class Selection */}
            <div>
              <Label htmlFor="std-class" className="text-xs">Class *</Label>
              <Select value={className} onValueChange={setClassName}>
                <SelectTrigger id="std-class" className="mt-1 h-9 text-xs">
                  <SelectValue placeholder="Select class" />
                </SelectTrigger>
                <SelectContent>
                  {CLASS_OPTIONS.map((cls) => (
                    <SelectItem key={cls} value={cls} className="text-xs">
                      {cls}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Section 3: Fee Setup */}
          <div className="space-y-2.5 border-t pt-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Fee Setup
            </h3>
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <Label htmlFor="std-annual-fee" className="text-xs">Annual Fee (₹) *</Label>
                <Input
                  id="std-annual-fee"
                  type="number"
                  min="0"
                  placeholder="25000"
                  value={annualFee}
                  onChange={(e) => setAnnualFee(e.target.value)}
                  className="mt-1 h-9 text-xs font-mono"
                  required
                />
              </div>

              <div>
                <Label htmlFor="std-extra-fee" className="text-xs">Last Year's Pending Fees (₹)</Label>
                <Input
                  id="std-extra-fee"
                  type="number"
                  min="0"
                  placeholder="0"
                  value={additional}
                  onChange={(e) => setAdditional(e.target.value)}
                  className="mt-1 h-9 text-xs font-mono"
                  title="Unpaid fee balance carried forward from last year (if any)"
                />
              </div>
            </div>
          </div>

          {/* Section 4: Collapsed Opening Payment History (Optional) */}
          <Collapsible
            open={showOpeningHistory}
            onOpenChange={setShowOpeningHistory}
            className="rounded-lg border bg-muted/20"
          >
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex w-full items-center justify-between p-3 text-left transition-colors hover:bg-muted/40 rounded-lg"
              >
                <div>
                  <p className="text-xs font-semibold text-foreground">
                    Add opening payment history <span className="font-normal text-muted-foreground">(optional)</span>
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    For fees paid before onboarding to this system
                  </p>
                </div>
                {showOpeningHistory ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
            </CollapsibleTrigger>

            <CollapsibleContent className="px-3 pb-3 pt-1 border-t space-y-2.5">
              <div className="flex items-start gap-1.5 text-[11px] text-muted-foreground bg-primary/5 p-2 rounded-md">
                <Info className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                <span>
                  Reduces the student's pending balance without creating duplicate income entries in financial ledgers.
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label htmlFor="std-open-cash" className="text-[11px] text-muted-foreground">Paid Cash (₹)</Label>
                  <Input
                    id="std-open-cash"
                    type="number"
                    min="0"
                    placeholder="0"
                    value={openingCash}
                    onChange={(e) => setOpeningCash(e.target.value)}
                    className="mt-0.5 h-8 text-xs font-mono"
                  />
                </div>

                <div>
                  <Label htmlFor="std-open-upi" className="text-[11px] text-muted-foreground">Paid UPI (₹)</Label>
                  <Input
                    id="std-open-upi"
                    type="number"
                    min="0"
                    placeholder="0"
                    value={openingUpi}
                    onChange={(e) => setOpeningUpi(e.target.value)}
                    className="mt-0.5 h-8 text-xs font-mono"
                  />
                </div>

                <div>
                  <Label htmlFor="std-open-other" className="text-[11px] text-muted-foreground">Paid Other (₹)</Label>
                  <Input
                    id="std-open-other"
                    type="number"
                    min="0"
                    placeholder="0"
                    value={openingOther}
                    onChange={(e) => setOpeningOther(e.target.value)}
                    className="mt-0.5 h-8 text-xs font-mono"
                  />
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Section 5: Notes */}
          <div className="border-t pt-3">
            <Label htmlFor="std-notes" className="text-xs text-muted-foreground">Notes (optional)</Label>
            <Textarea
              id="std-notes"
              placeholder="Any student notes or special remarks..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={4000}
              rows={2}
              className="mt-1 text-xs"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={saving}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={saving} className="text-xs gap-1.5">
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>{student ? 'Save Changes' : 'Add Student'}</span>
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
