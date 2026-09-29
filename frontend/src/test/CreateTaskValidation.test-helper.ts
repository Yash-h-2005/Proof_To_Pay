/**
 * Test helper for CreateTask form validation logic.
 * Extracted to avoid importing the full component (which requires routing context).
 */

interface FormData {
  taskId: string;
  packageId: string;
  source: string;
  destination: string;
  reward: string;
}

interface FormErrors {
  taskId?: string;
  packageId?: string;
  source?: string;
  destination?: string;
  reward?: string;
}

export function CreateTaskValidation(data: FormData): FormErrors {
  const errors: FormErrors = {};
  if (!data.taskId.trim()) errors.taskId = 'Task ID is required.';
  else if (!/^[A-Za-z0-9_-]+$/.test(data.taskId.trim()))
    errors.taskId = 'Task ID can only contain letters, numbers, dashes, underscores.';
  if (!data.packageId.trim()) errors.packageId = 'Package ID is required.';
  if (!data.source.trim()) errors.source = 'Source location is required.';
  if (!data.destination.trim()) errors.destination = 'Destination is required.';
  const r = parseFloat(data.reward);
  if (!data.reward || isNaN(r) || r <= 0) errors.reward = 'Reward must be a positive number.';
  return errors;
}
