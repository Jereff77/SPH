-- ============================================================================
-- 2026-11-02 · Relleno del subtotal de las solicitudes PPD (cxp) y de sus facturas (cxp_ppd)
-- Plan: version2/base-conocimiento/PLAN-correccion-subtotal-ppd.md · Autoriza: Jereff (2026-11-02)
-- Respaldo previo: temp/respaldos/respaldo-cxp-2026-11-02.csv (2,348 filas) y respaldo-cxp_ppd-2026-11-02.csv (204 filas)
-- Subtotal = BASE del gasto = SubTotal del CFDI - Descuento (antes de retenciones) (decisión D1).
-- Se ejecuta en DOS bloques independientes (cada DO es atómico y aborta si una guarda falla):
--   BLOQUE A: 172 filas con subtotal NULL + 3 en 0 (editar()) = 175 filas; copia cxp_ppd.subtotal. Además 2 facturas con descuento (D1).
--   BLOQUE B: 23 facturas heredadas (migración v2 del 2026-06-17) y sus 24 pagos, leyendo el XML (D6).
-- FUERA a propósito: IfXf7vkKbRWlY8X (USD) y JC3FjLXdjjw75Xy (XXX) (D8, pendiente #79);
--   mig56035e79540a (TUNECO) y mig57c4d5806bd0 (no cuadran con su XML; revisión de Jereff).
-- NO se agrega NOT NULL aquí: va DESPUÉS de desplegar el código y de volver a correr el bloque A (idempotente).
-- ============================================================================

-- ===== BLOQUE A =====
DO $mig$
DECLARE n integer;
BEGIN
  PERFORM set_config('lock_timeout','5s',true);
  PERFORM set_config('statement_timeout','60s',true);

  -- Guardas previas
  SELECT count(*) INTO n FROM public.cxp WHERE subtotal IS NULL;
  IF n <> 174 THEN RAISE EXCEPTION 'A: se esperaban 174 filas con subtotal NULL y hay %', n; END IF;
  SELECT count(*) INTO n FROM public.cxp WHERE subtotal IS NULL AND diferido AND "idCxpPPD" IS NOT NULL;
  IF n <> 174 THEN RAISE EXCEPTION 'A: las 174 NULL no son todas PPD (%)', n; END IF;
  SELECT count(*) INTO n FROM public.cxp WHERE "idCxp" IN ('wULNpbpQUEWh9nh','rcJJWDUdp96u0JP','v627XjI1hrm5Z99') AND subtotal = 0 AND diferido AND "idCxpPPD" IS NOT NULL;
  IF n <> 3 THEN RAISE EXCEPTION 'A: las 3 filas en 0 no coinciden (%)', n; END IF;

  -- D1: facturas con descuento (base = SubTotal - Descuento)
  UPDATE public.cxp_ppd SET subtotal = 18900 WHERE "idCxpPPD" = 'UYuTcvExkxX1dp8' AND subtotal = 25200 AND total = 21924;
  GET DIAGNOSTICS n = ROW_COUNT; IF n <> 1 THEN RAISE EXCEPTION 'A: D1 UYuTcvExkxX1dp8 (%)', n; END IF;
  UPDATE public.cxp_ppd SET subtotal = 24039 WHERE "idCxpPPD" = 'bjdmfgCsIrlzVrX' AND subtotal = 27930 AND total = 27885.24;
  GET DIAGNOSTICS n = ROW_COUNT; IF n <> 1 THEN RAISE EXCEPTION 'A: D1 bjdmfgCsIrlzVrX (%)', n; END IF;

  -- Relleno: copia el subtotal de la factura (el pago es del 100 %)
  UPDATE public.cxp c SET subtotal = m.subtotal
  FROM public.cxp_ppd m
  WHERE m."idCxpPPD" = c."idCxpPPD"
    AND c."idCxp" = ANY (ARRAY['03WQvcjQSnvSAhl','0FkOas6WOjHvZ94','0He0452PEuHehHw','0McoztLXJgHth1O','1BUaqGqUeNYZ0SP','1MTF4HqxfY1WsHg','1RCseRlL1DufAAe','1YwnhGBvriFxDeh','2j3sElbhHRTwpuJ','3qKkEvNYSYv5kxh','3tW4ic3XZ1iUsFH','45lUaQ0od1B6GIT','4K1uRAvR9Uvfnov','4qF0wm6cVfNaFWZ','5EGw8iyf77EsEtz','6NjnKBr4XoapPCc','6arA0LletyCVhCu','6jPKFqIHQlEpiYO','6kH0DkXbxcAEWHR','6ttrX02sKJvmZ4m','6xPnpD8cgVE13oC','71gKon2BL495j1v','7Ls4PVOUab5CNRA','8FGVpWY0XmnK0bu','8OzH2n0GW6FEHOL','8PZvc8UZFJ9BFMb','9nGLzzbBC678Vdj','ABWQZ6x9qVmkRtc','ARiTzwAGpbjKHbd','AfHQ9gbzb2pJf93','ArJmRzio7SROFMu','BJm6IzHAoXhjWt9','Bes5a3LxzRltBSn','Bi1BU7s0vVHN4th','BpIzjGjXvoiaNWP','C8GNgUIui2ZFuFn','CEkktfHU3VplLFP','CIf7XB4iZoCZt2U','CPnmStxKUJK3NDz','DGnB3nPeMT8xSKG','DlvbFPfOcGdEsgw','E1Unl07kMe4phqf','EB0nKEehh2DyHEs','EtXgzZbNZ9BN28f','EzAqqb9FfD5HgSL','F6GvEcgugTY6zcl','G463YKr2Kfch5VH','G7G6TLFCmi3HLGQ','G92SFdfoJuDFoTx','GFEiar90sA80BBN','GPNUCx4Vmu28vwC','Go3qBsJUjDebOZZ','GrXZdM4LVCYzKMU','IPcIuZH0OmZkbRn','IjEFxEOqXxaHRRT','ImEkriIrzCWAGVb','ItbmWyGbtcTBCHI','JHWso5BrFIOMkuf','JJbJRhNXbHJVkr3','Jwat1pJqGuuDPL1','Kx9lohGBGDtVQ1w','LtNgPO7HfThBcHs','MAqcO9PJVZoIhtx','MXn5Z4qrCYbHgIH','MwqUY9ZddQDI5ix','MzevLOml4NkqTHG','NJeHHm24GtNl2oZ','OFEchzKzNkS6msD','OW0aGs3uAsAibDN','PQ6dqx1kv2isHjn','PYwEGZGMPpnAFhp','PwSOeE1SJHoeOdX','QDitjFlejOa175k','R9AakDOeTzf8ZJK','Ri8lTy6HjPXADeO','S8BlDgQf9yOHVDK','SFGLqV4dBA7WIQZ','SdhzlY1PAAKBwpE','TDAlWXIA6dF2p9S','TDFfWrHsJxXaorn','U93Hr7ORAlPIZvA','UMSThEdSPjwXu3T','UO2fnvYxyqL3XbM','Uv9dmec7ztNKNGN','V92EDSVdqb4owzv','Vif5lJKfPbvQSZF','WEaArVUJ0Nx0ces','WGZrbmBXeGhj5LS','WZnJVeK5T1otSb3','Wra23vQVcuDVbgT','XMJs799d8cGOdNa','Y4BO5pIkV6WO295','YQwEIsFI5JQzFph','YRXi9MFVkKJQ4xK','YeJ3joeHuf0uHOC','ZD5jrAMJn47Ck4U','ZTgemjJeL7E5vpS','aB1qX89K8rGVD7T','aJ56uSkBkh9yFJn','bBUB7R7OCfmAZni','bDJ3h0HMdbBcoIy','bmiSWZznM1Bj6Oy','bvi3wGo8qa7JJBZ','cJitjInmpvj3xTx','d3xokZ1f33Rrczt','dDvE5Z0aIz4QaYR','dFoHfiN0BaYfQAf','dLradgZhIfYLdvO','dnabRPcdmW9WixF','dnhYsFeVAPlugen','doqDlK9OW47XI5t','eGlGnfDlizsE2fm','eboKBa26rXNhZNW','f0lqkrUUrpr7fEE','fDFMpu7uObzHeBx','fGYqxw5DHJCkAkL','fNL9jkp66K0V9Bu','ffxHAj6MKZs8cLz','foRvJZkAbNJlxsq','glBEAwq7RaPN59X','hJ6odIERxurWFVK','iMBw20TJi2pEx53','iVYAahPjRD0ujS0','idbCaPLLhJXE20C','jGMvqDhzyBQJIeL','jMECaedP3Pob5vd','jR8SjMV6XRroHAT','jhV2xvvOYHlnkDT','k9e4nrEdD59Slhc','kGqh99smmB5hFZQ','kLuqfQvHfrUTGLu','klfVoA56hDBeBSS','kpJ1y1PAz6vk624','kqd7yGDhLQwfknX','lL6SXzuf9UN625M','mnfbG7uGYQaQvWS','n3g5PAzb4BVczDi','o1wIAbB3aSfoveI','oS1dO6bAbeCeH9V','oUEdclbf9TIWjHP','oXjvbHRem9oDFiM','oqI67ib3BPkYLrt','oxPcs00ZiwYYEZc','pcizPms7wbhZMOJ','qHhbnNQYgOGj4XJ','qlZn66JhOIaSpvZ','rcJJWDUdp96u0JP','rr8yHdq4BQ3gWwU','s1VnjbM0B3nTYGS','s5tsEwahFKhNyBU','sR7TRcUfJwivCzD','sml5vFmIseYEDDH','squgLpS2MlaeaKt','t4EgazkQMLwqTqX','t957LXEbLcuv7Ce','tDBzm7Bf4XqAKyA','tGKOZVKO5sJn2Ho','tY1hogEgwauFLF0','tf7AtVgi5FWWoJi','uVvk6bT3CsvlBHm','uaap8k7tU7ZnFDA','udqKix7C06nQevJ','ufQ7CrN6zJkZg2s','v5eWgLM9X4ecE4n','v627XjI1hrm5Z99','viE6kM9SuSLCRZN','vuESKm03eOnmps8','w40ctAEUeQaWCNY','wULNpbpQUEWh9nh','xA0b3DSXcveru3r','y5aRc3bF0gaKYYj','yGChS1NknvhHVjQ','yiP4mPv31bYzYEl','yjDxglDYh9XytEv','zA8C0xFugR14R1O'])
    AND (c.subtotal IS NULL OR c.subtotal = 0)
    AND c.diferido AND c."idCxpPPD" IS NOT NULL
    AND c.moneda = 'MXN' AND NOT c.tdc
    AND m.subtotal > 0
    AND abs(c.total - m.total) <= 0.01;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 175 THEN RAISE EXCEPTION 'A: se esperaban 175 filas actualizadas y fueron %', n; END IF;
END
$mig$;

-- ===== BLOQUE B =====
DO $mig$
DECLARE n integer;
BEGIN
  PERFORM set_config('lock_timeout','5s',true);
  PERFORM set_config('statement_timeout','60s',true);

  UPDATE public.cxp_ppd m SET subtotal = v.base
  FROM (VALUES ('mig063862f89329',41895.0),('mig110f5f1f374a',16365.73),('mig282a40af2504',4700.0),('mig2e4208779e21',4700.0),('mig307b7265e54b',2861.11),('mig4ddc8219b67d',4700.0),('mig54bce261e4ae',4700.0),('mig618d12c03cda',17200.0),('mig6cbfa911ca35',23500.0),('mig78ea833062b8',4700.0),('mig90edb2466a91',4700.0),('mig9a3397fd40db',11845.36),('migb4e577b58b5f',2000000.0),('migbb20c3bf44a8',23500.0),('migc073dd596c58',10800.0),('migc9acf260eed5',4700.0),('migd1922d83d507',4700.0),('migdf08a91f9b96',2000000.0),('mige114ae9ee81a',4700.0),('mige487f8ab2111',51409.1),('migebb70c0325c4',4700.0),('migf002963de40a',164.92),('migfa5007eec277',11845.36)) AS v(id, base)
  WHERE m."idCxpPPD" = v.id AND m.subtotal = 0;
  GET DIAGNOSTICS n = ROW_COUNT; IF n <> 23 THEN RAISE EXCEPTION 'B: maestros esperados 23 y fueron %', n; END IF;

  UPDATE public.cxp c SET subtotal = v.sub
  FROM (VALUES ('S1ClgQP0SHrNtoB',41895.0),('dFHAlb6wpvtPCjm',16365.73),('TPp7UVtdAIv9RRL',4700.0),('n2m6xgqavYRmXcO',4700.0),('pDu4hZR9TTduVeg',2861.11),('qJXgpBv3lsS5dbi',4700.0),('msw0VLOryYVrTSD',4700.0),('OFfVmMRBjxWlpPd',17200.0),('Adx800WuyDqfd6e',23500.0),('KGH1bJv60XgH9su',4700.0),('r8Pv4Zki54AXdHF',4700.0),('Hu2soqEbYPn8HEi',11845.36),('TPWggLpmvFXzt3K',2000000.0),('34jYE3e46sRmihA',23500.0),('Ws5LXcPfZhXiKPj',5400.0),('WVZFkWo0xasZKOa',5400.0),('e5MYkpMpJYoVIi6',4700.0),('CUFm1X6qrTeI1PK',4700.0),('GXJ3jZwm9QEFiuM',2000000.0),('s3VGIOVOsxizA32',4700.0),('R1Bo3RU7p7MgaTa',51409.1),('YUKFBaaBW41OcxB',4700.0),('pYX0p98KEmGK8ao',164.92),('YSmS4WYo867R0AS',11845.36)) AS v(id, sub)
  WHERE c."idCxp" = v.id AND c.subtotal = 0 AND c.diferido AND c.moneda = 'MXN';
  GET DIAGNOSTICS n = ROW_COUNT; IF n <> 24 THEN RAISE EXCEPTION 'B: pagos esperados 24 y fueron %', n; END IF;
END
$mig$;

-- ============================================================================
-- REVERSA (ejecutar en este orden; devuelve el estado previo exacto)
-- ============================================================================
-- DO $rev$ BEGIN
--   UPDATE public.cxp SET subtotal = NULL WHERE "idCxp" = ANY (ARRAY['03WQvcjQSnvSAhl','0FkOas6WOjHvZ94','0He0452PEuHehHw','0McoztLXJgHth1O','1BUaqGqUeNYZ0SP','1MTF4HqxfY1WsHg','1RCseRlL1DufAAe','1YwnhGBvriFxDeh','2j3sElbhHRTwpuJ','3qKkEvNYSYv5kxh','3tW4ic3XZ1iUsFH','45lUaQ0od1B6GIT','4K1uRAvR9Uvfnov','4qF0wm6cVfNaFWZ','5EGw8iyf77EsEtz','6NjnKBr4XoapPCc','6arA0LletyCVhCu','6jPKFqIHQlEpiYO','6kH0DkXbxcAEWHR','6ttrX02sKJvmZ4m','6xPnpD8cgVE13oC','71gKon2BL495j1v','7Ls4PVOUab5CNRA','8FGVpWY0XmnK0bu','8OzH2n0GW6FEHOL','8PZvc8UZFJ9BFMb','9nGLzzbBC678Vdj','ABWQZ6x9qVmkRtc','ARiTzwAGpbjKHbd','AfHQ9gbzb2pJf93','ArJmRzio7SROFMu','BJm6IzHAoXhjWt9','Bes5a3LxzRltBSn','Bi1BU7s0vVHN4th','BpIzjGjXvoiaNWP','C8GNgUIui2ZFuFn','CEkktfHU3VplLFP','CIf7XB4iZoCZt2U','CPnmStxKUJK3NDz','DGnB3nPeMT8xSKG','DlvbFPfOcGdEsgw','E1Unl07kMe4phqf','EB0nKEehh2DyHEs','EtXgzZbNZ9BN28f','EzAqqb9FfD5HgSL','F6GvEcgugTY6zcl','G463YKr2Kfch5VH','G7G6TLFCmi3HLGQ','G92SFdfoJuDFoTx','GFEiar90sA80BBN','GPNUCx4Vmu28vwC','Go3qBsJUjDebOZZ','GrXZdM4LVCYzKMU','IPcIuZH0OmZkbRn','IjEFxEOqXxaHRRT','ImEkriIrzCWAGVb','ItbmWyGbtcTBCHI','JHWso5BrFIOMkuf','JJbJRhNXbHJVkr3','Jwat1pJqGuuDPL1','Kx9lohGBGDtVQ1w','LtNgPO7HfThBcHs','MAqcO9PJVZoIhtx','MXn5Z4qrCYbHgIH','MwqUY9ZddQDI5ix','MzevLOml4NkqTHG','NJeHHm24GtNl2oZ','OFEchzKzNkS6msD','OW0aGs3uAsAibDN','PQ6dqx1kv2isHjn','PYwEGZGMPpnAFhp','PwSOeE1SJHoeOdX','QDitjFlejOa175k','R9AakDOeTzf8ZJK','Ri8lTy6HjPXADeO','S8BlDgQf9yOHVDK','SFGLqV4dBA7WIQZ','SdhzlY1PAAKBwpE','TDAlWXIA6dF2p9S','TDFfWrHsJxXaorn','U93Hr7ORAlPIZvA','UMSThEdSPjwXu3T','UO2fnvYxyqL3XbM','Uv9dmec7ztNKNGN','V92EDSVdqb4owzv','Vif5lJKfPbvQSZF','WEaArVUJ0Nx0ces','WGZrbmBXeGhj5LS','WZnJVeK5T1otSb3','Wra23vQVcuDVbgT','XMJs799d8cGOdNa','Y4BO5pIkV6WO295','YQwEIsFI5JQzFph','YRXi9MFVkKJQ4xK','YeJ3joeHuf0uHOC','ZD5jrAMJn47Ck4U','ZTgemjJeL7E5vpS','aB1qX89K8rGVD7T','aJ56uSkBkh9yFJn','bBUB7R7OCfmAZni','bDJ3h0HMdbBcoIy','bmiSWZznM1Bj6Oy','bvi3wGo8qa7JJBZ','cJitjInmpvj3xTx','d3xokZ1f33Rrczt','dDvE5Z0aIz4QaYR','dFoHfiN0BaYfQAf','dLradgZhIfYLdvO','dnabRPcdmW9WixF','dnhYsFeVAPlugen','doqDlK9OW47XI5t','eGlGnfDlizsE2fm','eboKBa26rXNhZNW','f0lqkrUUrpr7fEE','fDFMpu7uObzHeBx','fGYqxw5DHJCkAkL','fNL9jkp66K0V9Bu','ffxHAj6MKZs8cLz','foRvJZkAbNJlxsq','glBEAwq7RaPN59X','hJ6odIERxurWFVK','iMBw20TJi2pEx53','iVYAahPjRD0ujS0','idbCaPLLhJXE20C','jGMvqDhzyBQJIeL','jMECaedP3Pob5vd','jR8SjMV6XRroHAT','jhV2xvvOYHlnkDT','k9e4nrEdD59Slhc','kGqh99smmB5hFZQ','kLuqfQvHfrUTGLu','klfVoA56hDBeBSS','kpJ1y1PAz6vk624','kqd7yGDhLQwfknX','lL6SXzuf9UN625M','mnfbG7uGYQaQvWS','n3g5PAzb4BVczDi','o1wIAbB3aSfoveI','oS1dO6bAbeCeH9V','oUEdclbf9TIWjHP','oXjvbHRem9oDFiM','oqI67ib3BPkYLrt','oxPcs00ZiwYYEZc','pcizPms7wbhZMOJ','qHhbnNQYgOGj4XJ','qlZn66JhOIaSpvZ','rr8yHdq4BQ3gWwU','s1VnjbM0B3nTYGS','s5tsEwahFKhNyBU','sR7TRcUfJwivCzD','sml5vFmIseYEDDH','squgLpS2MlaeaKt','t4EgazkQMLwqTqX','t957LXEbLcuv7Ce','tDBzm7Bf4XqAKyA','tGKOZVKO5sJn2Ho','tY1hogEgwauFLF0','tf7AtVgi5FWWoJi','uVvk6bT3CsvlBHm','uaap8k7tU7ZnFDA','udqKix7C06nQevJ','ufQ7CrN6zJkZg2s','v5eWgLM9X4ecE4n','viE6kM9SuSLCRZN','vuESKm03eOnmps8','w40ctAEUeQaWCNY','xA0b3DSXcveru3r','y5aRc3bF0gaKYYj','yGChS1NknvhHVjQ','yiP4mPv31bYzYEl','yjDxglDYh9XytEv','zA8C0xFugR14R1O']);
--   UPDATE public.cxp SET subtotal = 0   WHERE "idCxp" = ANY (ARRAY['wULNpbpQUEWh9nh','rcJJWDUdp96u0JP','v627XjI1hrm5Z99']);
--   UPDATE public.cxp SET subtotal = 0   WHERE "idCxp" = ANY (ARRAY['S1ClgQP0SHrNtoB','dFHAlb6wpvtPCjm','TPp7UVtdAIv9RRL','n2m6xgqavYRmXcO','pDu4hZR9TTduVeg','qJXgpBv3lsS5dbi','msw0VLOryYVrTSD','OFfVmMRBjxWlpPd','Adx800WuyDqfd6e','KGH1bJv60XgH9su','r8Pv4Zki54AXdHF','Hu2soqEbYPn8HEi','TPWggLpmvFXzt3K','34jYE3e46sRmihA','Ws5LXcPfZhXiKPj','WVZFkWo0xasZKOa','e5MYkpMpJYoVIi6','CUFm1X6qrTeI1PK','GXJ3jZwm9QEFiuM','s3VGIOVOsxizA32','R1Bo3RU7p7MgaTa','YUKFBaaBW41OcxB','pYX0p98KEmGK8ao','YSmS4WYo867R0AS']);
--   UPDATE public.cxp_ppd SET subtotal = 25200 WHERE "idCxpPPD" = 'UYuTcvExkxX1dp8';
--   UPDATE public.cxp_ppd SET subtotal = 27930 WHERE "idCxpPPD" = 'bjdmfgCsIrlzVrX';
--   UPDATE public.cxp_ppd SET subtotal = 0 WHERE "idCxpPPD" = ANY (ARRAY['mig063862f89329','mig110f5f1f374a','mig282a40af2504','mig2e4208779e21','mig307b7265e54b','mig4ddc8219b67d','mig54bce261e4ae','mig618d12c03cda','mig6cbfa911ca35','mig78ea833062b8','mig90edb2466a91','mig9a3397fd40db','migb4e577b58b5f','migbb20c3bf44a8','migc073dd596c58','migc9acf260eed5','migd1922d83d507','migdf08a91f9b96','mige114ae9ee81a','mige487f8ab2111','migebb70c0325c4','migf002963de40a','migfa5007eec277']);
-- END $rev$;
