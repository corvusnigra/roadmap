-- Each profile remembers which role's roadmap they're currently studying.
-- Dashboard reads this column to pick the canvas / progress totals.
-- Default is 'frontend-developer' for backfill (the original demo role);
-- new signups inherit the same default via the existing handle_new_user
-- trigger (the column has a hard default).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS active_role_slug TEXT
  NOT NULL
  DEFAULT 'frontend-developer';
