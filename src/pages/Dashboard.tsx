import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFinanceStore } from '@/store/finance-store';
import { useStudentStore } from '@/store/student-store';
import { TUITION_CATEGORY } from '@/types/finance';
import {
  getIncomeBreakdown,
  getRecoverableSummary,
  isPreviousAcademicYear,
} from '@/lib/finance-domain';
import { getStudentFeeSummary, getStudentPreviousPending, summarizeRoster } from '@/lib/student-fees';

import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { DashboardSummary } from '@/components/dashboard/DashboardSummary';
import { DashboardAttention } from '@/components/dashboard/DashboardAttention';
import { FeeCollectionOverview } from '@/components/dashboard/FeeCollectionOverview';
import { MediumStudentSnapshot } from '@/components/dashboard/MediumStudentSnapshot';
import { FinancialPosition } from '@/components/dashboard/FinancialPosition';
import { UnrealizedExpenseSection } from '@/components/dashboard/UnrealizedExpenseSection';
import { CashFlowChart } from '@/components/dashboard/CashFlowChart';
import { ExpenseCategorySummary } from '@/components/dashboard/ExpenseCategorySummary';
import { RecentActivity, type DashboardTransaction } from '@/components/dashboard/RecentActivity';

import { AddIncomeModal } from '@/components/AddIncomeModal';
import { AddExpenseModal } from '@/components/AddExpenseModal';
import { TransferModal } from '@/components/TransferModal';
import { RecurringReviewModal } from '@/components/RecurringReviewModal';

export default function Dashboard() {
  const {
    incomeEntries,
    expenseEntries,
    academicYears,
    currentYearId,
    transfers,
    getTotalBalance,
    getYearProfitBreakdown,
    getProjectedProfit,
    pendingRecurringItems,
    getPendingForYear,
    recoverables,
    recoverableRepayments,
    accounts,
  } = useFinanceStore();

  const { enrollments } = useStudentStore();
  const navigate = useNavigate();

  const [showIncome, setShowIncome] = useState(false);
  const [showExpense, setShowExpense] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [showRecurring, setShowRecurring] = useState(false);

  const currentYear = useMemo(
    () => academicYears.find((year) => year.id === currentYearId),
    [academicYears, currentYearId]
  );

  const derivedData = useMemo(() => {
    const breakdown = getYearProfitBreakdown(currentYearId);
    const currentYearIncome = incomeEntries.filter(
      (entry) => entry.academicYearId === currentYearId
    );
    const incomeBreakdown = getIncomeBreakdown(currentYearIncome);
    const currentTuitionCollected = currentYearIncome
      .filter((entry) => entry.category === TUITION_CATEGORY && !entry.isLateCollection)
      .reduce((sum, entry) => sum + entry.amount, 0);

    const activeCurrentEnrollments = enrollments.filter(
      (item) => item.academicYearId === currentYearId && item.status === 'active'
    );
    const rosterAnnualTarget = activeCurrentEnrollments.reduce(
      (sum, e) => sum + (e.annualFeeAmount || 0),
      0
    );
    const currentTarget =
      activeCurrentEnrollments.length > 0
        ? rosterAnnualTarget
        : (currentYear?.targetTuitionFees || 0);
    const currentRemaining = Math.max(0, currentTarget - currentTuitionCollected);
    const feeProgress =
      currentTarget > 0
        ? Math.min(100, Math.round((currentTuitionCollected / currentTarget) * 100))
        : 0;

    // Student roster previous year's pending balance:
    // Unified across all active students using getStudentPreviousPending
    const totalRosterLastYearPending = activeCurrentEnrollments.reduce(
      (sum, e) =>
        sum +
        getStudentPreviousPending(
          e.studentId,
          currentYearId,
          enrollments,
          incomeEntries
        ),
      0
    );
    const rosterLastYearTotal = activeCurrentEnrollments.reduce(
      (sum, e) => sum + (e.additionalOutstandingAmount || 0),
      0
    );

    // Academic year level previous pending
    const previousYears = currentYear
      ? academicYears.filter((year) => isPreviousAcademicYear(year, currentYear))
      : [];
    const previousYearRows = previousYears.map((year) => {
      const yearRosterPending = enrollments
        .filter((e) => e.academicYearId === year.id && e.status === 'active')
        .reduce((sum, e) => sum + getStudentFeeSummary(e, incomeEntries).pending, 0);
      const yearInfo = getPendingForYear(year.id);
      // When student enrollments exist in the system, the student roster is the single source of truth.
      // If students have cleared their dues (or none were enrolled for this prior year), effectiveRemaining is yearRosterPending.
      // If no enrollments exist in the software yet, fall back to yearInfo.remaining.
      const effectiveRemaining = enrollments.length > 0 ? yearRosterPending : yearInfo.remaining;
      return {
        year,
        info: {
          ...yearInfo,
          remaining: effectiveRemaining,
          totalOwed: Math.max(yearInfo.totalOwed, yearRosterPending + yearInfo.collected),
        },
        receivedThisAcademicYear: currentYearIncome
          .filter((entry) => entry.isLateCollection && entry.originalYearId === year.id)
          .reduce((sum, entry) => sum + entry.amount, 0),
      };
    });
    const previousYearRowsPending = previousYearRows.reduce(
      (sum, row) => sum + row.info.remaining,
      0
    );

    // Total Last Year's Pending Fees
    // Roster is authoritative when enrollments exist: if 0, Dashboard displays ₹0 (Fully Cleared)
    const lastYearPending =
      enrollments.length > 0 ? totalRosterLastYearPending : previousYearRowsPending;

    const schoolExpenses = breakdown.fixedExpenses + breakdown.extraExpenses;
    const recoverablesOutstanding = recoverables.reduce(
      (sum, recoverable) =>
        sum + getRecoverableSummary(recoverable, recoverableRepayments).outstanding,
      0
    );

    // Medium calculations
    const gujaratiEnrollments = activeCurrentEnrollments.filter(
      (e) => e.medium === 'gujarati'
    );
    const englishEnrollments = activeCurrentEnrollments.filter(
      (e) => e.medium === 'english'
    );

    const gujaratiSummary = summarizeRoster(gujaratiEnrollments, incomeEntries);
    const englishSummary = summarizeRoster(englishEnrollments, incomeEntries);

    // Unassigned tuition: current tuition income without a student enrollment link
    const linkedCurrentTuition = currentYearIncome
      .filter((entry) => !entry.isLateCollection && entry.studentEnrollmentId)
      .reduce((sum, entry) => sum + entry.amount, 0);
    const unassignedCurrentTuition = Math.max(0, currentTuitionCollected - linkedCurrentTuition);

    // Unrealized Expenses calculation:
    // Total fees collected from students (including roster opening collections) or recorded finance tuition
    const studentRosterCollected = activeCurrentEnrollments
      .map((e) => getStudentFeeSummary(e, incomeEntries).collected)
      .reduce((sum, val) => sum + val, 0);
    const totalFeesCollected = Math.max(
      studentRosterCollected,
      currentTuitionCollected + incomeBreakdown.oldFees
    );
    const totalBalance = getTotalBalance();
    const accountedFunds = totalBalance + schoolExpenses;
    const unrealizedExpenses = Math.max(0, totalFeesCollected - accountedFunds);

    return {
      breakdown,
      projected: getProjectedProfit(currentYearId),
      totalBalance,
      currentTarget,
      currentTuitionCollected,
      currentRemaining,
      feeProgress,
      previousYearRows,
      lastYearPending,
      lastYearReceived: incomeBreakdown.oldFees,
      totalFeesReceivedThisAY: currentTuitionCollected + incomeBreakdown.oldFees,
      totalFeesStillToCollect: currentRemaining + lastYearPending,
      totalRosterLastYearPending,
      rosterLastYearTotal,
      schoolExpenses,
      recoverablesOutstanding,
      activeCurrentEnrollmentsCount: activeCurrentEnrollments.length,
      gujarati: {
        totalStudents: gujaratiEnrollments.length,
        pendingStudents: gujaratiSummary.pendingStudents,
        pendingAmount: gujaratiSummary.pending,
      },
      english: {
        totalStudents: englishEnrollments.length,
        pendingStudents: englishSummary.pendingStudents,
        pendingAmount: englishSummary.pending,
      },
      unassignedCurrentTuition,
      totalFeesCollected,
      unrealizedExpenses,
    };
  }, [
    academicYears,
    currentYear,
    currentYearId,
    enrollments,
    getPendingForYear,
    getProjectedProfit,
    getTotalBalance,
    getYearProfitBreakdown,
    incomeEntries,
    recoverableRepayments,
    recoverables,
  ]);

  const monthlyData = useMemo(() => {
    if (!currentYear) return [];
    const yearIncome = incomeEntries.filter(
      (entry) => entry.academicYearId === currentYearId
    );
    const yearExpenses = expenseEntries.filter(
      (entry) => entry.academicYearId === currentYearId && entry.expenseType === 'school'
    );
    const buckets: { month: string; year: number; monthIndex: number }[] = [];
    const cursor = new Date(
      currentYear.startDate.getFullYear(),
      currentYear.startDate.getMonth(),
      1
    );
    const end = new Date(
      currentYear.endDate.getFullYear(),
      currentYear.endDate.getMonth(),
      1
    );
    while (cursor <= end && buckets.length < 24) {
      buckets.push({
        month: cursor.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }),
        year: cursor.getFullYear(),
        monthIndex: cursor.getMonth(),
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return buckets
      .map((bucket) => ({
        month: bucket.month,
        income: yearIncome
          .filter(
            (entry) =>
              entry.date.getFullYear() === bucket.year &&
              entry.date.getMonth() === bucket.monthIndex
          )
          .reduce((sum, entry) => sum + entry.amount, 0),
        expenses: yearExpenses
          .filter(
            (entry) =>
              entry.date.getFullYear() === bucket.year &&
              entry.date.getMonth() === bucket.monthIndex
          )
          .reduce((sum, entry) => sum + entry.amount, 0),
      }))
      .filter((item) => item.income > 0 || item.expenses > 0);
  }, [currentYear, currentYearId, expenseEntries, incomeEntries]);

  const topExpenseCategories = useMemo(() => {
    const totals = new Map<string, number>();
    expenseEntries
      .filter(
        (entry) => entry.academicYearId === currentYearId && entry.expenseType === 'school'
      )
      .forEach((entry) =>
        totals.set(entry.category, (totals.get(entry.category) || 0) + entry.amount)
      );
    return Array.from(totals.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [currentYearId, expenseEntries]);

  const recentTransactions: DashboardTransaction[] = useMemo(() => {
    const accountName = (id: string) =>
      accounts.find((account) => account.id === id)?.name || 'Unknown account';

    return [
      ...incomeEntries.map((entry) => ({
        id: `income-${entry.id}`,
        date: entry.date,
        label: entry.isLateCollection ? 'Previous-Year Fee Payment' : entry.category,
        detail: entry.isLateCollection
          ? `For AY ${academicYears.find((year) => year.id === entry.originalYearId)?.label || '—'}`
          : entry.notes,
        amount: entry.amount,
        kind: 'income' as const,
      })),
      ...expenseEntries.map((entry) => ({
        id: `expense-${entry.id}`,
        date: entry.date,
        label: entry.category,
        detail:
          entry.expenseType === 'school'
            ? 'School expense'
            : 'Home/personal expense',
        amount: entry.amount,
        kind: 'expense' as const,
      })),
      ...transfers.map((entry) => ({
        id: `transfer-${entry.id}`,
        date: entry.date,
        label: 'Transfer',
        detail: `${accountName(entry.fromAccountId)} → ${accountName(entry.toAccountId)} · No liquidity change`,
        amount: entry.amount,
        kind: 'transfer' as const,
      })),
      ...recoverables.map((entry) => ({
        id: `advance-${entry.id}`,
        date: entry.dateGiven,
        label: `Recoverable Advance — ${entry.partyName}`,
        detail: 'Cash advanced · not an expense',
        amount: entry.originalAmount,
        kind: 'recoverable' as const,
      })),
      ...recoverableRepayments.map((entry) => ({
        id: `repayment-${entry.id}`,
        date: entry.date,
        label: 'Recoverable Repayment',
        detail: 'Liquidity restored · not income',
        amount: entry.amount,
        kind: 'recoverable' as const,
      })),
    ]
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, 8);
  }, [
    academicYears,
    accounts,
    expenseEntries,
    incomeEntries,
    recoverableRepayments,
    recoverables,
    transfers,
  ]);

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      {/* 1. Header & Actions */}
      <DashboardHeader
        academicYearLabel={currentYear?.label}
        onRecordFee={() => setShowIncome(true)}
        onAddExpense={() => setShowExpense(true)}
        onTransfer={() => setShowTransfer(true)}
      />

      {/* 2. Primary Summary: Top 4 KPI Metrics */}
      <DashboardSummary
        totalFeesStillToCollect={derivedData.totalFeesStillToCollect}
        availableBalance={derivedData.totalBalance}
        schoolProfit={derivedData.breakdown.netProfit}
        activeStudents={derivedData.activeCurrentEnrollmentsCount}
        gujaratiStudents={derivedData.gujarati.totalStudents}
        englishStudents={derivedData.english.totalStudents}
      />

      {/* 3. Needs Attention (Elevated high in the viewport) */}
      <DashboardAttention
        lastYearPending={derivedData.lastYearPending}
        recoverablesOutstanding={derivedData.recoverablesOutstanding}
        pendingRecurringCount={pendingRecurringItems.length}
        onViewStudentFees={() => navigate('/students')}
        onViewRecoverables={() => navigate('/recoverables')}
        onReviewRecurring={() => setShowRecurring(true)}
      />

      {/* 4. Fee Collection Overview: Current Tuition & Prior Year Dues */}
      <FeeCollectionOverview
        currentYearLabel={currentYear?.label}
        currentTarget={derivedData.currentTarget}
        currentCollected={derivedData.currentTuitionCollected}
        currentRemaining={derivedData.currentRemaining}
        feeProgress={derivedData.feeProgress}
        lastYearPending={derivedData.lastYearPending}
        lastYearReceived={derivedData.lastYearReceived}
        previousYearRows={derivedData.previousYearRows}
        totalRosterLastYearPending={derivedData.totalRosterLastYearPending}
        totalFeesReceivedThisAY={derivedData.totalFeesReceivedThisAY}
        totalFeesStillToCollect={derivedData.totalFeesStillToCollect}
        onViewStudentFees={() => navigate('/students')}
      />

      {/* 5. Students by Medium: Gujarati & English medium cards + Drilldown */}
      <MediumStudentSnapshot
        gujarati={derivedData.gujarati}
        english={derivedData.english}
        unassignedCurrentTuition={derivedData.unassignedCurrentTuition}
        onNavigateMedium={(medium) => navigate(`/students?medium=${medium}`)}
        onViewAllStudents={() => navigate('/students')}
      />

      {/* 6. Financial Position: Cash accounting breakdown and Projected Year-End Profit */}
      <FinancialPosition
        totalIncome={derivedData.breakdown.totalIncome}
        schoolExpenses={derivedData.schoolExpenses}
        netProfit={derivedData.breakdown.netProfit}
        projectedProfit={derivedData.projected}
      />

      {/* 7. Unrealized Expenses Section: Gap between fee collections and available balance */}
      <UnrealizedExpenseSection
        totalFeesCollected={derivedData.totalFeesCollected}
        availableBalance={derivedData.totalBalance}
        recordedSchoolExpenses={derivedData.schoolExpenses}
        unrealizedExpenses={derivedData.unrealizedExpenses}
        onAddExpense={() => setShowExpense(true)}
      />

      {/* 8. Trends & Expense Analytics */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.7fr)]">
        <CashFlowChart data={monthlyData} />
        <ExpenseCategorySummary
          categories={topExpenseCategories}
          onViewAllReports={() => navigate('/reports')}
        />
      </div>

      {/* 8. Recent Activity Across Accounts */}
      <RecentActivity transactions={recentTransactions} />

      {/* Operation Modals */}
      <AddIncomeModal isOpen={showIncome} onClose={() => setShowIncome(false)} />
      <AddExpenseModal isOpen={showExpense} onClose={() => setShowExpense(false)} />
      <TransferModal isOpen={showTransfer} onClose={() => setShowTransfer(false)} />
      <RecurringReviewModal isOpen={showRecurring} onClose={() => setShowRecurring(false)} />
    </div>
  );
}
