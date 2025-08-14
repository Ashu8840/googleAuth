
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
  console.log('A user connected:', socket.id);

  // --- Group Discussion Logic ---
  socket.on('create-gd-room', ({ userName }) => {
    const roomCode = generateRoomCode();
    gdRooms[roomCode] = { participants: [{ id: socket.id, name: userName }] };
    socket.join(roomCode);
    socket.emit('gd-room-created', roomCode);
    console.log(`GD Room ${roomCode} created by ${userName} (${socket.id})`);
  });

  socket.on('join-gd-room', ({ roomCode, userName }) => {
    const room = gdRooms[roomCode];
    if (room) {
      // Notify existing participants that a new user is joining
      room.participants.forEach(p => {
        io.to(p.id).emit('user-joining-gd', { newParticipant: { id: socket.id, name: userName } });
      });
      
      socket.join(roomCode);
      // Send the list of existing participants to the new user
      socket.emit('joined-gd-room', { roomCode, participants: room.participants });
      
      // Add new participant to the room list
      room.participants.push({ id: socket.id, name: userName });

      console.log(`${userName} (${socket.id}) joined GD Room ${roomCode}`);
    } else {
      socket.emit('error', 'Room not found');
    }
  });

  socket.on('leave-gd-room', (roomCode) => {
      if(gdRooms[roomCode]) {
          gdRooms[roomCode].participants = gdRooms[roomCode].participants.filter(p => p.id !== socket.id);
          socket.to(roomCode).emit('user-left-gd', { socketId: socket.id });
          if (gdRooms[roomCode].participants.length === 0) {
              delete gdRooms[roomCode];
              console.log(`GD Room ${roomCode} is now empty and closed.`);
          }
      }
      socket.leave(roomCode);
  });

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
      // Notify interviewer that student has joined and room is ready to start
      io.to(room.interviewer.id).emit('interview-room-ready', room);
      // Notify student that they have joined and room is ready
      io.to(room.student.id).emit('interview-room-ready', room);
      console.log(`Student ${userName} joined Interview Room ${roomCode}`);
    } else if (room && room.student) {
        socket.emit('error', 'Interview room is already full.');
    } else {
      socket.emit('error', 'Interview room not found.');
    }
  });
  
  socket.on('code-change', ({ roomCode, newCode }) => {
      const room = Object.values(interviewRooms).find(r => r.interviewer.id === socket.id || r.student?.id === socket.id);
      if(room) {
          room.code = newCode;
          // broadcast to the other person in the room
          const targetSocketId = room.interviewer.id === socket.id ? room.student.id : room.interviewer.id;
          if (targetSocketId) {
            io.to(targetSocketId).emit('code-updated', newCode);
          }
      }
  });
  
  socket.on('code-run', ({ roomCode, output }) => {
      const room = Object.values(interviewRooms).find(r => r.interviewer.id === socket.id || r.student?.id === socket.id);
      if(room) {
          // broadcast to the other person in the room
          const targetSocketId = room.interviewer.id === socket.id ? room.student.id : room.interviewer.id;
          if(targetSocketId) {
            io.to(targetSocketId).emit('output-updated', output);
          }
      }
  });

  // --- WebRTC Signaling Passthrough ---
  socket.on('webrtc-signal', (payload) => {
    //   console.log(`Signaling message from ${socket.id} to ${payload.to}: ${payload.signal.type}`);
      io.to(payload.to).emit('webrtc-signal', {
          from: socket.id,
          signal: payload.signal,
      });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    // Clean up rooms on disconnect
    for (const roomCode in gdRooms) {
        const room = gdRooms[roomCode];
        const userIndex = room.participants.findIndex(p => p.id === socket.id);
        if (userIndex !== -1) {
            room.participants.splice(userIndex, 1);
            socket.to(roomCode).emit('user-left-gd', { socketId: socket.id });
             if (room.participants.length === 0) {
              delete gdRooms[roomCode];
              console.log(`GD Room ${roomCode} is now empty and closed.`);
          }
        }
    }
     for (const roomCode in interviewRooms) {
        const room = interviewRooms[roomCode];
        if (room.interviewer?.id === socket.id || room.student?.id === socket.id) {
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
