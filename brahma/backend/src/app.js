require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const http       = require('http');
const { Server } = require('socket.io');

const app        = express();
const httpServer = http.createServer(app);
const io         = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set('io', io);

app.use('/api/auth',          require('./routes/auth'));
app.use('/api/tweets',        require('./routes/tweets'));
app.use('/api/users',         require('./routes/users'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/search',        require('./routes/search'));
app.use('/api/trending',      require('./routes/trending'));
app.use('/api/messages',      require('./routes/messages'));

app.get('/api/health', (_, res) => res.json({ status: 'ok' }));

io.on('connection', (socket) => {
  socket.on('join', (userId) => userId && socket.join(userId));
  socket.on('leave', (userId) => userId && socket.leave(userId));
});

const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => console.log(`Brahma backend on port ${PORT}`));
