-- When a row is inserted into auth.users (signup, magic-link first visit,
-- OAuth first visit, etc.), automatically create the matching public.profiles
-- row. The trigger runs as SECURITY DEFINER so it can bypass RLS on profiles;
-- search_path is locked to '' to prevent search-path-based escalation.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, timezone)
  VALUES (
    NEW.id,
    NULLIF(NEW.raw_user_meta_data ->> 'display_name', ''),
    COALESCE(NULLIF(NEW.raw_user_meta_data ->> 'timezone', ''), 'UTC')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
--> statement-breakpoint

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
--> statement-breakpoint

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
