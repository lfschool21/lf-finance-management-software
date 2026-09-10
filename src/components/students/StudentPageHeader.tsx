import React from 'react';
import { Plus, Download, FileSpreadsheet, ChevronDown, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTranslation } from '@/lib/i18n';
import type { AcademicYear } from '@/types/finance';

interface StudentPageHeaderProps {
  academicYears: AcademicYear[];
  selectedYearId: string;
  onYearChange: (yearId: string) => void;
  onAddStudent: () => void;
  onImportStudents: () => void;
  onDownloadTemplate: () => void;
  onRemoveAllStudents?: () => void;
  totalStudentsCount?: number;
}

export function StudentPageHeader({
  academicYears,
  selectedYearId,
  onYearChange,
  onAddStudent,
  onImportStudents,
  onDownloadTemplate,
  onRemoveAllStudents,
  totalStudentsCount = 0,
}: StudentPageHeaderProps) {
  const { t } = useTranslation();

  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {t('studentsTitle')}
        </h1>
        <p className="text-sm text-muted-foreground">{t('studentsSubtitle')}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        {/* Academic Year Selector */}
        <div className="w-44 sm:w-48">
          <Select value={selectedYearId} onValueChange={onYearChange}>
            <SelectTrigger aria-label="Select Academic Year" className="h-9 bg-card text-xs font-medium">
              <span className="text-muted-foreground mr-1">AY:</span>
              <SelectValue placeholder="Select year" />
            </SelectTrigger>
            <SelectContent>
              {academicYears.map((year) => (
                <SelectItem key={year.id} value={year.id} className="text-xs font-mono-nums">
                  {year.label} {year.status === 'active' ? '(Current)' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Import / Export dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs font-medium">
              <FileSpreadsheet className="h-3.5 w-3.5 text-muted-foreground" />
              <span>Import / Export</span>
              <ChevronDown className="h-3 w-3 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onClick={onImportStudents} className="gap-2 text-xs cursor-pointer">
              <FileSpreadsheet className="h-4 w-4 text-primary" />
              <div>
                <p className="font-medium">Import Students</p>
                <p className="text-[11px] text-muted-foreground">Upload spreadsheet roster</p>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDownloadTemplate} className="gap-2 text-xs cursor-pointer">
              <Download className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="font-medium">Download Template</p>
                <p className="text-[11px] text-muted-foreground">Sample Excel spreadsheet</p>
              </div>
            </DropdownMenuItem>
            {onRemoveAllStudents && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={onRemoveAllStudents}
                  disabled={totalStudentsCount === 0}
                  className="gap-2 text-xs text-destructive focus:text-destructive cursor-pointer"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                  <div>
                    <p className="font-medium">{t('removeAllStudents')}</p>
                    <p className="text-[11px] text-muted-foreground">Clear student rosters</p>
                  </div>
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Primary Action */}
        <Button onClick={onAddStudent} size="sm" className="h-9 gap-1.5 text-xs font-semibold shadow-sm">
          <Plus className="h-4 w-4" />
          <span>{t('addStudent')}</span>
        </Button>
      </div>
    </header>
  );
}
