-- REVERSA de M-PPD-2 (corrección de datos): restaura el subtotal anterior de las 44 parcialidades PPD que toca.
-- Generado el 2026-11-17 desde la base ANTES de aplicar (los valores vigentes de entonces). Va DESPUÉS de quitar el trigger
-- (DROP TRIGGER trg_cxp_ppd_subtotal), si no el trigger volvería a calcular el subtotal.
-- 18 filas pagadas sin subtotal (NULL) y 26 no pagadas / dadas de baja que tenían subtotal.
SET LOCAL lock_timeout = '5s';
UPDATE public.cxp SET subtotal = NULL WHERE "idCxp" = '0Xi8OqGoXElPKMR';
UPDATE public.cxp SET subtotal = 19500 WHERE "idCxp" = '1BUaqGqUeNYZ0SP';
UPDATE public.cxp SET subtotal = 4089.97 WHERE "idCxp" = '2j3sElbhHRTwpuJ';
UPDATE public.cxp SET subtotal = 23500 WHERE "idCxp" = '34jYE3e46sRmihA';
UPDATE public.cxp SET subtotal = 12500 WHERE "idCxp" = '3tW4ic3XZ1iUsFH';
UPDATE public.cxp SET subtotal = 8000 WHERE "idCxp" = '6xPnpD8cgVE13oC';
UPDATE public.cxp SET subtotal = 23500 WHERE "idCxp" = 'Adx800WuyDqfd6e';
UPDATE public.cxp SET subtotal = NULL WHERE "idCxp" = 'aLgfZdPXuZhuOtE';
UPDATE public.cxp SET subtotal = 12500 WHERE "idCxp" = 'ArJmRzio7SROFMu';
UPDATE public.cxp SET subtotal = NULL WHERE "idCxp" = 'CebbFs8hcmzcOxz';
UPDATE public.cxp SET subtotal = 23500 WHERE "idCxp" = 'CPnmStxKUJK3NDz';
UPDATE public.cxp SET subtotal = 4700 WHERE "idCxp" = 'e5MYkpMpJYoVIi6';
UPDATE public.cxp SET subtotal = NULL WHERE "idCxp" = 'ecXG8OFZBzU0m14';
UPDATE public.cxp SET subtotal = NULL WHERE "idCxp" = 'EPwjUSQAfDuL3pN';
UPDATE public.cxp SET subtotal = NULL WHERE "idCxp" = 'eTvtQOa7dVK0ods';
UPDATE public.cxp SET subtotal = 10142.84 WHERE "idCxp" = 'fDFMpu7uObzHeBx';
UPDATE public.cxp SET subtotal = NULL WHERE "idCxp" = 'Gjo8XkR9aNhvdR9';
UPDATE public.cxp SET subtotal = NULL WHERE "idCxp" = 'GqcpYiALlH2S0dU';
UPDATE public.cxp SET subtotal = 13000 WHERE "idCxp" = 'GrXZdM4LVCYzKMU';
UPDATE public.cxp SET subtotal = 2000000 WHERE "idCxp" = 'GXJ3jZwm9QEFiuM';
UPDATE public.cxp SET subtotal = 11845.36 WHERE "idCxp" = 'Hu2soqEbYPn8HEi';
UPDATE public.cxp SET subtotal = NULL WHERE "idCxp" = 'ITbCJYsJQQWzg2D';
UPDATE public.cxp SET subtotal = 23500 WHERE "idCxp" = 'iVYAahPjRD0ujS0';
UPDATE public.cxp SET subtotal = 4700 WHERE "idCxp" = 'KGH1bJv60XgH9su';
UPDATE public.cxp SET subtotal = 784330 WHERE "idCxp" = 'kqd7yGDhLQwfknX';
UPDATE public.cxp SET subtotal = NULL WHERE "idCxp" = 'mKQsf4fSM6UOSx6';
UPDATE public.cxp SET subtotal = 17200 WHERE "idCxp" = 'OFfVmMRBjxWlpPd';
UPDATE public.cxp SET subtotal = 16320 WHERE "idCxp" = 'oXjvbHRem9oDFiM';
UPDATE public.cxp SET subtotal = 9216.5 WHERE "idCxp" = 'PYwEGZGMPpnAFhp';
UPDATE public.cxp SET subtotal = 164.92 WHERE "idCxp" = 'QDitjFlejOa175k';
UPDATE public.cxp SET subtotal = 40000 WHERE "idCxp" = 's5tsEwahFKhNyBU';
UPDATE public.cxp SET subtotal = NULL WHERE "idCxp" = 'SV0nV9Ysh2KScM7';
UPDATE public.cxp SET subtotal = NULL WHERE "idCxp" = 'TQcH3sDJcdjEIl6';
UPDATE public.cxp SET subtotal = NULL WHERE "idCxp" = 'Tu5y6ZZ1NkYywls';
UPDATE public.cxp SET subtotal = NULL WHERE "idCxp" = 'U4njTtN0annigFD';
UPDATE public.cxp SET subtotal = NULL WHERE "idCxp" = 'vCsopPCGOTzbMfO';
UPDATE public.cxp SET subtotal = NULL WHERE "idCxp" = 'vHgOOS2Act6EdWy';
UPDATE public.cxp SET subtotal = 1000 WHERE "idCxp" = 'Vif5lJKfPbvQSZF';
UPDATE public.cxp SET subtotal = NULL WHERE "idCxp" = 'vKLqL1SY6Le7vkX';
UPDATE public.cxp SET subtotal = 841801.7 WHERE "idCxp" = 'xA0b3DSXcveru3r';
UPDATE public.cxp SET subtotal = 13255 WHERE "idCxp" = 'yjDxglDYh9XytEv';
UPDATE public.cxp SET subtotal = 11845.36 WHERE "idCxp" = 'YSmS4WYo867R0AS';
UPDATE public.cxp SET subtotal = NULL WHERE "idCxp" = 'zKIYC6uf7OGNkEn';
