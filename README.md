# SecureChat 🔒

A real-time, end-to-end encrypted chat application built with Node.js. SecureChat enables private messaging without requiring user accounts, logins, or persistent message storage.

## Features

- 🔐 **End-to-End Encryption**: Messages encrypted with AES-256-GCM using Diffie-Hellman key exchange
- ⚡ **Real-Time Communication**: WebSocket-based messaging for instant delivery
- 🚫 **No Accounts Required**: Start chatting immediately without registration
- 🔗 **Shareable Links**: Generate unique, non-guessable session links
- 💬 **Typing Indicators**: Real-time typing status
- 📱 **Modern UI**: Clean, professional interface similar to popular messaging apps
- 🕒 **Auto-Expiry**: Sessions expire after 24 hours or when 2 users join

## Technology Stack

- **Backend**: Node.js + Express.js
- **Real-time**: Socket.io (WebSocket)
- **Encryption**: Node.js `crypto` module (Diffie-Hellman + AES-256-GCM)
- **Frontend**: Vanilla JavaScript, HTML5, CSS3

## Installation

### Prerequisites

- Node.js (v14 or higher)
- npm (Node Package Manager)

### Setup

1. **Clone or download the repository**

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the server**
   ```bash
   npm start
   ```

4. **Access the application**
   Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

## Usage

### Creating a Chat Session

1. Visit the home page (`http://localhost:3000`)
2. Click "Create New Chat"
3. A unique, shareable link will be generated
4. Copy and share the link with your chat partner

### Joining a Chat Session

1. Click the shared link
2. The application will automatically:
   - Connect to the chat session
   - Establish end-to-end encryption
   - Enable secure messaging

### Chatting

- Type messages in the input field
- Press Enter or click Send to send encrypted messages
- View connection and encryption status in the header
- See typing indicators when your partner is typing

## Project Structure

```
SecureChat/
├── server.js              # Main server file (Express + Socket.io)
├── package.json           # Dependencies and scripts
├── README.md             # This file
├── TECHNICAL_DOCUMENTATION.md  # Detailed technical documentation
└── public/               # Frontend files
    ├── index.html        # Welcome page
    ├── chat.html         # Chat interface
    ├── styles.css        # Application styles
    ├── chat.js           # Chat client logic
    └── e2ee.js           # Encryption module
```

## Security Features

### End-to-End Encryption

- **Key Exchange**: Diffie-Hellman (2048-bit) for secure key establishment
- **Encryption**: AES-256-GCM for authenticated encryption
- **Key Derivation**: PBKDF2 with 100,000 iterations
- **No Server Access**: Server never sees encryption keys or plaintext messages

### Session Security

- **Cryptographically Secure IDs**: 256-bit random session identifiers
- **Single-Use Links**: Links become invalid after 2 users join
- **Time-Limited**: Sessions expire after 24 hours
- **No Message Storage**: Messages never persisted on server

## Configuration

### Environment Variables

- `PORT`: Server port (default: 3000)

Example:
```bash
PORT=8080 npm start
```

### Session Expiry

Default session expiry is 24 hours. To modify, edit `SESSION_EXPIRY_HOURS` in `server.js`:

```javascript
const SESSION_EXPIRY_HOURS = 24; // Change to desired hours
```

## Development

### Running in Development Mode

```bash
npm start
```

The server will start on `http://localhost:3000` (or the configured PORT).

### Testing

1. Open two browser windows/tabs
2. In the first window, create a new chat and copy the link
3. In the second window, paste the link
4. Send messages between the two windows
5. Verify encryption status indicators
6. Test typing indicators and connection status

## Limitations

- **Two Users Only**: Currently supports exactly 2 users per session
- **No Message History**: Messages are lost if the page is refreshed
- **No Key Verification**: No built-in mechanism to verify peer identity
- **In-Memory Sessions**: Sessions lost on server restart

## Troubleshooting

### Connection Issues

- Ensure the server is running
- Check that port 3000 (or your configured port) is not in use
- Verify WebSocket connections are not blocked by firewall

### Encryption Not Working

- Ensure both users have joined the session
- Check browser console for errors
- Verify WebSocket connection is established

### Session Expired

- Sessions expire after 24 hours
- Sessions also expire after 2 users join
- Create a new session to continue chatting

## Deployment

To deploy SecureChat to the internet so anyone can access it, see [DEPLOYMENT.md](DEPLOYMENT.md) for detailed instructions on deploying to:
- Railway (recommended - easiest)
- Render
- Heroku
- DigitalOcean
- Your own VPS/Server

## Technical Documentation

For detailed information about the encryption implementation, key exchange protocol, and session management, see [TECHNICAL_DOCUMENTATION.md](TECHNICAL_DOCUMENTATION.md).

## License

MIT License - Feel free to use and modify as needed.

## Contributing

Contributions are welcome! Please ensure that:
- Code follows the existing style
- Security properties are maintained
- Documentation is updated

## Disclaimer

This application is provided for educational and demonstration purposes. While it implements strong encryption, users should perform their own security audit before using in production environments.

---

**🔒 Chat Securely. Stay Private.**

