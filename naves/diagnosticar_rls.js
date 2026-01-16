// Script para diagnosticar problemas con la política RLS de la tabla naves
// Uso: node diagnosticar_rls.js
// Requiere: npm install pg dotenv

const { Client } = require('pg');
require('dotenv').config();

// Configuración de la conexión a la base de datos
const client = new Client({
  host: process.env.DB_HOST || 'tu_host',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'tu_base_de_datos',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false }
});

async function diagnosticarRLS() {
  try {
    // Conectar a la base de datos
    await client.connect();
    console.log('✅ Conectado a la base de datos');

    // 1. Verificar autenticación del usuario
    console.log('\n🔍 Paso 1: Verificando autenticación del usuario');
    const authResult = await client.query('SELECT auth.uid() as uid_usuario');
    const uidUsuario = authResult.rows[0].uid_usuario;
    console.log('UID del usuario:', uidUsuario);

    if (!uidUsuario) {
      console.log('❌ El usuario no está autenticado');
      return;
    }

    // 2. Verificar si el usuario existe en catUsers
    console.log('\n🔍 Paso 2: Verificando si el usuario existe en catUsers');
    const userResult = await client.query(
      'SELECT uid, status, parques FROM "catUsers" WHERE uid = $1',
      [uidUsuario]
    );

    if (userResult.rows.length === 0) {
      console.log('❌ El usuario no existe en la tabla catUsers');
      return;
    }

    const userInfo = userResult.rows[0];
    console.log('✅ Usuario encontrado en catUsers');
    console.log('Estado:', userInfo.status);
    console.log('Parques asignados:', userInfo.parques);
    console.log('Tipo de datos de parques:', typeof userInfo.parques);

    // 3. Verificar estructura de los parques
    console.log('\n🔍 Paso 3: Analizando estructura de los parques asignados');
    if (userInfo.parques) {
      try {
        const parquesObj = typeof userInfo.parques === 'string' 
          ? JSON.parse(userInfo.parques) 
          : userInfo.parques;
        
        console.log('Parques como objeto:', parquesObj);
        console.log('¿Es array?', Array.isArray(parquesObj));
        
        if (Array.isArray(parquesObj)) {
          console.log('Total de parques:', parquesObj.length);
          if (parquesObj.length > 0) {
            console.log('Ejemplo de parque:', parquesObj[0]);
          }
        }
      } catch (e) {
        console.log('❌ Error al parsear los parques:', e.message);
      }
    } else {
      console.log('❌ El campo parques es NULL o undefined');
    }

    // 4. Intentar consultar la tabla naves
    console.log('\n🔍 Paso 4: Intentando consultar la tabla naves');
    try {
      const navesResult = await client.query('SELECT COUNT(*) as total FROM naves LIMIT 10');
      console.log('✅ Consulta a naves exitosa');
      console.log('Total de naves encontradas:', navesResult.rows[0].total);
    } catch (e) {
      console.log('❌ Error al consultar naves:', e.message);
      console.log('Código de error:', e.code);
    }

    // 5. Verificar política RLS actual
    console.log('\n🔍 Paso 5: Verificando política RLS actual');
    const policyResult = await client.query(`
      SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
      FROM pg_policies 
      WHERE tablename = 'naves'
    `);

    if (policyResult.rows.length > 0) {
      console.log('✅ Políticas RLS encontradas:');
      policyResult.rows.forEach(policy => {
        console.log(`- ${policy.policyname}: ${policy.cmd}`);
        console.log(`  Condición: ${policy.qual}`);
      });
    } else {
      console.log('❌ No se encontraron políticas RLS para la tabla naves');
    }

  } catch (error) {
    console.error('❌ Error durante el diagnóstico:', error.message);
  } finally {
    // Cerrar la conexión
    await client.end();
    console.log('\n🔚 Conexión cerrada');
  }
}

// Ejecutar el diagnóstico
diagnosticarRLS();