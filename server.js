// A simple backend server to manage real-time rooms for the interview prep app.
// To run this server:
// 1. Make sure you have Node.js installed.
// 2. Install dependencies: `npm install express socket.io cors`
// 3. Run the server: `node server.js`

import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';


const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Allow all origins for simplicity. In production, restrict this.
    methods: ["GET", "POST"]
  }
});

const gdRooms = {}; // For Group Discussions
const interviewRooms = {}; // For 1-on-1 Interviews

const generateRoomCode = () => {
    return Math.random().toString(36).substring(2, 7).toUpperCase();
}

io.on('connection', (socket) => {
  console.log('a user connected:', socket.id);

  // --- Group Discussion Logic ---
  socket.on('create-gd-room', ({ userName }) => {
    const roomCode = generateRoomCode();
    gdRooms[roomCode] = [{ id: socket.id, name: userName }];
    socket.join(roomCode);
    socket.emit('gd-room-created', roomCode);
    console.log(`GD Room ${roomCode} created by ${userName}`);
  });

  socket.on('join-gd-room', ({ roomCode, userName }) => {
    if (gdRooms[roomCode]) {
      gdRooms[roomCode].push({ id: socket.id, name: userName });
      socket.join(roomCode);
      socket.to(roomCode).emit('user-joined-gd', { id: socket.id, name: userName });
      socket.emit('joined-gd-room', { roomCode, participants: gdRooms[roomCode] });
      console.log(`${userName} joined GD Room ${roomCode}`);
    } else {
      socket.emit('error', 'Room not found');
    }
  });
  
  socket.on('leave-gd-room', (roomCode) => {
      if(gdRooms[roomCode]) {
          gdRooms[roomCode] = gdRooms[roomCode].filter(p => p.id !== socket.id);
          socket.to(roomCode).emit('user-left-gd', socket.id);
      }
      socket.leave(roomCode);
  })


  // --- 1-on-1 Interview Logic ---
  socket.on('create-interview-room', ({ userName }) => {
      const roomCode = generateRoomCode();
      interviewRooms[roomCode] = {
          interviewer: { id: socket.id, name: userName },
          student: null,
          code: `// Welcome to the interview room!
// The student can edit and run this code.

function sayHello(name) {
  console.log('Hello, ' + name + '!');
}

sayHello('World');
`
      };
      socket.join(roomCode);
      socket.emit('interview-room-created', roomCode);
      console.log(`Interview Room ${roomCode} created by ${userName}`);
  });

  socket.on('join-interview-room', ({ roomCode, userName }) => {
    const room = interviewRooms[roomCode];
    if (room && !room.student) {
      room.student = { id: socket.id, name: userName };
      socket.join(roomCode);
      // Notify both parties with the full room state
      io.in(roomCode).emit('interview-room-ready', room);
      console.log(`Student ${userName} joined Interview Room ${roomCode}`);
    } else if (room && room.student) {
        socket.emit('error', 'Interview room is already full.');
    } else {
      socket.emit('error', 'Interview room not found.');
    }
  });
  
  socket.on('code-change', ({ roomCode, newCode }) => {
      if(interviewRooms[roomCode]) {
          interviewRooms[roomCode].code = newCode;
          socket.to(roomCode).emit('code-updated', newCode);
      }
  });
  
  socket.on('code-run', ({ roomCode, output }) => {
      if(interviewRooms[roomCode]) {
          socket.to(roomCode).emit('output-updated', output);
      }
  });


  socket.on('disconnect', () => {
    console.log('user disconnected:', socket.id);
    // Clean up rooms on disconnect
    for (const roomCode in gdRooms) {
        const userIndex = gdRooms[roomCode].findIndex(p => p.id === socket.id);
        if (userIndex !== -1) {
            gdRooms[roomCode].splice(userIndex, 1);
            socket.to(roomCode).emit('user-left-gd', socket.id);
        }
    }
     for (const roomCode in interviewRooms) {
        const room = interviewRooms[roomCode];
        if (room.interviewer?.id === socket.id || room.student?.id === socket.id) {
           // For simplicity, we can just notify the other user.
           // A more robust solution might end the session.
           socket.to(roomCode).emit('partner-disconnected');
           delete interviewRooms[roomCode];
           console.log(`Interview room ${roomCode} closed due to disconnect.`);
        }
    }
  });
});

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});
