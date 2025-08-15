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
const users = {}; // For user presence and private messaging { email: { socketId, name, picture, uniqueName } }

const generateRoomCode = () => {
    return Math.random().toString(36).substring(2, 7).toUpperCase();
}

const cleanupRoomForSocket = (socket) => {
    // GD Room Cleanup
    Object.keys(gdRooms).forEach(roomCode => {
        const room = gdRooms[roomCode];
        const participantIndex = room.participants.findIndex(p => p.id === socket.id);
        if (participantIndex > -1) {
            room.participants.splice(participantIndex, 1);
            socket.to(roomCode).emit('user-left-gd', { socketId: socket.id });
            if (room.participants.length === 0) {
                delete gdRooms[roomCode];
                console.log(`GD Room ${roomCode} is now empty and closed.`);
            }
        }
    });

    // Interview Room Cleanup
    Object.keys(interviewRooms).forEach(roomCode => {
        const room = interviewRooms[roomCode];
        if (room.interviewer?.id === socket.id || room.student?.id === socket.id) {
            socket.to(roomCode).emit('partner-disconnected');
            delete interviewRooms[roomCode];
            console.log(`Interview room ${roomCode} closed.`);
        }
    });
}


io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // --- User Presence ---
  socket.on('register', (user) => {
      socket.email = user.email;
      users[user.email] = {
          socketId: socket.id,
          name: user.name,
          picture: user.picture,
          uniqueName: user.uniqueName
      };
      io.emit('online-users', Object.keys(users));
      console.log(`User registered: ${user.email} as ${user.uniqueName}`);
  });
  
  // --- Private Messaging ---
  socket.on('private-message', ({ to, message }) => {
      const recipient = users[to];
      if (recipient) {
          io.to(recipient.socketId).emit('private-message', {
              from: socket.email,
              message,
              fromUniqueName: users[socket.email]?.uniqueName || 'User'
          });
      }
  });

  // --- 1-on-1 Calling ---
  socket.on('initiate-call', ({ to }) => {
    const recipient = users[to];
    if (recipient) {
        io.to(recipient.socketId).emit('incoming-call', { from: socket.email, fromInfo: users[socket.email] });
    }
  });
  socket.on('accept-call', ({ to }) => {
    const recipient = users[to];
    if (recipient) {
        io.to(recipient.socketId).emit('call-accepted', { by: socket.email });
    }
  });
  socket.on('decline-call', ({ to }) => {
    const recipient = users[to];
    if (recipient) {
        io.to(recipient.socketId).emit('call-declined', { by: socket.email });
    }
  });
  socket.on('end-call', ({ peerEmail }) => {
    const recipient = users[peerEmail];
    if (recipient) {
        io.to(recipient.socketId).emit('call-ended');
    }
  });

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
      const otherParticipants = room.participants;
      socket.join(roomCode);
      room.participants.push({ id: socket.id, name: userName });
      
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
      socket.emit('interview-room-created', roomCode);
      console.log(`Interview Room ${roomCode} created by ${userName}`);
  });

  socket.on('join-interview-room', ({ roomCode, userName }) => {
    const room = interviewRooms[roomCode];
    if (room && !room.student) {
      room.student = { id: socket.id, name: userName };
      socket.join(roomCode);
      
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

  // --- Whiteboard Passthrough ---
  socket.on('whiteboard-data', ({ roomCode, data }) => {
      socket.to(roomCode).emit('whiteboard-data', data);
  });
  socket.on('whiteboard-clear', ({ roomCode }) => {
      socket.to(roomCode).emit('whiteboard-clear');
  });

  // --- WebRTC Signaling Passthrough ---
  socket.on('webrtc-signal', (payload) => {
      const recipient = Object.values(users).find(u => u.socketId === payload.to);
      const recipientEmail = Object.keys(users).find(key => users[key] === recipient);
      
      const targetSocketId = payload.to;

      io.to(targetSocketId).emit('webrtc-signal', {
          from: socket.id,
          signal: payload.signal,
      });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    if (socket.email && users[socket.email]) {
        delete users[socket.email];
        io.emit('online-users', Object.keys(users));
        console.log(`User unregistered: ${socket.email}`);
    }
    cleanupRoomForSocket(socket);
  });
});

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});