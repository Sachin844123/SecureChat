/**
 * End-to-End Encryption Module (Browser-Compatible)
 * 
 * This module implements E2EE using:
 * - ECDH (Elliptic Curve Diffie-Hellman) key exchange for secure key establishment
 * - AES-256-GCM for symmetric encryption of messages
 * 
 * Uses Web Crypto API for browser compatibility
 * 
 * Security Properties:
 * - Forward secrecy (keys are ephemeral)
 * - Authenticated encryption (GCM mode)
 * - No server-side key access (keys never sent to server)
 */

class E2EE {
  constructor() {
    this.keyPair = null;
    this.sharedSecret = null;
    this.encryptionKey = null;
    this.algorithm = 'AES-GCM';
    this.keyLength = 256;
  }

  /**
   * Initialize ECDH key exchange
   * Generates a new key pair for this session using P-256 curve
   */
  async initializeKeyExchange() {
    try {
      // Generate ECDH key pair using P-256 curve (supported in all modern browsers)
      this.keyPair = await crypto.subtle.generateKey(
        {
          name: 'ECDH',
          namedCurve: 'P-256'
        },
        true, // extractable
        ['deriveKey', 'deriveBits']
      );
      
      // Export public key for sharing
      const publicKey = await crypto.subtle.exportKey('raw', this.keyPair.publicKey);
      
      return {
        publicKey: this.arrayBufferToBase64(publicKey)
      };
    } catch (error) {
      console.error('Error initializing key exchange:', error);
      throw error;
    }
  }

  /**
   * Compute shared secret from peer's public key
   * This creates a symmetric key that only the two parties can compute
   */
  async computeSharedSecret(peerPublicKeyBase64) {
    try {
      // Import peer's public key
      const peerPublicKeyBuffer = this.base64ToArrayBuffer(peerPublicKeyBase64);
      const peerPublicKey = await crypto.subtle.importKey(
        'raw',
        peerPublicKeyBuffer,
        {
          name: 'ECDH',
          namedCurve: 'P-256'
        },
        false,
        []
      );
      
      // Derive shared secret bits
      const sharedSecretBits = await crypto.subtle.deriveBits(
        {
          name: 'ECDH',
          public: peerPublicKey
        },
        this.keyPair.privateKey,
        256 // 256 bits
      );
      
      this.sharedSecret = sharedSecretBits;
      
      // Derive encryption key using PBKDF2
      // Import shared secret as raw key material for PBKDF2
      const salt = this.stringToArrayBuffer('SecureChat-E2EE-Salt');
      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        sharedSecretBits,
        {
          name: 'PBKDF2'
        },
        false,
        ['deriveKey', 'deriveBits']
      );
      
      // Derive AES-GCM key using PBKDF2 (strengthens the key with iterations)
      this.encryptionKey = await crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: salt,
          iterations: 100000,
          hash: 'SHA-256'
        },
        keyMaterial,
        {
          name: 'AES-GCM',
          length: 256
        },
        false,
        ['encrypt', 'decrypt']
      );
      
      return true;
    } catch (error) {
      console.error('Error computing shared secret:', error);
      return false;
    }
  }

  /**
   * Encrypt a message using AES-256-GCM
   * GCM mode provides authenticated encryption (prevents tampering)
   */
  async encrypt(message) {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not established. Perform key exchange first.');
    }

    try {
      // Generate random 96-bit IV for GCM
      const iv = crypto.getRandomValues(new Uint8Array(12));
      
      // Convert message to ArrayBuffer
      const messageBuffer = this.stringToArrayBuffer(message);
      
      // Encrypt
      const encrypted = await crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv: iv,
          tagLength: 128 // 128-bit authentication tag
        },
        this.encryptionKey,
        messageBuffer
      );
      
      // GCM mode appends the tag to the encrypted data
      // Separate ciphertext and tag (last 16 bytes are the tag)
      const ciphertext = new Uint8Array(encrypted.slice(0, encrypted.byteLength - 16));
      const tag = new Uint8Array(encrypted.slice(encrypted.byteLength - 16));
      
      return {
        encryptedData: this.arrayBufferToBase64(ciphertext),
        iv: this.arrayBufferToBase64(iv),
        tag: this.arrayBufferToBase64(tag)
      };
    } catch (error) {
      console.error('Encryption error:', error);
      throw error;
    }
  }

  /**
   * Decrypt a message using AES-256-GCM
   * Verifies message authenticity using the authentication tag
   */
  async decrypt(encryptedData, ivBase64, tagBase64) {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not established. Perform key exchange first.');
    }

    try {
      const iv = this.base64ToArrayBuffer(ivBase64);
      const tag = this.base64ToArrayBuffer(tagBase64);
      const ciphertext = this.base64ToArrayBuffer(encryptedData);
      
      // Combine ciphertext and tag for GCM decryption
      const encrypted = new Uint8Array(ciphertext.byteLength + tag.byteLength);
      encrypted.set(new Uint8Array(ciphertext), 0);
      encrypted.set(new Uint8Array(tag), ciphertext.byteLength);
      
      // Decrypt (includes tag verification)
      const decrypted = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: iv,
          tagLength: 128
        },
        this.encryptionKey,
        encrypted
      );
      
      return this.arrayBufferToString(decrypted);
    } catch (error) {
      console.error('Decryption error:', error);
      throw new Error('Failed to decrypt message. Possible tampering or wrong key.');
    }
  }

  /**
   * Check if encryption is ready (keys established)
   */
  isReady() {
    return this.encryptionKey !== null;
  }

  /**
   * Reset encryption state (for new session)
   */
  reset() {
    this.keyPair = null;
    this.sharedSecret = null;
    this.encryptionKey = null;
  }

  // Utility functions for ArrayBuffer/String conversions
  stringToArrayBuffer(str) {
    const encoder = new TextEncoder();
    return encoder.encode(str);
  }

  arrayBufferToString(buffer) {
    const decoder = new TextDecoder();
    return decoder.decode(buffer);
  }

  arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }
}

// Make available globally
if (typeof module !== 'undefined' && module.exports) {
  module.exports = E2EE;
} else {
  window.E2EE = E2EE;
}
