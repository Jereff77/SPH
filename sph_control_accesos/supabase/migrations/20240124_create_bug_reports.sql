-- Tabla para almacenar reportes de bugs y sugerencias
CREATE TABLE IF NOT EXISTS reportes_bugs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    uid UUID REFERENCES auth.users(id),
    descripcion TEXT NOT NULL,
    fecha TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    estado TEXT DEFAULT 'pendiente', -- pendiente, revisado, resuelto
    version_app TEXT,
    plataforma TEXT,
    contacto TEXT -- Email o teléfono opcional
);

-- Políticas de seguridad (RLS)
ALTER TABLE reportes_bugs ENABLE ROW LEVEL SECURITY;

-- Permitir a usuarios autenticados crear reportes
CREATE POLICY "Usuarios pueden crear reportes" 
ON reportes_bugs FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = uid);

-- Permitir a usuarios ver sus propios reportes
CREATE POLICY "Usuarios pueden ver sus propios reportes" 
ON reportes_bugs FOR SELECT 
TO authenticated 
USING (auth.uid() = uid);
