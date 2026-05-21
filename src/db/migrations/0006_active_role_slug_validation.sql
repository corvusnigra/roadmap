-- Validate `profiles.active_role_slug` at write time. The application-level
-- `setActiveRole` server action already does this, but Supabase REST also
-- accepts PATCH /rest/v1/profiles directly, which bypasses our code path
-- (code-review C2). A BEFORE INSERT/UPDATE trigger closes the gap by
-- enforcing that the slug resolves to a real, published role.
--
-- We keep the column as a plain string (not an FK) because:
--  - Renaming a role is rare and would otherwise cascade-update profiles.
--  - The check needs `status = 'published'`, which an FK can't express.

CREATE OR REPLACE FUNCTION public.assert_active_role_slug_published()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.active_role_slug IS NULL THEN
    RETURN NEW;
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.roles
    WHERE slug = NEW.active_role_slug
      AND status = 'published'
  ) THEN
    RAISE EXCEPTION
      'profiles.active_role_slug % does not resolve to a published role',
      NEW.active_role_slug
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint

DROP TRIGGER IF EXISTS profiles_active_role_slug_check ON public.profiles;
--> statement-breakpoint

CREATE TRIGGER profiles_active_role_slug_check
  BEFORE INSERT OR UPDATE OF active_role_slug ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.assert_active_role_slug_published();
