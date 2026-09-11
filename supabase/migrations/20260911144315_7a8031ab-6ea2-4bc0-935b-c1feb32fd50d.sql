drop policy if exists "Autenticados leem model_pricing" on public.model_pricing;
create policy "Admins leem model_pricing"
on public.model_pricing
for select
to authenticated
using (is_any_admin(auth.uid()));