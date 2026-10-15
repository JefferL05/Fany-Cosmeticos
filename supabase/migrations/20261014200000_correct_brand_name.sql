-- Update existing catalog entries as well as the seed used by new installations.
update public.products
set details = jsonb_set(details, '{brand}', '"Fany Lab"'::jsonb)
where details->>'brand' = 'Fanny Lab';
