// index.js
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const prisma = new PrismaClient();

app.use(express.json());

// Middleware de autenticación y autorización
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token == null) return res.sendStatus(401);

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

const authorizeRole = (role) => (req, res, next) => {
  if (req.user && req.user.role === role) {
    next();
  } else {
    res.sendStatus(403);
  }
};

// Rutas de autenticación
app.post('/register', async (req, res) => {
  const { name, email, password, role } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña son obligatorios' });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  try {
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: role || 'ATTENDEE', // Permite registrar con rol, por defecto ATTENDEE
      },
    });
    res.status(201).json({ message: 'Usuario registrado con éxito', userId: user.id });
  } catch (error) {
    res.status(400).json({ error: 'El email ya está en uso' });
  }
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    return res.status(401).json({ error: 'Credenciales inválidas' });
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);

  if (!isPasswordValid) {
    return res.status(401).json({ error: 'Credenciales inválidas' });
  }

  const token = jwt.sign({ userId: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1h' });
  res.json({ token });
});

app.get('/profile', authenticateToken, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.userId },
  });
  res.json({ message: `Bienvenido, ${user.name || user.email}!`, user });
});

// Rutas para la gestión de Eventos
app.post('/events', authenticateToken, authorizeRole('ADMIN'), async (req, res) => {
  const { name, description, date, location } = req.body;
  try {
    const newEvent = await prisma.event.create({
      data: { name, description, date: new Date(date), location },
    });
    res.status(201).json(newEvent);
  } catch (error) {
    res.status(400).json({ error: 'No se pudo crear el evento' });
  }
});

app.get('/events', async (req, res) => {
  try {
    const events = await prisma.event.findMany({
      include: { sessions: true },
    });
    res.json(events);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener los eventos' });
  }
});

app.get('/events/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const event = await prisma.event.findUnique({
      where: { id: parseInt(id) },
      include: { sessions: { include: { speaker: true } } },
    });
    if (!event) {
      return res.status(404).json({ error: 'Evento no encontrado' });
    }
    res.json(event);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener el evento' });
  }
});

app.put('/events/:id', authenticateToken, authorizeRole('ADMIN'), async (req, res) => {
  const { id } = req.params;
  const { name, description, date, location } = req.body;
  try {
    const updatedEvent = await prisma.event.update({
      where: { id: parseInt(id) },
      data: { name, description, date: new Date(date), location },
    });
    res.json(updatedEvent);
  } catch (error) {
    res.status(400).json({ error: 'No se pudo actualizar el evento' });
  }
});

app.delete('/events/:id', authenticateToken, authorizeRole('ADMIN'), async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.event.delete({
      where: { id: parseInt(id) },
    });
    res.status(204).send();
  } catch (error) {
    res.status(400).json({ error: 'No se pudo eliminar el evento' });
  }
});

// Rutas para la gestión de Speakers
app.post('/speakers', authenticateToken, authorizeRole('ADMIN'), async (req, res) => {
  const { name, bio, userId } = req.body;
  try {
    const newSpeaker = await prisma.speaker.create({
      data: { name, bio, userId: userId ? parseInt(userId) : null },
    });
    res.status(201).json(newSpeaker);
  } catch (error) {
    res.status(400).json({ error: 'No se pudo crear el orador' });
  }
});

app.get('/speakers', async (req, res) => {
  try {
    const speakers = await prisma.speaker.findMany();
    res.json(speakers);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener los oradores' });
  }
});

// Rutas para la gestión de Sessions
app.post('/sessions', authenticateToken, authorizeRole('ADMIN'), async (req, res) => {
  const { title, description, startTime, endTime, eventId, speakerId } = req.body;
  try {
    const newSession = await prisma.session.create({
      data: {
        title,
        description,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        eventId: parseInt(eventId),
        speakerId: parseInt(speakerId),
      },
    });
    res.status(201).json(newSession);
  } catch (error) {
    res.status(400).json({ error: 'No se pudo crear la sesión' });
  }
});

app.get('/events/:eventId/sessions', async (req, res) => {
  const { eventId } = req.params;
  try {
    const sessions = await prisma.session.findMany({
      where: { eventId: parseInt(eventId) },
      include: { speaker: true },
    });
    res.json(sessions);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener las sesiones' });
  }
});


// index.js

// ... (Todo el código anterior)

// Rutas para la gestión de Registros
// Registrar a un usuario en un evento (requiere autenticación)
app.post('/events/:id/register', authenticateToken, async (req, res) => {
  const { id: eventId } = req.params;
  const userId = req.user.userId;

  try {
    const registration = await prisma.registration.create({
      data: {
        userId: userId,
        eventId: parseInt(eventId),
      },
    });
    res.status(201).json({ message: 'Registro exitoso', registration });
  } catch (error) {
    res.status(400).json({ error: 'No se pudo registrar en el evento. Posiblemente ya estás registrado.' });
  }
});

// Obtener todos los registros de un evento (solo ADMIN)
app.get('/events/:id/registrations', authenticateToken, authorizeRole('ADMIN'), async (req, res) => {
  const { id: eventId } = req.params;
  try {
    const registrations = await prisma.registration.findMany({
      where: { eventId: parseInt(eventId) },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    res.json(registrations);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener los registros' });
  }
});


const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});