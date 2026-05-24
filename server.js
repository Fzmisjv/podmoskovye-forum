import express from 'express';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import bcrypt from 'bcrypt';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public')));

let db;

async function initDatabase() {
    db = await open({ filename: path.join(__dirname, 'database.db'), driver: sqlite3.Database });
    await db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE, password TEXT, username TEXT,
            avatar TEXT, bio TEXT, discord_name TEXT, roblox_name TEXT
        );
        CREATE TABLE IF NOT EXISTS categories (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, description TEXT)
    `);
    
    // Заполнение категорий (если пусто)
    const count = await db.get('SELECT COUNT(*) as c FROM categories');
    if (count.c === 0) {
        await db.run("INSERT INTO categories (title, description) VALUES ('Общий раздел', 'Общение')");
    }
}

// --- Маршруты ---

// 1. Получение публичного профиля
app.get('/user/public/:id', async (req, res) => {
    const user = await db.get('SELECT username, avatar, bio, discord_name, roblox_name FROM users WHERE id = ?', [req.params.id]);
    if (user) res.json(user);
    else res.status(404).json({ error: 'Пользователь не найден' });
});

// 2. Получение профиля (для редактирования)
app.get('/user/profile/:id', async (req, res) => {
    const user = await db.get('SELECT * FROM users WHERE id = ?', [req.params.id]);
    res.json(user);
});

// 3. Обновление профиля
app.post('/user/profile/update', async (req, res) => {
    const { userId, username, avatar, bio, discord_name, roblox_name } = req.body;
    await db.run(
        'UPDATE users SET username = ?, avatar = ?, bio = ?, discord_name = ?, roblox_name = ? WHERE id = ?',
        [username, avatar, bio, discord_name, roblox_name, userId]
    );
    res.json({ message: 'OK' });
});

app.get('/categories', async (req, res) => {
    const cats = await db.all('SELECT * FROM categories');
    res.json(cats);
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

initDatabase().then(() => {
    app.listen(3000, () => console.log('Сервер запущен на http://localhost:3000'));
});