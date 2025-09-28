import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..', '..', '..');
const envPath = path.join(projectRoot, '.env');

console.log('🔍 Searching for .env file in project root:', envPath);
console.log('✅ .env file exists:', fs.existsSync(envPath));

dotenv.config({ path: envPath });

console.log('🔍 Checking environment variables after loading:');
console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_PORT:', process.env.DB_PORT);
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_PASSWORD:', process.env.DB_PASSWORD ? '***' : 'NOT SET');
console.log('DB_NAME:', process.env.DB_NAME);

async function createDatabase() {
  try {
    const dbConfig = {
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    };

    console.log('🔌 Final database configuration:', {
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      database: dbConfig.database,
      passwordSet: !!dbConfig.password
    });

    if (!dbConfig.user) {
      throw new Error('DB_USER не указан в .env файле');
    }

    console.log('🚀 Attempting to connect to MySQL...');

    const connection = await mysql.createConnection({
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      password: dbConfig.password,
      multipleStatements: true
    });

    console.log('✅ Подключение к MySQL установлено');

    const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
    console.log('📄 Reading schema from:', schemaPath);
    
    if (!fs.existsSync(schemaPath)) {
      throw new Error(`Файл схемы не найден: ${schemaPath}`);
    }

    const schema = fs.readFileSync(schemaPath, 'utf8');
    console.log('✅ Файл схемы прочитан');

    console.log('🗃️ Creating database and tables...');
    await connection.query(schema);
    console.log('✅ База данных и таблицы созданы успешно');
    
    await connection.end();
    console.log('✅ Скрипт завершен успешно');
    
  } catch (error: any) {
    console.error('❌ Ошибка при создании базы данных:');
    
    if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('🔐 Ошибка доступа к MySQL:');
      console.error('   - Проверьте правильность пароля в .env файле');
      console.error('   - Убедитесь, что MySQL сервер запущен');
      console.error('   - Проверьте права пользователя MySQL');
    } else if (error.code === 'ECONNREFUSED') {
      console.error('🌐 Ошибка подключения:');
      console.error('   - Убедитесь, что MySQL сервер запущен на localhost:3306');
      console.error('   - Проверьте настройки хоста и порта в .env');
    } else {
      console.error(error);
    }
    
    process.exit(1);
  }
}

createDatabase();