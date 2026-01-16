// Versión simplificada del script de diagnóstico para la tabla naves
// Uso: node diagnosticar_simple.js

const { Client } = require('pg');
require('dotenv').config();

// Configuración de la conexión a la base de datos
const connectionString = `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`;

const client = new Client({
  connectionString: connectionString,
  ssl: { rejectUnauthorized: false }
});

// Mostrar configuración (sin contraseña)
console.log('🔧 Configuración de conexión:');
console.log(`Cadena de conexión: postgresql://${process.env.DB_USER}:***@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`);

async function diagnosticarSimple() {
  try {
    console.log('🔌 Conectando a la base de datos...');
    await client.connect();
    console.log('✅ Conectado a la base de datos');

    // 1. Verificar autenticación
    console.log('\n🔍 Paso 1: Verificando autenticación');
    const authResult = await client.query('SELECT auth.uid() as uid_usuario');
    console.log('Resultado:', authResult.rows[0]);
    
    // 2. Verificar usuario en catUsers
    console.log('\n🔍 Paso 2: Verificando usuario en catUsers');
    const userResult = await client.query('SELECT uid, status, parques FROM "catUsers" LIMIT 5');
    console.log('Usuarios encontrados:', userResult.rows.length);
    console.log('Primeros usuarios:', userResult.rows);
    
    // 3. Verificar política RLS
    console.log('\n🔍 Paso 3: Verificando políticas RLS');
    const policyResult = await client.query("SELECT * FROM pg_policies WHERE tablename = 'naves'");
    console.log('Políticas encontradas:', policyResult.rows);
    
    // 4. Intentar consultar naves
    console.log('\n🔍 Paso 4: Intentando consultar naves');
    const navesResult = await client.query('SELECT COUNT(*) as total FROM naves LIMIT 1');
    console.log('Resultado de consulta a naves:', navesResult.rows[0]);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Código:', error.code);
    console.error('Detalle:', error.detail);
  } finally {
    await client.end();
    console.log('\n🔚 Conexión cerrada');
  }
}

// Ejecutar el diagnóstico
console.log('🚀 Iniciando diagnóstico simplificado...');
diagnosticarSimple();