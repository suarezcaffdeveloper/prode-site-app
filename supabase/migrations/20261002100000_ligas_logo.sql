-- Logo opcional de cada liga, para diferenciarlas visualmente en el catálogo.
-- La imagen vive en el bucket público "escudos" (bajo el prefijo "ligas/"),
-- que ya tiene lectura pública y escritura solo para admin; acá se guarda
-- únicamente la URL pública. Los grants a nivel tabla ya cubren la columna.
alter table public.ligas
  add column logo_url text;
