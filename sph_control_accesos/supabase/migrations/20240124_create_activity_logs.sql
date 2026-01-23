-- Tabla para registrar actividades de usuarios
CREATE TABLE IF NOT EXISTS activity_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    uid UUID REFERENCES auth.users(id),
    activity_type TEXT NOT NULL, -- ej: 'login', 'generate_qr', 'create_visitor'
    description TEXT,
    metadata JSONB DEFAULT '{}'::jsonb, -- Para datos extra (ej: idQR generado, ip, etc)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Políticas de seguridad (RLS)
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- Permitir a usuarios autenticados insertar sus propios logs
CREATE POLICY "Usuarios pueden registrar su actividad" 
ON activity_logs FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = uid);

-- Permitir a usuarios ver sus propios logs (opcional, por si quieres mostrar historial)
CREATE POLICY "Usuarios pueden ver su propia actividad" 
ON activity_logs FOR SELECT 
TO authenticated 
USING (auth.uid() = uid);
