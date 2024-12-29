const express = require('express');
const mysql = require('mysql');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();

// Middleware
app.use(express.json());
app.use(cors({
    origin: ['http://localhost:5500', 'http://127.0.0.1:5500'],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.static('public'));

// Veritabanı bağlantı konfigürasyonu
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'todo_db'
});

// Veritabanı bağlantısını test et
db.connect((err) => {
    if (err) {
        console.error('Veritabanı bağlantı hatası:', err);
        return;
    }
    console.log('Veritabanına bağlandı');

    // Veritabanını oluştur
    db.query('CREATE DATABASE IF NOT EXISTS todo_db', (err) => {
        if (err) {
            console.error('Veritabanı oluşturma hatası:', err);
            return;
        }
        console.log('Veritabanı hazır');

        // Users tablosunu oluştur
        const createUsersTable = `
        CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(255) NOT NULL UNIQUE,
            password VARCHAR(255) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`;

        db.query(createUsersTable, (err) => {
            if (err) {
                console.error('Tablo oluşturma hatası:', err);
                return;
            }
            console.log('Users tablosu hazır');
        });

        // Tasks tablosunu oluştur
        const createTasksTable = `
        CREATE TABLE IF NOT EXISTS tasks (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            text TEXT NOT NULL,
            completed BOOLEAN DEFAULT FALSE,
            due_date DATETIME,
            priority VARCHAR(10) DEFAULT 'medium',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )`;

        db.query(createTasksTable, (err) => {
            if (err) {
                console.error('Tablo oluşturma hatası:', err);
                return;
            }
            console.log('Tasks tablosu hazır');
        });
    });
});

// Bağlantı hatalarını dinle
db.on('error', (err) => {
    console.error('Database error:', err);
    if (err.code === 'PROTOCOL_CONNECTION_LOST') {
        console.error('Database connection was lost');
    }
});

const JWT_SECRET = 'your-secret-key';

// Test endpoint'i
app.get('/test', (req, res) => {
    res.json({ message: 'Server çalışıyor!' });
});

// Register endpoint'i
app.post('/register', async (req, res) => {
    try {
        console.log('Register isteği alındı:', req.body);
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Kullanıcı adı ve şifre gereklidir' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        db.query(
            'INSERT INTO users (username, password) VALUES (?, ?)',
            [username, hashedPassword],
            (err, results) => {
                if (err) {
                    console.error('Kayıt hatası:', err);
                    if (err.code === 'ER_DUP_ENTRY') {
                        return res.status(400).json({ error: 'Bu kullanıcı adı zaten kullanımda' });
                    }
                    return res.status(500).json({ error: 'Sunucu hatası' });
                }
                console.log('Kayıt başarılı:', results);
                res.json({ success: true });
            }
        );
    } catch (error) {
        console.error('Server hatası:', error);
        res.status(500).json({ error: 'Sunucu hatası' });
    }
});

// Middleware - Token kontrolü
const authenticateToken = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'Token gerekli' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Geçersiz token' });
        req.user = user;
        next();
    });
};

// Giriş yap
app.post('/login', (req, res) => {
    const { username, password } = req.body;

    db.query(
        'SELECT * FROM users WHERE username = ?',
        [username],
        async (err, results) => {
            if (err || results.length === 0) {
                return res.status(401).json({ error: 'Geçersiz kullanıcı adı veya şifre' });
            }

            const user = results[0];
            const validPassword = await bcrypt.compare(password, user.password);

            if (!validPassword) {
                return res.status(401).json({ error: 'Geçersiz kullanıcı adı veya şifre' });
            }

            const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET);
            res.json({ token, username: user.username });
        }
    );
});

// Kullanıcının görevlerini getir
app.get('/tasks', authenticateToken, (req, res) => {
    db.query(
        'SELECT * FROM tasks WHERE user_id = ? ORDER BY created_at DESC',
        [req.user.id],
        (err, results) => {
            if (err) {
                console.error('Database select error:', err);
                return res.status(500).json({ 
                    error: 'Database error', 
                    details: err.message 
                });
            }
            res.json(results);
        }
    );
});

// Yeni görev ekle
app.post('/tasks', authenticateToken, (req, res) => {
    try {
        const { text, dueDate, priority } = req.body;
        console.log('Gelen veri:', { text, dueDate, priority });

        if (!text) {
            return res.status(400).json({ error: 'Görev metni gerekli' });
        }

        // Tarih formatını düzenle
        let formattedDueDate = null;
        if (dueDate) {
            try {
                formattedDueDate = new Date(dueDate).toISOString().slice(0, 19).replace('T', ' ');
            } catch (dateError) {
                console.error('Tarih formatı hatası:', dateError);
            }
        }

        const sql = 'INSERT INTO tasks (user_id, text, due_date, priority) VALUES (?, ?, ?, ?)';
        const values = [req.user.id, text, formattedDueDate, priority];

        console.log('SQL Sorgusu:', sql);
        console.log('Değerler:', values);

        db.query(sql, values, (err, result) => {
            if (err) {
                console.error('Veritabanı ekleme hatası:', err);
                return res.status(500).json({ 
                    error: 'Veritabanı hatası',
                    details: err.message 
                });
            }

            // Eklenen görevi getir
            const getTaskSql = 'SELECT * FROM tasks WHERE id = ?';
            db.query(getTaskSql, [result.insertId], (err, tasks) => {
                if (err) {
                    console.error('Görev getirme hatası:', err);
                    return res.status(500).json({ 
                        error: 'Görev getirme hatası',
                        details: err.message 
                    });
                }

                console.log('Görev başarıyla eklendi:', tasks[0]);
                res.json({
                    success: true,
                    task: tasks[0]
                });
            });
        });
    } catch (error) {
        console.error('Sunucu hatası:', error);
        res.status(500).json({ 
            error: 'Sunucu hatası',
            details: error.message 
        });
    }
});

// Görev güncelle
app.put('/tasks/:id', authenticateToken, (req, res) => {
    db.query(
        'UPDATE tasks SET completed = NOT completed WHERE id = ? AND user_id = ?',
        [req.params.id, req.user.id],
        (err, results) => {
            if (err) {
                return res.status(500).json({ error: 'Sunucu hatası' });
            }
            if (results.affectedRows === 0) {
                return res.status(404).json({ error: 'Görev bulunamadı' });
            }
            res.json({ success: true });
        }
    );
});

// Görev sil
app.delete('/tasks/:id', authenticateToken, (req, res) => {
    db.query(
        'DELETE FROM tasks WHERE id = ? AND user_id = ?',
        [req.params.id, req.user.id],
        (err, results) => {
            if (err) {
                return res.status(500).json({ error: 'Sunucu hatası' });
            }
            if (results.affectedRows === 0) {
                return res.status(404).json({ error: 'Görev bulunamadı' });
            }
            res.json({ success: true });
        }
    );
});

// Kullanıcı bilgilerini getir
app.get('/user', authenticateToken, (req, res) => {
    res.json({ 
        id: req.user.id, 
        username: req.user.username 
    });
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server http://localhost:${PORT} adresinde çalışıyor`);
});

// Hata yakalama
process.on('unhandledRejection', (error) => {
    console.error('Yakalanmamış Promise Reddi:', error);
});

process.on('uncaughtException', (error) => {
    console.error('Yakalanmamış Hata:', error);
});

// Veritabanı hata dinleyicisi
db.on('error', (err) => {
    console.error('Veritabanı hatası:', err);
    if (err.code === 'PROTOCOL_CONNECTION_LOST') {
        console.log('Veritabanı bağlantısı koptu');
    }
}); 