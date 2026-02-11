const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const db = require('../config/database');
const authMiddleware = require('../middleware/auth');

// Configuración de Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || 'gemini-pro' });

// ANALIZAR CORREO
router.post('/analyze', authMiddleware, async (req, res) => {
    try {
        const { email_content } = req.body;
        const userId = req.User.id; // Del token

        if (!email_content) {
            return res.status(400).json({ success: false, message: 'El contenido del correo es requerido' });
        }

        // Prompt para Gemini
        const prompt = `
            Actúa como un experto en ciberseguridad. Analiza el siguiente contenido de un correo electrónico sospechoso.
            Identifica señales de phishing, spam o intentos de estafa.
            
            Contenido del correo:
            """
            ${email_content}
            """
            
            Responde ÚNICAMENTE con un objeto JSON válido con la siguiente estructura (sin bloques de código ni markdown):
            {
                "is_phishing": boolean, // true si es phishing o alto riesgo, false si parece seguro
                "risk_level": "Alto" | "Medio" | "Bajo",
                "analysis": "Breve explicación de por qué es o no phishing (máximo 3 frases)"
            }
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        let text = response.text();

        // Limpiar respuesta si Gemini incluye markdown
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();

        let analysisData;
        try {
            analysisData = JSON.parse(text);
        } catch (e) {
            console.error('Error parseando JSON de Gemini:', text);
            // Fallback en caso de error de parseo
            analysisData = {
                is_phishing: true,
                risk_level: "Desconocido",
                analysis: "No se pudo procesar la respuesta de la IA correctamente, pero se recomienda precaución."
            };
        }

        // Guardar en base de datos
        await db.query(
            'INSERT INTO phishing_logs (user_id, email_content, analysis_result, is_phishing) VALUES (?, ?, ?, ?)',
            [userId, email_content, analysisData.analysis, analysisData.is_phishing]
        );

        res.json({
            success: true,
            data: analysisData
        });

    } catch (error) {
        console.error('Error en análisis de phishing:', error);
        res.status(500).json({ success: false, message: 'Error interno del servidor al analizar el correo' });
    }
});

// OBTENER HISTORIAL
router.get('/history', authMiddleware, async (req, res) => {
    try {
        const userId = req.User.id;

        const [rows] = await db.query(
            'SELECT * FROM phishing_logs WHERE user_id = ? ORDER BY created_at DESC',
            [userId]
        );

        res.json({
            success: true,
            history: rows
        });

    } catch (error) {
        console.error('Error obteniendo historial:', error);
        res.status(500).json({ success: false, message: 'Error al obtener el historial' });
    }
});

module.exports = router;
