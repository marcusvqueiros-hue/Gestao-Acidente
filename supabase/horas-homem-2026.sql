-- Horas-homem (HHT) de 2026, janeiro a setembro. Rode no Supabase → SQL Editor → New query → Run.
-- Pode ser rodado de novo: atualiza os valores dos meses que já existem.
insert into public.exposicao (ano, mes, horas) values
  (2026, 1, 164898),
  (2026, 2, 166573),
  (2026, 3, 187738),
  (2026, 4, 178794),
  (2026, 5, 173861),
  (2026, 6, 185758),
  (2026, 7, 190559),
  (2026, 8, 191665),
  (2026, 9, 198496)
on conflict (ano, mes) do update set horas = excluded.horas;

select ano, mes, horas from public.exposicao where ano = 2026 order by mes;
