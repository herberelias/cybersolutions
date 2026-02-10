const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// REGISTRO
router.post('/register', async (req, res) => {
    try {
        const { nombre, email, password } = req.body;

        if (!nombre || !email || !password) {
            return res.status(400).json({ success: false, message: 'Todos los campos son obligatorios' });
        }

        if (password.length < 6) {
            return res.status(400).json({ success: false, message: 'La contraseña debe tener al menos 6 caracteres' });
        }

        // Verificar si existe el email
        const [users] = await db.query('SELECT id FROM usuarios WHERE email = ?', [email]);
        if (users.length > 0) {
            return res.status(400).json({ success: false, message: 'El email ya está registrado' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insertar usuario
        const [result] = await db.query(
            'INSERT INTO usuarios (nombre, email, password) VALUES (?, ?, ?)',
            [nombre, email, hashedPassword]
        );

        res.status(201).json({
            success: true,
            message: 'Usuario registrado exitosamente',
            userId: result.insertId
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error en el servidor al registrar' });
    }
});

// LOGIN
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Email y contraseña requeridos' });
        }

        const [users] = await db.query('SELECT * FROM usuarios WHERE email = ?', [email]);

        if (users.length === 0) {
            return res.status(401).json({ success: false, message: 'Credenciales inválidas' });
        }

        const user = users[0];
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Credenciales inválidas' });
        }

        const token = jwt.sign(
            { id: user.id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN }
        );

        // Ocultar password en la respuesta
        delete user.password;

        res.json({
            success: true,
            message: 'Inicio de sesión exitoso',
            token,
            user
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error en el servidor al iniciar sesión' });
    }
});

// PERFIL (Ruta Protegida)
router.get('/profile', authMiddleware, async (req, res) => {
    try {
        const [users] = await db.query('SELECT id, nombre, email, fecha_registro FROM usuarios WHERE id = ?', [req.User.id]);

        if (users.length === 0) {
            return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
        }

        res.json({
            success: true,
            user: users[0]
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error al obtener perfil' });
    }
});

module.exports = router;
