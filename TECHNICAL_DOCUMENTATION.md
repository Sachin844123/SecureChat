# SecureChat - Technical Documentation

## Overview

SecureChat is a real-time, end-to-end encrypted (E2EE) chat application that enables secure messaging without requiring user accounts. This document outlines the technical implementation details for the encryption mechanism, key exchange, and session management.

## Architecture

### Technology Stack
- **Backend**: Node.js with Express.js framework
- **Real-time Communication**: Socket.io (WebSocket-based)
- **Encryption**: Built-in Node.js `crypto` module
- **Frontend**: Vanilla JavaScript (no frameworks)

## End-to-End Encryption (E2EE) Implementation

### Encryption Mechanism

The application implements E2EE using a hybrid approach:

1. **Key Exchange**: ECDH (Elliptic Curve Diffie-Hellman) key exchange protocol using P-256 curve
2. **Symmetric Encryption**: AES-256-GCM (Advanced Encryption Standard, 256-bit key, Galois/Counter Mode)

### Why This Approach?

- **ECDH (Elliptic Curve)**: Provides perfect forward secrecy with smaller key sizes and better performance than traditional DH. Uses P-256 curve (supported natively in all modern browsers via Web Crypto API)
- **AES-256-GCM**: Provides authenticated encryption, ensuring both confidentiality and integrity of messages
- **Web Crypto API**: Native browser support ensures compatibility and performance without additional dependencies
- **No Server Key Access**: The server never sees plaintext messages or encryption keys

### Key Exchange Protocol

#### Step 1: Session Initialization
When a user creates or joins a chat session:

1. Each client generates an ECDH key pair using the P-256 elliptic curve (via Web Crypto API)
2. Both users use the same curve parameters (P-256 is standardized)
3. Public keys are exchanged via WebSocket

#### Step 2: Public Key Exchange
```
User A                          Server                          User B
  |                               |                               |
  |-- Generate ECDH key pair       |                               |
  |   (publicKeyA)                 |                               |
  |                               |                               |
  |-- Send publicKeyA ------------>|                               |
  |                               |-- Forward publicKeyA -------->|
  |                               |   (publicKeyA)                 |
  |                               |<-- Send publicKeyB -------------|
  |                               |   (publicKeyB)                 |
  |<-- Receive publicKeyB ---------|                               |
  |   (publicKeyB)                 |                               |
```

#### Step 3: Shared Secret Computation
Both users compute the same shared secret using ECDH:
- User A: `sharedSecret = ECDH(privateKeyA, publicKeyB)`
- User B: `sharedSecret = ECDH(privateKeyB, publicKeyA)`

Due to the mathematical properties of elliptic curve cryptography, both computations yield the same result without either party revealing their private key.

#### Step 4: Key Derivation
The shared secret is then used with PBKDF2 (Password-Based Key Derivation Function 2) to derive the AES encryption key:

```
encryptionKey = PBKDF2(
  sharedSecret,
  salt="SecureChat-E2EE-Salt",
  iterations=100000,
  keyLength=32 bytes (256 bits),
  hashAlgorithm=SHA-256
)
```

### Message Encryption/Decryption

#### Encryption Process
1. Generate a random 96-bit Initialization Vector (IV) for each message
2. Encrypt message using AES-256-GCM with the derived encryption key
3. Generate an authentication tag (128 bits) for integrity verification
4. Send `{encryptedData, iv, tag}` to the server

#### Decryption Process
1. Receive `{encryptedData, iv, tag}` from the server
2. Decrypt using AES-256-GCM with the same encryption key
3. Verify authentication tag to ensure message integrity
4. Display decrypted message if verification passes

### Security Properties

1. **Forward Secrecy**: Each session uses ephemeral keys. Compromising a session key doesn't expose past sessions.

2. **Authenticated Encryption**: GCM mode provides authentication, preventing tampering attacks.

3. **No Persistent Storage**: Keys and messages are never stored on the server.

4. **Non-Guessable Sessions**: Session IDs are 256-bit (32 bytes) cryptographically random values, making brute-force attacks infeasible.

## Session Management

### Session ID Generation

Session IDs are generated using cryptographically secure random number generation:

```javascript
sessionId = crypto.randomBytes(32).toString('base64url')
```

This produces a 256-bit random value encoded in URL-safe base64 format (approximately 43 characters).

### Session Lifecycle

1. **Creation**: When a user creates a new chat, a unique session ID is generated
2. **Activation**: Session becomes active when the first user joins
3. **Joining**: Second user joins using the shared link
4. **Expiration**: Sessions expire under two conditions:
   - After 24 hours from creation (time-based expiry)
   - After 2 users have joined (capacity limit)

### Session Validation

The server validates session IDs using:
- Format validation: Must match base64url pattern with correct length
- Existence check: Session must exist in memory
- Capacity check: Session must not exceed 2 users
- Time-based check: Session must not exceed 24-hour lifetime

### No Message Persistence

Messages are handled in-memory only:
- Messages exist in transit via WebSocket
- No database or file storage
- Messages are discarded immediately after delivery
- Server acts as a relay only, never storing message content

## Link Generation and Sharing

### Link Format
```
https://[domain]/chat/[SessionID]
```

Example:
```
https://securechat.example.com/chat/aBcD1234eFgH5678iJkL9012mNoP3456qRsT7890uVwX
```

### Link Properties

1. **Uniqueness**: Each session ID is unique (collision probability is negligible)
2. **Non-Guessable**: 256-bit entropy makes brute-force attacks impractical
3. **Single-Use**: Link becomes invalid after 2 users join
4. **Time-Limited**: Links expire after 24 hours

### Security Considerations

- Links contain sufficient entropy to prevent enumeration attacks
- Session IDs are not sequential or predictable
- No user-visible pattern in session generation
- Server validates all session access attempts

## Network Protocol

### WebSocket Events

#### Client → Server
- `create-session`: Request new chat session
- `join-session`: Join existing session by ID
- `key-exchange`: Send DH public key and parameters
- `encrypted-message`: Send encrypted message
- `typing`: Send typing indicator status

#### Server → Client
- `user-joined`: Notification that another user joined
- `user-left`: Notification that user disconnected
- `key-exchange`: Receive peer's DH public key and parameters
- `encrypted-message`: Receive encrypted message from peer
- `user-typing`: Receive typing indicator from peer
- `error`: Error notification

### Message Flow Example

```
1. User A creates session → Server generates sessionId
2. User A receives link: /chat/[sessionId]
3. User A shares link with User B
4. User B opens link → Joins session
5. Both users exchange DH keys via server
6. Both compute shared secret locally
7. Messages encrypted with shared key
8. Encrypted messages relayed by server
9. Each user decrypts peer's messages
```

## Limitations and Future Enhancements

### Current Limitations

1. **Two-Party Only**: Currently supports exactly 2 users per session
2. **In-Memory Sessions**: Sessions lost on server restart
3. **No Message History**: Messages lost if user refreshes page
4. **No Key Verification**: No mechanism to verify peer identity (potential MITM vulnerability)

### Potential Enhancements

1. **Multi-Party Support**: Extend to group chats
2. **Key Verification**: Implement QR code or fingerprint comparison
3. **Message History**: Client-side encrypted storage
4. **Session Persistence**: Optional session backup with encrypted keys
5. **Perfect Forward Secrecy per Message**: Rotate keys for each message

## Cryptography References

- **Diffie-Hellman**: RFC 2631, NIST SP 800-56A
- **AES**: FIPS PUB 197
- **GCM Mode**: NIST SP 800-38D
- **PBKDF2**: RFC 2898

## Conclusion

SecureChat provides a secure, privacy-focused messaging solution with true end-to-end encryption. The implementation prioritizes security, privacy, and ease of use, ensuring that users can communicate confidentially without the need for accounts or persistent storage.

