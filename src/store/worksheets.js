import { addDays, getMondayOf } from './utils.js';

export const WORKSHEET_STATUSES = ['not started', 'in progress', 'submitted', 'graded'];

export function worksheetsDueThisWeek(state, date) {
  const end = addDays(getMondayOf(date), 6);
  return (state.worksheets || [])
    .filter(w => ['not started', 'in progress'].includes(w.status) && w.dueDate <= end)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.name.localeCompare(b.name));
}

export function validateWorksheet(value) {
  if (!value.subjectId || !value.name.trim()) return 'Choose a subject and enter a worksheet name.';
  if (!value.assignedDate || !value.dueDate || value.dueDate < value.assignedDate) return 'Due date must be on or after the assigned date.';
  if (!WORKSHEET_STATUSES.includes(value.status)) return 'Choose a valid status.';
  if (value.status === 'graded' && !String(value.grade || '').trim()) return 'Enter the grade for this graded worksheet.';
  return '';
}
