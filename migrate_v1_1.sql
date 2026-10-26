-- SOLO para un proyecto BRÚJULA existente (jamás SUDMAR).
ALTER TABLE public.accounts
 ADD COLUMN IF NOT EXISTS cutoff_tolerance_days integer NOT NULL DEFAULT 2 CHECK (cutoff_tolerance_days BETWEEN 0 AND 3),
 ADD COLUMN IF NOT EXISTS payment_alert_days integer NOT NULL DEFAULT 2 CHECK (payment_alert_days BETWEEN 1 AND 7);
