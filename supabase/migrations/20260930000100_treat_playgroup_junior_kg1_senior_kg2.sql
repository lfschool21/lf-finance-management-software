-- Migration: Treat Playgroup and Junior KG as KG1, and Senior KG as KG2 across student enrollments

-- 1. Update Playgroup / Junior KG to KG1 (preserving section suffixes if any)
UPDATE public.student_enrollments
SET class_name = CASE
  WHEN trim(class_name) ~* '[-_\s]+([a-zA-Z])$' THEN
    'KG1 ' || upper(substring(trim(class_name) from '[-_\s]+([a-zA-Z])$'))
  ELSE
    'KG1'
END
WHERE lower(trim(class_name)) ~* '^(?:play[-_\s]*group|playgroup|pg|junior[-_\s]*kg|junior|jr\.?[-_\s]*kg|jr|lkg|lower[-_\s]*kg|kg[-_\s]*1)(?:[-_\s]+[a-zA-Z])?$';

-- 2. Update Senior KG to KG2 (preserving section suffixes if any)
UPDATE public.student_enrollments
SET class_name = CASE
  WHEN trim(class_name) ~* '[-_\s]+([a-zA-Z])$' THEN
    'KG2 ' || upper(substring(trim(class_name) from '[-_\s]+([a-zA-Z])$'))
  ELSE
    'KG2'
END
WHERE lower(trim(class_name)) ~* '^(?:senior[-_\s]*kg|senior|sr\.?[-_\s]*kg|sr|ukg|upper[-_\s]*kg|kg[-_\s]*2|kg)(?:[-_\s]+[a-zA-Z])?$';
