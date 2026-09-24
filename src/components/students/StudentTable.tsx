import React from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, MoreHorizontal, IndianRupee, Edit, Eye, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  Table,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { StudentFeeBadge } from './StudentFeeBadge';
import { StudentMediumBadge } from './StudentMediumBadge';
import { formatINR } from '@/utils/currency';
import type { Student, StudentEnrollment, StudentFeeSummary, StudentMedium } from '@/types/students';

export type SortField = 'default' | 'name' | 'admission' | 'class' | 'obligation' | 'collected' | 'pending' | 'previous';
export type SortDirection = 'asc' | 'desc';

export interface StudentRowData {
  student: Student;
  enrollment: StudentEnrollment;
  fees: StudentFeeSummary;
  previous: number;
}

interface StudentTableProps {
  rows: StudentRowData[];
  sortField: SortField;
  sortDirection: SortDirection;
  onSort: (field: SortField) => void;
  onSelectStudent: (studentId: string) => void;
  onRecordPayment: (enrollmentId: string) => void;
  onRecordPreviousPayment?: (row: StudentRowData) => void;
  onEditStudent: (student: Student, enrollment: StudentEnrollment) => void;
  page: number;
  pageSize: number;
  totalRows: number;
  onPageChange: (newPage: number) => void;
  activeMedium?: 'all' | StudentMedium;
}

export function StudentTable({
  rows,
  sortField,
  sortDirection,
  onSort,
  onSelectStudent,
  onRecordPayment,
  onRecordPreviousPayment,
  onEditStudent,
  page,
  pageSize,
  totalRows,
  onPageChange,
  activeMedium = 'all',
}: StudentTableProps) {
  const totalPages = Math.ceil(totalRows / pageSize) || 1;
  const startRow = totalRows === 0 ? 0 : (page - 1) * pageSize + 1;
  const endRow = Math.min(page * pageSize, totalRows);

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="ml-1 h-3 w-3 opacity-40 group-hover:opacity-100" />;
    }
    return sortDirection === 'asc' ? (
      <ArrowUp className="ml-1 h-3 w-3 text-primary" />
    ) : (
      <ArrowDown className="ml-1 h-3 w-3 text-primary" />
    );
  };

  const getAriaSort = (field: SortField): React.AriaAttributes['aria-sort'] => {
    if (sortField !== field) return 'none';
    return sortDirection === 'asc' ? 'ascending' : 'descending';
  };

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              {/* Admission Number */}
              <TableHead className="w-[110px]" aria-sort={getAriaSort('admission')}>
                <button
                  type="button"
                  onClick={() => onSort('admission')}
                  className="group inline-flex items-center text-xs font-semibold text-foreground hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded"
                >
                  <span>Adm No.</span>
                  {getSortIcon('admission')}
                </button>
              </TableHead>

              {/* Student Name */}
              <TableHead className="w-[240px]" aria-sort={getAriaSort('name')}>
                <button
                  type="button"
                  onClick={() => onSort('name')}
                  className="group inline-flex items-center text-xs font-semibold text-foreground hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded"
                >
                  <span>Student Name</span>
                  {getSortIcon('name')}
                </button>
              </TableHead>

              {/* Class */}
              <TableHead className="w-[110px]" aria-sort={getAriaSort('class')}>
                <button
                  type="button"
                  onClick={() => onSort('class')}
                  className="group inline-flex items-center text-xs font-semibold text-foreground hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded"
                >
                  <span>Class</span>
                  {getSortIcon('class')}
                </button>
              </TableHead>

              {/* Medium (only in All Students mode) */}
              {activeMedium === 'all' && (
                <TableHead className="w-[120px] text-xs font-semibold text-foreground">
                  Medium
                </TableHead>
              )}

              {/* Total Fee */}
              <TableHead className="w-[120px] text-right" aria-sort={getAriaSort('obligation')}>
                <button
                  type="button"
                  onClick={() => onSort('obligation')}
                  className="group inline-flex items-center justify-end w-full text-xs font-semibold text-foreground hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded"
                >
                  <span>Total Fee</span>
                  {getSortIcon('obligation')}
                </button>
              </TableHead>

              {/* Collected */}
              <TableHead className="w-[120px] text-right" aria-sort={getAriaSort('collected')}>
                <button
                  type="button"
                  onClick={() => onSort('collected')}
                  className="group inline-flex items-center justify-end w-full text-xs font-semibold text-foreground hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded"
                >
                  <span>Collected</span>
                  {getSortIcon('collected')}
                </button>
              </TableHead>

              {/* Current Pending */}
              <TableHead className="w-[130px] text-right" aria-sort={getAriaSort('pending')}>
                <button
                  type="button"
                  onClick={() => onSort('pending')}
                  className="group inline-flex items-center justify-end w-full text-xs font-semibold text-foreground hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded"
                >
                  <span>Current Pending</span>
                  {getSortIcon('pending')}
                </button>
              </TableHead>

              {/* Last Year's Pending */}
              <TableHead className="w-[130px] text-right" aria-sort={getAriaSort('previous')}>
                <button
                  type="button"
                  onClick={() => onSort('previous')}
                  className="group inline-flex items-center justify-end w-full text-xs font-semibold text-foreground hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded"
                >
                  <span>Last Year's Pending</span>
                  {getSortIcon('previous')}
                </button>
              </TableHead>

              {/* Status */}
              <TableHead className="w-[100px] text-center text-xs font-semibold text-foreground">
                Status
              </TableHead>

              {/* Actions */}
              <TableHead className="w-[70px] text-right text-xs font-semibold text-foreground">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>

          <tbody className="divide-y font-mono-nums">
            {rows.map((row) => {
              const { student, enrollment, fees, previous } = row;
              return (
                <tr
                  key={enrollment.id}
                  onClick={() => onSelectStudent(student.id)}
                  className="group cursor-pointer transition-colors hover:bg-muted/40 focus-within:bg-muted/40"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelectStudent(student.id);
                    }
                  }}
                >
                {/* Admission Number */}
                <TableCell className="py-3.5 font-mono text-xs font-medium text-muted-foreground">
                  {student.admissionNumber || '—'}
                </TableCell>

                {/* Student Name */}
                <TableCell className="py-3.5">
                  <p className="font-sans font-semibold text-sm text-foreground group-hover:text-primary transition-colors truncate">
                    {student.fullName}
                  </p>
                </TableCell>

                {/* Class */}
                <TableCell className="py-3.5 font-sans text-xs text-foreground font-semibold">
                  {enrollment.className}
                </TableCell>

                {/* Medium (only in All Students mode) */}
                {activeMedium === 'all' && (
                  <TableCell className="py-3.5 font-sans">
                    <StudentMediumBadge medium={enrollment.medium} size="xs" variant="compact" />
                  </TableCell>
                )}

                {/* Total Fee */}
                <TableCell className="py-3.5 text-right font-mono text-xs text-foreground">
                  {formatINR(enrollment.annualFeeAmount)}
                </TableCell>

                {/* Collected */}
                <TableCell className="py-3.5 text-right font-mono text-xs text-income font-medium">
                  {fees.collected > 0 ? formatINR(fees.collected) : '₹0'}
                </TableCell>

                {/* Current Pending */}
                <TableCell className="py-3.5 text-right font-mono text-xs">
                  {Math.max(0, enrollment.annualFeeAmount - fees.collected) > 0 ? (
                    <span className="font-bold text-sm text-warning">
                      {formatINR(Math.max(0, enrollment.annualFeeAmount - fees.collected))}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>

                {/* Previous Due */}
                <TableCell className="py-3.5 text-right font-mono text-xs">
                  {previous > 0 ? (
                    <span className="font-bold text-sm text-warning">{formatINR(previous)}</span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>

                {/* Status */}
                <TableCell className="py-3.5 text-center">
                  <StudentFeeBadge status={fees.status} size="sm" />
                </TableCell>

                {/* Row Actions */}
                <TableCell className="py-3 text-right" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        aria-label={`Actions for ${student.fullName}`}
                      >
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40 text-xs">
                      <DropdownMenuItem
                        onClick={() => onSelectStudent(student.id)}
                        className="gap-2 cursor-pointer"
                      >
                        <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>View Profile</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => onRecordPayment(enrollment.id)}
                        className="gap-2 cursor-pointer"
                      >
                        <IndianRupee className="h-3.5 w-3.5 text-income" />
                        <span>Record Payment</span>
                      </DropdownMenuItem>
                      {previous > 0 && onRecordPreviousPayment && (
                        <DropdownMenuItem
                          onClick={() => onRecordPreviousPayment(row)}
                          className="gap-2 cursor-pointer text-warning focus:text-warning"
                        >
                          <IndianRupee className="h-3.5 w-3.5 text-warning" />
                          <span>Record Previous-Year Payment</span>
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        onClick={() => onEditStudent(student, enrollment)}
                        className="gap-2 cursor-pointer"
                      >
                        <Edit className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>Edit Student</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </tr>
              );
            })}
          </tbody>
        </Table>
      </div>

      {/* Table Pagination Bar */}
      {totalRows > pageSize && (
        <div className="flex items-center justify-between border-t px-4 py-3 text-xs text-muted-foreground bg-muted/10">
          <p>
            Showing <span className="font-medium text-foreground">{startRow}</span> to{' '}
            <span className="font-medium text-foreground">{endRow}</span> of{' '}
            <span className="font-medium text-foreground">{totalRows}</span> students
          </p>

          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              className="h-8 w-8 p-0"
              aria-label="Previous page"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="px-2 font-medium text-foreground">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              className="h-8 w-8 p-0"
              aria-label="Next page"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
