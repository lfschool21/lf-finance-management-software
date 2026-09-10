import React from 'react';
import { Search, X, RotateCcw, LayoutGrid, List } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { StudentMedium } from '@/types/students';

export type FeeFilterType = 'all' | 'paid' | 'partial' | 'unpaid' | 'previous';

interface StudentToolbarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  classFilter: string;
  onClassChange: (className: string) => void;
  feeFilter: FeeFilterType;
  onFeeFilterChange: (filter: FeeFilterType) => void;
  availableClasses: string[];
  totalCount: number;
  filteredCount: number;
  activeMedium?: 'all' | StudentMedium;
  displayedStart?: number;
  displayedEnd?: number;
  pageSize?: number;
  onPageSizeChange?: (size: number) => void;
  onResetFilters: () => void;
  viewMode?: 'cards' | 'table';
  onViewModeChange?: (mode: 'cards' | 'table') => void;
}

export function StudentToolbar({
  searchQuery,
  onSearchChange,
  classFilter,
  onClassChange,
  feeFilter,
  onFeeFilterChange,
  availableClasses,
  totalCount,
  filteredCount,
  activeMedium = 'all',
  displayedStart,
  displayedEnd,
  pageSize,
  onPageSizeChange,
  onResetFilters,
  viewMode = 'cards',
  onViewModeChange,
}: StudentToolbarProps) {
  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    classFilter !== 'all' ||
    feeFilter !== 'all';

  const showRange =
    displayedStart !== undefined &&
    displayedEnd !== undefined &&
    filteredCount > 0 &&
    (displayedStart > 1 || displayedEnd < filteredCount);

  const mediumLabel =
    activeMedium === 'gujarati'
      ? 'Gujarati Medium '
      : activeMedium === 'english'
      ? 'English Medium '
      : '';

  return (
    <div className="space-y-2.5">
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
        {/* Search input with leading icon and clear button */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            type="text"
            placeholder="Search by student name or admission number..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-9 pl-9 pr-8 text-xs bg-card"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Filter controls row */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Class Filter */}
          <div className="w-36 sm:w-40">
            <Select value={classFilter} onValueChange={onClassChange}>
              <SelectTrigger className="h-9 text-xs bg-card" aria-label="Filter by class">
                <SelectValue placeholder="All Classes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">All Classes</SelectItem>
                {availableClasses.map((cls) => (
                  <SelectItem key={cls} value={cls} className="text-xs">{cls}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Fee Status Filter */}
          <div className="w-40 sm:w-44">
            <Select value={feeFilter} onValueChange={(val) => onFeeFilterChange(val as FeeFilterType)}>
              <SelectTrigger className="h-9 text-xs bg-card" aria-label="Filter by fee status">
                <SelectValue placeholder="All Fee Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">All Fee Statuses</SelectItem>
                <SelectItem value="unpaid" className="text-xs">Unpaid</SelectItem>
                <SelectItem value="partial" className="text-xs">Partially Paid</SelectItem>
                <SelectItem value="paid" className="text-xs">Fully Paid</SelectItem>
                <SelectItem value="previous" className="text-xs">Previous-Year Dues</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Reset Filters button */}
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onResetFilters}
              className="h-9 text-xs text-muted-foreground hover:text-foreground gap-1 px-2.5"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Reset</span>
            </Button>
          )}
        </div>
      </div>

      {/* Results counter and per-page selector */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground px-0.5">
        <p>
          Showing{' '}
          <span className="font-semibold text-foreground">
            {showRange ? `${displayedStart}–${displayedEnd}` : filteredCount}
          </span>{' '}
          of <span className="font-semibold text-foreground">{totalCount}</span> {mediumLabel}students
          {hasActiveFilters && ' (filtered)'}
        </p>

        <div className="flex items-center gap-2.5">
          {onViewModeChange && (
            <div
              className="flex items-center rounded-lg border bg-card p-0.5 shadow-2xs"
              role="group"
              aria-label="View mode"
            >
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onViewModeChange('cards')}
                className={`h-7 px-2.5 text-xs gap-1.5 rounded-md transition-all ${
                  viewMode === 'cards'
                    ? 'bg-primary text-primary-foreground font-semibold shadow-xs hover:bg-primary hover:text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                aria-label="Cards view"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                <span>Cards</span>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onViewModeChange('table')}
                className={`h-7 px-2.5 text-xs gap-1.5 rounded-md transition-all ${
                  viewMode === 'table'
                    ? 'bg-primary text-primary-foreground font-semibold shadow-xs hover:bg-primary hover:text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                aria-label="Table view"
              >
                <List className="h-3.5 w-3.5" />
                <span>Table</span>
              </Button>
            </div>
          )}

          {pageSize !== undefined && onPageSizeChange && totalCount > 25 && (
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-muted-foreground hidden sm:inline">Per page:</span>
              <Select value={String(pageSize)} onValueChange={(v) => onPageSizeChange(Number(v))}>
                <SelectTrigger className="h-7 w-20 sm:w-24 text-xs bg-card" aria-label="Students per page">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="25" className="text-xs">25</SelectItem>
                  <SelectItem value="50" className="text-xs">50</SelectItem>
                  <SelectItem value="100" className="text-xs">100</SelectItem>
                  <SelectItem value="200" className="text-xs">200</SelectItem>
                  <SelectItem value="1000" className="text-xs">All ({totalCount})</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
