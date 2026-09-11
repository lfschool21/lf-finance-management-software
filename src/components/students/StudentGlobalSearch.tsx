import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, X, ArrowRight, User } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { StudentMediumBadge } from './StudentMediumBadge';
import type { Student, StudentEnrollment } from '@/types/students';

interface StudentGlobalSearchProps {
  students: Student[];
  enrollments: StudentEnrollment[];
  selectedYearId: string;
  onSelectStudent: (studentId: string) => void;
  placeholder?: string;
}

interface SearchResultItem {
  student: Student;
  enrollment?: StudentEnrollment;
}

export function StudentGlobalSearch({
  students,
  enrollments,
  selectedYearId,
  onSelectStudent,
  placeholder = 'Search all students across mediums by name or admission number...',
}: StudentGlobalSearchProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Map active year enrollments by student ID
  const enrollmentMap = useMemo(() => {
    const map = new Map<string, StudentEnrollment>();
    for (const enr of enrollments) {
      if (enr.academicYearId === selectedYearId && enr.status === 'active') {
        map.set(enr.studentId, enr);
      }
    }
    return map;
  }, [enrollments, selectedYearId]);

  // Compute matched students
  const results = useMemo<SearchResultItem[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    const matched: SearchResultItem[] = [];

    for (const student of students) {
      const matchName = student.fullName.toLowerCase().includes(q);
      const matchAdm = (student.admissionNumber || '').toLowerCase().includes(q);

      if (matchName || matchAdm) {
        matched.push({
          student,
          enrollment: enrollmentMap.get(student.id),
        });
      }

      if (matched.length >= 10) break; // Limit to top 10 matches for performance
    }

    return matched;
  }, [students, enrollmentMap, query]);

  // Handle clicking outside to dismiss dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [results]);

  const handleSelect = (studentId: string) => {
    onSelectStudent(studentId);
    setIsOpen(false);
    setQuery('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || results.length === 0) {
      if (e.key === 'ArrowDown' && results.length > 0) {
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + results.length) % results.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[selectedIndex]) {
        handleSelect(results[selectedIndex].student.id);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Search Input Bar */}
      <div className="relative flex items-center">
        <Search className="absolute left-3.5 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => {
            if (query.trim().length > 0) {
              setIsOpen(true);
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="pl-10 pr-10 h-10 bg-card border-border/80 text-sm shadow-sm transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-xl"
          role="combobox"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-autocomplete="list"
        />

        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setIsOpen(false);
              inputRef.current?.focus();
            }}
            className="absolute right-3.5 h-5 w-5 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label="Clear search"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Instant Live Results Dropdown Popover */}
      {isOpen && query.trim().length > 0 && (
        <div
          role="listbox"
          className="absolute z-50 mt-1.5 w-full rounded-xl border border-border/80 bg-popover p-1.5 text-popover-foreground shadow-xl animate-in fade-in-0 zoom-in-95 duration-100 max-h-96 overflow-y-auto"
        >
          {results.length === 0 ? (
            <div className="py-6 text-center text-xs text-muted-foreground">
              No students found matching <span className="font-semibold text-foreground">"{query}"</span>
            </div>
          ) : (
            <div className="space-y-0.5">
              <div className="px-3 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between border-b border-border/50">
                <span>Search Results ({results.length})</span>
                <span className="text-[10px] font-normal normal-case">Use ↑ ↓ to navigate, Enter to view</span>
              </div>

              {results.map((item, index) => {
                const { student, enrollment } = item;
                const isSelected = index === selectedIndex;

                return (
                  <div
                    key={student.id}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelect(student.id)}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors text-xs ${
                      isSelected
                        ? 'bg-accent text-accent-foreground font-medium'
                        : 'hover:bg-muted/60 text-foreground'
                    }`}
                  >
                    {/* Left: Name and Admission Number */}
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center shrink-0 text-muted-foreground">
                        <User className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0 truncate">
                        <p className="font-semibold text-sm truncate">
                          {student.fullName}
                        </p>
                        <p className="text-[11px] font-mono text-muted-foreground truncate">
                          {student.admissionNumber ? `Adm: ${student.admissionNumber}` : 'No Adm No.'}
                        </p>
                      </div>
                    </div>

                    {/* Right: Medium & Class Pills */}
                    <div className="flex items-center gap-2 shrink-0">
                      {enrollment ? (
                        <>
                          <StudentMediumBadge
                            medium={enrollment.medium}
                            variant="compact"
                            size="xs"
                          />
                          <span className="font-semibold text-[11px] bg-muted/80 text-foreground px-2 py-0.5 rounded border border-border/50">
                            {enrollment.className}
                          </span>
                        </>
                      ) : (
                        <span className="text-[11px] text-muted-foreground italic">
                          Not enrolled in current year
                        </span>
                      )}

                      <ArrowRight className="h-3.5 w-3.5 opacity-40 text-muted-foreground" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
