import express from 'express';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import bcrypt from 'bcrypt';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// Увеличили лимит для Base64 фото, чтобы аватарки проходили
app.use(express.json({ limit: '5mb' })); 
app.use(express.static(path.join(__dirname, 'public')));

let db;

async function initDatabase() {
    db = await open({
        filename: path.join(__dirname, 'database.db'),
        driver: sqlite3.Database
    });

    // Создание таблицы пользователей
    await db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            username TEXT,
            avatar TEXT,
            bio TEXT,
            role TEXT DEFAULT 'Пользователь',
            discord_name TEXT,
            roblox_name TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Создание таблицы категорий
    await db.exec(`
        CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT
        )
    `);

    // Добавление категорий, если их нет
    const categories = await db.all('SELECT * FROM categories');
    if (categories.length === 0) {
        await db.run("INSERT INTO categories (title, description) VALUES (?, ?)", ['Новости', 'Важные новости сервера']);
        await db.run("INSERT INTO categories (title, description) VALUES (?, ?)", ['Общение', 'Курилка']);
        console.log('Стандартные категории созданы.');
    }

    // Авто-миграция для новых полей профиля
    try { await db.exec("ALTER TABLE users ADD COLUMN discord_name TEXT"); } catch (e) {}
    try { await db.exec("ALTER TABLE users ADD COLUMN roblox_name TEXT"); } catch (e) {}
    
    console.log('База данных готова.');
}

// Роуты API
app.post('/register', async (req, res) => {
    const { email, password } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        await db.run('INSERT INTO users (email, password, username, avatar) VALUES (?, ?, ?, ?)', 
            [email, hashedPassword, email.split('@')[0], 'https://i.imgur.com/6VBx3io.png']);
        res.status(201).json({ message: 'Регистрация успешна!' });
    } catch (e) { res.status(500).json({ error: 'Пользователь уже существует' }); }
});

app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    const user = await db.get('SELECT * FROM users WHERE email = ?', [email]);
    if (user && await bcrypt.compare(password, user.password)) {
        res.json({ user: { id: user.id, email: user.email, username: user.username } });
    } else {
        res.status(400).json({ error: 'Неверные данные' });
    }
});

app.get('/categories', async (req, res) => {
    const categories = await db.all('SELECT * FROM categories');
    res.json(categories);
});

app.get('/user/profile/:id', async (req, res) => {
    const user = await db.get('SELECT * FROM users WHERE id = ?', [req.params.id]);
    res.json(user);
});

app.post('/user/profile/update', async (req, res) => {
    const { userId, username, avatar, bio, discord_name, roblox_name } = req.body;
    try {
        await db.run(
            'UPDATE users SET username = ?, avatar = ?, bio = ?, discord_name = ?, roblox_name = ? WHERE id = ?',
            [username, avatar, bio, discord_name, roblox_name, userId]
        );
        res.json({ message: 'Профиль обновлен!' });
    } catch (e) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

// Запуск сервера (используем PORT из настроек хостинга или 3000)
const PORT = process.env.PORT || 3000;
initDatabase().then(() => {
    app.listen(PORT, () => console.log(`Сервер запущен на порту ${PORT}`));
});