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
      socket.to(roomCode).emit('user-joining-gd', { newParticipant: { id: socket.id, name: userName } });
      
      socket.join(roomCode);
      // Send the list of existing participants to the new user
      socket.emit('joined-gd-room', { roomCode, participants: room.participants });
      
      // Add new participant to the room list
      room.participants.push({ id: socket.id, name: userName });

      console.log(`${userName} (${socket.id}) joined GD Room ${roomCode}`);
    } else {
      socket.emit('error', 'Room not found. Please check the code and try again.');
    }
  });

  socket.on('leave-gd-room', (roomCode) => {
      socket.leave(roomCode);
      if(gdRooms[roomCode]) {
          gdRooms[roomCode].participants = gdRooms[roomCode].participants.filter(p => p.id !== socket.id);
          socket.to(roomCode).emit('user-left-gd', { socketId: socket.id });
          if (gdRooms[roomCode].participants.length === 0) {
              delete gdRooms[roomCode];
              console.log(`GD Room ${roomCode} is now empty and closed.`);
          }
      }
  });

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
      socket.emit('interview-room-created', roomCode);
      console.log(`Interview Room ${roomCode} created by ${userName}`);
  });

  socket.on('join-interview-room', ({ roomCode, userName }) => {
    const room = interviewRooms[roomCode];
    if (room && !room.student) {
      room.student = { id: socket.id, name: userName };
      socket.join(roomCode);
      // Notify both parties that the room is ready, sending the full room state and code
      io.to(room.interviewer.id).emit('interview-room-ready', { roomData: room, roomCode: roomCode });
      io.to(room.student.id).emit('interview-room-ready', { roomData: room, roomCode: roomCode });
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
          // Broadcast to the other user in the room, excluding the sender.
          // This is the key fix for the input focus issue.
          socket.broadcast.to(roomCode).emit('code-updated', newCode);
      }
  });
  
  socket.on('code-run', ({ roomCode, output }) => {
      if (interviewRooms[roomCode]) {
          io.to(roomCode).emit('output-updated', output);
      }
  });

  // --- WebRTC Signaling Passthrough ---
  socket.on('webrtc-signal', (payload) => {
      io.to(payload.to).emit('webrtc-signal', {
          from: socket.id,
          signal: payload.signal,
      });
  });

  const cleanupRooms = () => {
     // Clean up GD rooms
    for (const roomCode in gdRooms) {
        const room = gdRooms[roomCode];
        const userIndex = room.participants.findIndex(p => p.id === socket.id);
        if (userIndex !== -1) {
            room.participants.splice(userIndex, 1);
            socket.to(roomCode).emit('user-left-gd', { socketId: socket.id });
             if (room.participants.length === 0) {
              delete gdRooms[roomCode];
              console.log(`GD Room ${roomCode} closed due to disconnect.`);
          }
          break; // User can only be in one room
        }
    }
    // Clean up Interview rooms
     for (const roomCode in interviewRooms) {
        const room = interviewRooms[roomCode];
        if (room.interviewer?.id === socket.id || room.student?.id === socket.id) {
           socket.to(roomCode).emit('partner-disconnected');
           delete interviewRooms[roomCode];
           console.log(`Interview room ${roomCode} closed due to disconnect.`);
           break; // User can only be in one room
        }
    }
  };

  socket.on('leave-interview-room', () => cleanupRooms());
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    cleanupRooms();
  });
});

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});