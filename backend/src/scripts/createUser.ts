import { userService } from '../services/userService.js';
import readline from 'readline/promises';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..', '..', '..');

dotenv.config({ path: path.join(projectRoot, '.env') });

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function createUser() {
  try {
    console.log('=== Создание пользователя ===');
    
    const username = await rl.question('Имя пользователя: ');
    const email = await rl.question('Email: ');
    const password = await rl.question('Пароль: ');
    
    const existingUser = await userService.getUserByUsername(username);
    if (existingUser) {
      console.log('Ошибка: Пользователь с таким именем уже существует');
      process.exit(1);
    }
    
    const existingEmail = await userService.getUserByEmail(email);
    if (existingEmail) {
      console.log('Ошибка: Пользователь с таким email уже существует');
      process.exit(1);
    }
    
    const userId = await userService.createUser({
      username,
      email,
      password,
      role: 'user'
    });
    
    console.log(`✅ Пользователь ${username} создан с ID: ${userId}`);
    
  } catch (error) {
    console.error('Ошибка при создании пользователя:', error);
  } finally {
    rl.close();
    process.exit(0);
  }
}

createUser();