const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const crypto = require('crypto');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*", // Allow all origins for public access (restrict in production)
    methods: ["GET", "POST"]
  }
});

// Session management
const sessions = new Map(); // sessionId -> { users: Set, createdAt: Date, lastActivity: Date }

// Configuration
const PORT = process.env.PORT || 3000;
const SESSION_EXPIRY_HOURS = 24;
const SESSION_ID_LENGTH = 32; // 256 bits
const BASE_URL = process.env.BASE_URL || null; // For public deployment

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Route for home page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Route for creating new chat (redirects to generated session)
app.get('/chat/new', (req, res) => {
  const sessionId = createSession();
  res.redirect(`/chat/${sessionId}`);
});

// Route for chat session
app.get('/chat/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  
  if (sessionId !== 'new' && !isValidSessionId(sessionId)) {
    return res.status(400).send('Invalid session ID');
  }
  
  res.sendFile(path.join(__dirname, 'public', 'chat.html'));
});

// Generate a new session ID (non-guessable, cryptographically secure)
function generateSessionId() {
  return crypto.randomBytes(SESSION_ID_LENGTH).toString('base64url');
}

// Validate session ID format
function isValidSessionId(sessionId) {
  return /^[A-Za-z0-9_-]{43}$/.test(sessionId); // base64url with length check
}

// Create a new session
function createSession() {
  const sessionId = generateSessionId();
  const now = new Date();
  
  sessions.set(sessionId, {
    users: new Set(),
    createdAt: now,
    lastActivity: now,
    maxUsers: 2
  });
  
  // Auto-cleanup expired sessions
  setTimeout(() => {
    if (sessions.has(sessionId)) {
      const session = sessions.get(sessionId);
      const hoursSinceCreation = (new Date() - session.createdAt) / (1000 * 60 * 60);
      if (hoursSinceCreation >= SESSION_EXPIRY_HOURS) {
        sessions.delete(sessionId);
      }
    }
  }, SESSION_EXPIRY_HOURS * 60 * 60 * 1000);
  
  return sessionId;
}

// Check if session is valid and can accept new users
function canJoinSession(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return false;
  
  // Check expiry
  const hoursSinceCreation = (new Date() - session.createdAt) / (1000 * 60 * 60);
  if (hoursSinceCreation >= SESSION_EXPIRY_HOURS) {
    sessions.delete(sessionId);
    return false;
  }
  
  // Check if already has max users (2)
  if (session.users.size >= session.maxUsers) {
    return false;
  }
  
  return true;
}

// Check if session is valid for sending messages (allows full sessions)
function isSessionValidForMessaging(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return false;
  
  // Check expiry
  const hoursSinceCreation = (new Date() - session.createdAt) / (1000 * 60 * 60);
  if (hoursSinceCreation >= SESSION_EXPIRY_HOURS) {
    sessions.delete(sessionId);
    return false;
  }
  
  // Allow messaging even if session is full (2 users)
  return true;
}

// Update session activity timestamp
function updateSessionActivity(sessionId) {
  const session = sessions.get(sessionId);
  if (session) {
    session.lastActivity = new Date();
  }
}

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);
  
  let currentSessionId = null;
  let userId = null;
  
  // Handle session creation
  socket.on('create-session', (callback) => {
    const sessionId = createSession();
    currentSessionId = sessionId;
    userId = crypto.randomBytes(8).toString('hex');
    
    const session = sessions.get(sessionId);
    session.users.add(socket.id);
    
    socket.join(sessionId);
    updateSessionActivity(sessionId);
    
    console.log(`Session created: ${sessionId} by ${socket.id}`);
    
    // Generate full URL for sharing
    let link;
    if (BASE_URL) {
      // Use explicit BASE_URL if provided (for deployment)
      link = `${BASE_URL}/chat/${sessionId}`;
    } else {
      // Auto-detect from request headers
      const protocol = socket.request.headers['x-forwarded-proto'] || 
                      (socket.request.secure ? 'https' : 'http');
      const host = socket.request.headers.host || `localhost:${PORT}`;
      link = `${protocol}://${host}/chat/${sessionId}`;
    }
    
    callback({
      sessionId,
      userId,
      link
    });
  });
  
  // Handle joining existing session
  socket.on('join-session', ({ sessionId }, callback) => {
    if (!isValidSessionId(sessionId)) {
      return callback({ error: 'Invalid session ID' });
    }
    
    if (!canJoinSession(sessionId)) {
      return callback({ error: 'Session not available or expired' });
    }
    
    currentSessionId = sessionId;
    userId = crypto.randomBytes(8).toString('hex');
    
    const session = sessions.get(sessionId);
    session.users.add(socket.id);
    
    socket.join(sessionId);
    updateSessionActivity(sessionId);
    
    // Notify other users in the session
    socket.to(sessionId).emit('user-joined', { userId });
    
    console.log(`User ${socket.id} joined session: ${sessionId}`);
    
    const isInitiator = session.users.size === 1;
    
    // Generate link for initiator
    let link = null;
    if (isInitiator) {
      if (BASE_URL) {
        // Use explicit BASE_URL if provided (for deployment)
        link = `${BASE_URL}/chat/${sessionId}`;
      } else {
        // Auto-detect from request headers
        const protocol = socket.request.headers['x-forwarded-proto'] || 
                        (socket.request.secure ? 'https' : 'http');
        const host = socket.request.headers.host || `localhost:${PORT}`;
        link = `${protocol}://${host}/chat/${sessionId}`;
      }
      console.log(`Generated link for initiator: ${link}`);
    }
    
    console.log(`Session ${sessionId}: isInitiator=${isInitiator}, users=${session.users.size}, link=${link}`);
    
    callback({
      success: true,
      userId,
      isInitiator,
      link
    });
  });
  
  // Handle key exchange (forward to peer, server doesn't store keys)
  socket.on('key-exchange', ({ publicKey }) => {
    if (!currentSessionId) return;
    
    // Forward key exchange data to other users in session
    socket.to(currentSessionId).emit('key-exchange', {
      publicKey
    });
  });
  
  // Handle encrypted message
  socket.on('encrypted-message', ({ encryptedData, iv, tag, publicKey }) => {
    console.log(`Received encrypted message from ${socket.id}, session: ${currentSessionId}`);
    
    if (!currentSessionId) {
      console.log(`No currentSessionId for socket ${socket.id}`);
      return socket.emit('error', { message: 'Session expired or invalid' });
    }
    
    if (!isSessionValidForMessaging(currentSessionId)) {
      console.log(`Session ${currentSessionId} is invalid for messaging`);
      return socket.emit('error', { message: 'Session expired or invalid' });
    }
    
    // Verify user is actually in this session
    const session = sessions.get(currentSessionId);
    if (!session || !session.users.has(socket.id)) {
      console.log(`Socket ${socket.id} is not a member of session ${currentSessionId}`);
      return socket.emit('error', { message: 'Not a member of this session' });
    }
    
    updateSessionActivity(currentSessionId);
    
    // Broadcast encrypted message to other users in the session
    console.log(`Broadcasting message to session ${currentSessionId}, other users: ${session.users.size - 1}`);
    socket.to(currentSessionId).emit('encrypted-message', {
      encryptedData,
      iv,
      tag,
      timestamp: new Date().toISOString()
    });
  });
  
  // Handle typing indicator
  socket.on('typing', ({ isTyping }) => {
    if (!currentSessionId) return;
    socket.to(currentSessionId).emit('user-typing', { userId, isTyping });
  });
  
  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    
    if (currentSessionId) {
      const session = sessions.get(currentSessionId);
      if (session) {
        session.users.delete(socket.id);
        
        // Notify other users
        socket.to(currentSessionId).emit('user-left', { userId });
        
        // Clean up empty sessions
        if (session.users.size === 0) {
          sessions.delete(currentSessionId);
          console.log(`Session ${currentSessionId} cleaned up`);
        }
      }
    }
  });
});

// Cleanup expired sessions periodically
setInterval(() => {
  const now = new Date();
  for (const [sessionId, session] of sessions.entries()) {
    const hoursSinceCreation = (now - session.createdAt) / (1000 * 60 * 60);
    if (hoursSinceCreation >= SESSION_EXPIRY_HOURS) {
      sessions.delete(sessionId);
      console.log(`Expired session removed: ${sessionId}`);
    }
  }
}, 60 * 60 * 1000); // Check every hour

server.listen(PORT, () => {
  console.log(`SecureChat server running on http://localhost:${PORT}`);
});

