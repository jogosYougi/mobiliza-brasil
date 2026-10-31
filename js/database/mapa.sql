-- =====================================================================
--  MOBILIZA BRASIL — Módulo "Mapa interativo"
--  RODE no SQL Editor do Supabase (depois do schema.sql). Pode rodar mais de uma vez.
--
--  Guarda o ponto usado para desenhar a cidade no mapa. É separado de lat/lng
--  (que continuam sendo só a localização exata informada por quem cadastrou e
--  usada no botão "Ver no mapa").
--  Sem rodar este arquivo o site continua funcionando: o mapa apenas acha as
--  cidades pelo nome, mais devagar.
-- =====================================================================

alter table public.mobilizations
  add column if not exists map_lat double precision check (map_lat between -90  and 90),
  add column if not exists map_lng double precision check (map_lng between -180 and 180);
