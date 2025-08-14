// A simple backend server to manage real-time rooms for the interview prep app.
// To run this server:
// 1. Make sure you have Node.js installed.
// 2. Install dependencies: `npm install express socket.io cors`
// 3. Run the server: `node server.js`

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

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

const cleanupRoomForSocket = (socket) => {
    const { roomCode, roomType } = socket;
    if (!roomCode || !roomType) return;

    if (roomType === 'gd' && gdRooms[roomCode]) {
        gdRooms[roomCode].participants = gdRooms[roomCode].participants.filter(p => p.id !== socket.id);
        socket.to(roomCode).emit('user-left-gd', { socketId: socket.id });
        if (gdRooms[roomCode].participants.length === 0) {
            delete gdRooms[roomCode];
            console.log(`GD Room ${roomCode} is now empty and closed.`);
        }
    } else if (roomType === 'interview' && interviewRooms[roomCode]) {
        // Notify the remaining partner that the other has left
        socket.to(roomCode).emit('partner-disconnected');
        delete interviewRooms[roomCode];
        console.log(`Interview room ${roomCode} closed.`);
    }

    socket.roomCode = null;
    socket.roomType = null;
}


io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // --- Group Discussion Logic ---
  socket.on('create-gd-room', ({ userName }) => {
    const roomCode = generateRoomCode();
    gdRooms[roomCode] = { participants: [{ id: socket.id, name: userName }] };
    socket.join(roomCode);
    socket.roomCode = roomCode;
    socket.roomType = 'gd';
    socket.emit('gd-room-created', roomCode);
    console.log(`GD Room ${roomCode} created by ${userName} (${socket.id})`);
  });

  socket.on('join-gd-room', ({ roomCode, userName }) => {
    const room = gdRooms[roomCode];
    if (room) {
      const otherParticipants = room.participants;
      socket.join(roomCode);
      room.participants.push({ id: socket.id, name: userName });
      
      socket.roomCode = roomCode;
      socket.roomType = 'gd';
      
      // Send the list of existing participants to the new user
      socket.emit('joined-gd-room', { roomCode, participants: otherParticipants });
      // Notify existing participants that a new user is joining
      socket.to(roomCode).emit('user-joining-gd', { newParticipant: { id: socket.id, name: userName } });
      
      console.log(`${userName} (${socket.id}) joined GD Room ${roomCode}`);
    } else {
      socket.emit('error', 'Room not found. Please check the code and try again.');
    }
  });

  socket.on('leave-gd-room', () => cleanupRoomForSocket(socket));

  // --- 1-on-1 Interview Logic ---
  socket.on('create-interview-room', ({ userName }) => {
      const roomCode = generateRoomCode();
      interviewRooms[roomCode] = {
          interviewer: { id: socket.id, name: userName },
          student: null,
          code: `// Welcome to the interview room!
// As the student, you can edit and run this code.
// The interviewer will see your changes in real-time.

function findFactorial(num) {
  if (num < 0) {
    return "Factorial is not defined for negative numbers";
  } else if (num === 0) {
    return 1;
  } else {
    let result = 1;
    for (let i = 1; i <= num; i++) {
      result *= i;
    }
    return result;
  }
}

console.log("Factorial of 5 is:", findFactorial(5));
`
      };
      socket.join(roomCode);
      socket.roomCode = roomCode;
      socket.roomType = 'interview';
      socket.emit('interview-room-created', roomCode);
      console.log(`Interview Room ${roomCode} created by ${userName}`);
  });

  socket.on('join-interview-room', ({ roomCode, userName }) => {
    const room = interviewRooms[roomCode];
    if (room && !room.student) {
      room.student = { id: socket.id, name: userName };
      socket.join(roomCode);
      socket.roomCode = roomCode;
      socket.roomType = 'interview';
      
      // Notify both parties that the room is ready
      io.to(roomCode).emit('interview-room-ready', { roomData: room, roomCode });
      console.log(`Student ${userName} joined Interview Room ${roomCode}`);
    } else if (room && room.student) {
        socket.emit('error', 'Interview room is already full.');
    } else {
      socket.emit('error', 'Interview room not found.');
    }
  });
  
  socket.on('code-change', ({ roomCode, newCode }) => {
      const room = interviewRooms[roomCode];
      if (room) {
          room.code = newCode;
          socket.broadcast.to(roomCode).emit('code-updated', newCode);
      }
  });
  
  socket.on('code-run', ({ roomCode, output }) => {
      if (interviewRooms[roomCode]) {
          io.to(roomCode).emit('output-updated', output);
      }
  });
  
  socket.on('leave-interview-room', () => cleanupRoomForSocket(socket));

  // --- WebRTC Signaling Passthrough ---
  socket.on('webrtc-signal', (payload) => {
      io.to(payload.to).emit('webrtc-signal', {
          from: socket.id,
          signal: payload.signal,
      });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    cleanupRoomForSocket(socket);
  });
});

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});