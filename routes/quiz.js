const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const db = require('../config/database');
const authMiddleware = require('../middleware/auth');

// Configuración de Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || 'gemini-pro' });

// OBTENER PREGUNTAS (Aleatorias)
router.get('/questions', authMiddleware, async (req, res) => {
    try {
        // Seleccionamos 20 preguntas aleatorias sin revelar la respuesta correcta
        const [rows] = await db.query(
            'SELECT id, question_text, option_a, option_b, option_c, option_d, category FROM questions ORDER BY RAND() LIMIT 20'
        );
        res.json({ success: true, data: rows });
    } catch (error) {
        console.error('Error obteniendo preguntas:', error);
        res.status(500).json({ success: false, message: 'Error al cargar el quiz' });
    }
});

// ENVIAR RESPUESTAS Y CALIFICAR
router.post('/submit', authMiddleware, async (req, res) => {
    try {
        const { answers } = req.body; // Array de { id: 1, option: 'A' }
        const userId = req.User.id;

        if (!answers || !Array.isArray(answers)) {
            return res.status(400).json({ success: false, message: 'Formato de respuestas inválido' });
        }

        // Obtener las respuestas correctas de la BD para las preguntas enviadas
        const ids = answers.map(a => a.id);
        if (ids.length === 0) return res.json({ success: true, score: 0, total: 0, feedback: "Sin respuestas" });

        const [questions] = await db.query(
            `SELECT id, question_text, correct_option, explanation, category FROM questions WHERE id IN (?)`,
            [ids]
        );

        let score = 0;
        let wrongAnswers = [];

        // Calificar
        answers.forEach(ans => {
            const question = questions.find(q => q.id === ans.id);
            if (question) {
                if (question.correct_option === ans.option) {
                    score++;
                } else {
                    wrongAnswers.push({
                        question: question.question_text,
                        user_option: ans.option,
                        correct_option: question.correct_option,
                        explanation: question.explanation,
                        category: question.category
                    });
                }
            }
        });

        const totalQuestions = questions.length;

        // Generar Feedback con Gemini si hay errores
        let aiFeedback = "¡Excelente trabajo! Has respondido todo correctamente. Sigue así.";

        if (wrongAnswers.length > 0) {
            const prompt = `
                Actúa como un mentor experto en ciberseguridad. Un estudiante acaba de terminar un examen y falló en las siguientes preguntas:
                
                ${wrongAnswers.map(w => `- Pregunta: "${w.question}". Respondió: "${w.user_option}" (Correcta: "${w.correct_option}"). Contexto: ${w.explanation}`).join('\n')}
                
                Por favor, genera un feedback constructivo y alentador.
                1. Resume brevemente las áreas donde falló (basado en las categorías).
                2. Da 3 consejos clave o "puntos de mejora" para que estudie y no vuelva a fallar en estos temas.
                3. Mantén el tono amable y motivador. Sé conciso (máximo 150 palabras).
            `;

            try {
                const result = await model.generateContent(prompt);
                const response = await result.response;
                aiFeedback = response.text();
            } catch (aiError) {
                console.error('Error generando feedback AI:', aiError);
                aiFeedback = "No se pudo generar el feedback personalizado por el momento, pero revisa tus errores en la lista.";
            }
        }

        // Guardar resultado
        await db.query(
            'INSERT INTO quiz_results (user_id, score, total_questions, ai_feedback) VALUES (?, ?, ?, ?)',
            [userId, score, totalQuestions, aiFeedback]
        );

        res.json({
            success: true,
            score,
            total: totalQuestions,
            ai_feedback: aiFeedback,
            wrong_answers: wrongAnswers
        });

    } catch (error) {
        console.error('Error calificando quiz:', error);
        res.status(500).json({ success: false, message: 'Error al calificar el quiz' });
    }
});

// HISTORIAL DE QUIZZES
router.get('/history', authMiddleware, async (req, res) => {
    try {
        const userId = req.User.id;
        const [rows] = await db.query(
            'SELECT id, score, total_questions, ai_feedback, created_at FROM quiz_results WHERE user_id = ? ORDER BY created_at DESC',
            [userId]
        );
        res.json({ success: true, history: rows });
    } catch (error) {
        console.error('Error historial quiz:', error);
        res.status(500).json({ success: false, message: 'Error al obtener historial' });
    }
});

module.exports = router;
