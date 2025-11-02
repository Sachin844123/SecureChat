/**
 * Chat Application Client
 * Handles WebSocket communication, E2EE, and UI updates
 */

class SecureChat {
  constructor() {
    this.socket = null;
    this.sessionId = null;
    this.userId = null;
    this.e2ee = new E2EE();
    this.isInitiator = false;
    this.peerPublicKey = null;
    this.peerDHParams = null;
    this.myDHParams = null;
    this.connectionStatus = 'disconnected';
    this.isTyping = false;
    this.typingTimeout = null;
    
    this.initializeUI();
    this.connectToSession();
  }

  initializeUI() {
    this.elements = {
      messageContainer: document.getElementById('messages'),
      messageInput: document.getElementById('message-input'),
      sendButton: document.getElementById('send-button'),
      connectionStatus: document.getElementById('connection-status'),
      encryptionStatus: document.getElementById('encryption-status'),
      typingIndicator: document.getElementById('typing-indicator'),
      linkDisplay: document.getElementById('session-link'),
      copyButton: document.getElementById('copy-link')
    };

    // Event listeners
    this.elements.sendButton.addEventListener('click', () => this.sendMessage());
    this.elements.messageInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      } else {
        this.handleTyping();
      }
    });

    this.elements.messageInput.addEventListener('input', () => this.handleTyping());
    this.elements.copyButton.addEventListener('click', () => this.copyLink());
  }

  connectToSession() {
    // Get session ID from URL
    const pathParts = window.location.pathname.split('/');
    const urlSessionId = pathParts[pathParts.length - 1];

    if (urlSessionId && urlSessionId !== 'chat' && urlSessionId !== 'new' && urlSessionId.length > 10) {
      // Joining existing session
      this.joinSession(urlSessionId);
    } else {
      // Creating new session
      this.createSession();
    }
  }

  createSession() {
    this.updateConnectionStatus('connecting');
    
    // Connect to server
    this.socket = io();

    this.socket.on('connect', () => {
      this.updateConnectionStatus('connected');
      
      // Get session ID from URL if available
      const pathParts = window.location.pathname.split('/');
      const urlSessionId = pathParts[pathParts.length - 1];
      
      if (urlSessionId && urlSessionId !== 'chat' && urlSessionId !== 'new') {
        // Joining via URL with session ID
        this.joinSession(urlSessionId);
        return;
      }
      
      // Request new session
      this.socket.emit('create-session', (response) => {
        if (response.sessionId) {
          this.sessionId = response.sessionId;
          this.userId = response.userId;
          this.isInitiator = true;
          
          // Initialize key exchange
          this.e2ee.initializeKeyExchange().then((params) => {
            this.myDHParams = params;
          });
          
          // Update URL without reload
          window.history.replaceState({}, '', `/chat/${response.sessionId}`);
          
          // Display shareable link
          this.displayLink(response.link);
          
          this.addSystemMessage('Chat session created. Share the link to invite someone.');
          this.addSystemMessage('Waiting for someone to join...');
        }
      });
    });

    this.setupSocketHandlers();
  }

  joinSession(sessionId) {
    this.updateConnectionStatus('connecting');
    this.sessionId = sessionId;
    
    this.socket = io();

    this.socket.on('connect', () => {
      this.updateConnectionStatus('connected');
      
      this.socket.emit('join-session', { sessionId }, (response) => {
        if (response.error) {
          this.updateConnectionStatus('error');
          this.addSystemMessage(`Error: ${response.error}`);
          return;
        }
        
        this.userId = response.userId;
        this.isInitiator = response.isInitiator;
        
        console.log('Join session response:', response);
        
        // If initiator, display the shareable link
        if (this.isInitiator) {
          if (response.link) {
            console.log('User is initiator, displaying link:', response.link);
            // Use setTimeout to ensure DOM is ready
            setTimeout(() => {
              this.displayLink(response.link);
            }, 100);
          } else {
            console.warn('User is initiator but no link received, using current URL');
            // Fallback: construct link from current URL
            const currentUrl = window.location.href;
            setTimeout(() => {
              this.displayLink(currentUrl);
            }, 100);
          }
          this.addSystemMessage('Chat session created. Share the link to invite someone.');
          this.addSystemMessage('Waiting for someone to join...');
        } else {
          this.addSystemMessage('Joined chat session. Setting up encryption...');
        }
        
        // Initialize key exchange
        this.e2ee.initializeKeyExchange().then((params) => {
          this.myDHParams = params;
          
          // Send our public key to initiate key exchange
          this.socket.emit('key-exchange', {
            publicKey: this.myDHParams.publicKey
          });
        });
      });
    });

    this.setupSocketHandlers();
  }

  setupSocketHandlers() {
    let keyExchangeComplete = false;
    
    // Handle key exchange
    this.socket.on('key-exchange', async ({ publicKey }) => {
      this.peerPublicKey = publicKey;
      
      // Initialize our key pair if we haven't already
      if (!this.myDHParams) {
        this.myDHParams = await this.e2ee.initializeKeyExchange();
        
        // Send our public key back
        this.socket.emit('key-exchange', {
          publicKey: this.myDHParams.publicKey
        });
      }
      
      // Compute shared secret using peer's public key
      const success = await this.e2ee.computeSharedSecret(publicKey);
      
      if (success && this.e2ee.isReady() && !keyExchangeComplete) {
        keyExchangeComplete = true;
        this.updateEncryptionStatus(true);
        this.addSystemMessage('✓ End-to-end encryption is now active');
      }
    });

    // Handle encrypted messages
    this.socket.on('encrypted-message', async ({ encryptedData, iv, tag, timestamp }) => {
      try {
        const decrypted = await this.e2ee.decrypt(encryptedData, iv, tag);
        this.displayMessage(decrypted, timestamp, false);
      } catch (error) {
        console.error('Failed to decrypt message:', error);
        this.addSystemMessage('⚠ Failed to decrypt a message');
      }
    });

    // Handle typing indicator
    this.socket.on('user-typing', ({ userId, isTyping }) => {
      if (isTyping) {
        this.elements.typingIndicator.textContent = 'Someone is typing...';
        this.elements.typingIndicator.style.display = 'block';
      } else {
        this.elements.typingIndicator.style.display = 'none';
      }
    });

    // Handle user joined/left
    this.socket.on('user-joined', () => {
      this.addSystemMessage('Someone joined the chat');
      
      // If we're the initiator and have key params, send them to the new user
      if (this.isInitiator && this.myDHParams && !this.peerReceivedMyKey) {
        this.socket.emit('key-exchange', {
          publicKey: this.myDHParams.publicKey
        });
      }
    });

    this.socket.on('user-left', () => {
      this.addSystemMessage('Other user disconnected');
      this.updateConnectionStatus('waiting');
    });

    // Handle connection status
    this.socket.on('disconnect', () => {
      this.updateConnectionStatus('disconnected');
      this.addSystemMessage('Disconnected from server');
    });

    this.socket.on('connect', () => {
      this.updateConnectionStatus('connected');
    });

    this.socket.on('error', ({ message }) => {
      this.updateConnectionStatus('error');
      this.addSystemMessage(`Error: ${message}`);
    });
  }

  async sendMessage() {
    const message = this.elements.messageInput.value.trim();
    if (!message) return;
    
    if (!this.e2ee.isReady()) {
      this.addSystemMessage('⚠ Encryption not ready yet. Please wait...');
      return;
    }

    if (!this.socket || !this.socket.connected) {
      this.addSystemMessage('⚠ Not connected to server');
      return;
    }

    try {
      // Encrypt message (async)
      const { encryptedData, iv, tag } = await this.e2ee.encrypt(message);
      
      // Send encrypted message
      this.socket.emit('encrypted-message', {
        encryptedData,
        iv,
        tag
      });
      
      // Display message locally
      this.displayMessage(message, new Date().toISOString(), true);
      
      // Clear input
      this.elements.messageInput.value = '';
      
      // Clear typing indicator
      this.stopTyping();
    } catch (error) {
      console.error('Failed to encrypt/send message:', error);
      this.addSystemMessage('⚠ Failed to send message');
    }
  }

  displayMessage(text, timestamp, isOwn) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isOwn ? 'message-own' : 'message-other'}`;
    
    const time = new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    
    messageDiv.innerHTML = `
      <div class="message-content">${this.escapeHtml(text)}</div>
      <div class="message-time">${time}</div>
    `;
    
    this.elements.messageContainer.appendChild(messageDiv);
    this.scrollToBottom();
  }

  addSystemMessage(text) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message message-system';
    messageDiv.textContent = text;
    this.elements.messageContainer.appendChild(messageDiv);
    this.scrollToBottom();
  }

  handleTyping() {
    if (!this.isTyping) {
      this.isTyping = true;
      this.socket.emit('typing', { isTyping: true });
    }
    
    clearTimeout(this.typingTimeout);
    this.typingTimeout = setTimeout(() => {
      this.stopTyping();
    }, 1000);
  }

  stopTyping() {
    if (this.isTyping) {
      this.isTyping = false;
      this.socket.emit('typing', { isTyping: false });
    }
  }

  updateConnectionStatus(status) {
    this.connectionStatus = status;
    const statusElement = this.elements.connectionStatus;
    
    statusElement.className = `status status-${status}`;
    
    switch(status) {
      case 'connected':
        statusElement.innerHTML = '<span class="status-dot"></span> Connected';
        break;
      case 'connecting':
        statusElement.innerHTML = '<span class="status-dot"></span> Connecting...';
        break;
      case 'disconnected':
        statusElement.innerHTML = '<span class="status-dot"></span> Disconnected';
        break;
      case 'error':
        statusElement.innerHTML = '<span class="status-dot"></span> Connection Error';
        break;
      case 'waiting':
        statusElement.innerHTML = '<span class="status-dot"></span> Waiting for partner...';
        break;
    }
  }

  updateEncryptionStatus(isActive) {
    const statusElement = this.elements.encryptionStatus;
    if (isActive) {
      statusElement.innerHTML = '<span class="lock-icon">🔒</span> End-to-End Encrypted';
      statusElement.className = 'encryption-status encryption-active';
    } else {
      statusElement.innerHTML = '<span class="lock-icon">🔓</span> Setting up encryption...';
      statusElement.className = 'encryption-status encryption-pending';
    }
  }

  displayLink(link) {
    if (!link) {
      console.error('No link provided to displayLink');
      return;
    }
    
    // Ensure elements are available
    const linkDisplayElement = document.getElementById('session-link');
    const linkSectionElement = document.getElementById('link-section');
    
    if (!linkDisplayElement) {
      console.error('session-link element not found in DOM');
      return;
    }
    
    if (!linkSectionElement) {
      console.error('link-section element not found in DOM');
      return;
    }
    
    // Set the link value
    linkDisplayElement.value = link;
    
    // Show the link section
    linkSectionElement.style.display = 'block';
    
    console.log('Link successfully displayed:', link);
  }

  copyLink() {
    this.elements.linkDisplay.select();
    document.execCommand('copy');
    
    const button = this.elements.copyButton;
    const originalText = button.textContent;
    button.textContent = 'Copied!';
    button.classList.add('copied');
    
    setTimeout(() => {
      button.textContent = originalText;
      button.classList.remove('copied');
    }, 2000);
  }

  scrollToBottom() {
    this.elements.messageContainer.scrollTop = this.elements.messageContainer.scrollHeight;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Initialize chat when page loads
document.addEventListener('DOMContentLoaded', () => {
  window.chat = new SecureChat();
});

