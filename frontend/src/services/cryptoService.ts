const EC_CURVE = 'P-256';

export const cryptoService = {
  // Generate a new ECDH key pair
  generateKeyPair: async (): Promise<CryptoKeyPair> => {
    return await window.crypto.subtle.generateKey(
      {
        name: 'ECDH',
        namedCurve: EC_CURVE,
      },
      true, // extractable (so we can save private key to localStorage)
      ['deriveKey', 'deriveBits']
    );
  },

  // Export public key to base64 string (SPKI format)
  exportPublicKey: async (key: CryptoKey): Promise<string> => {
    const exported = await window.crypto.subtle.exportKey('spki', key);
    const exportedAsString = String.fromCharCode.apply(null, Array.from(new Uint8Array(exported)));
    return btoa(exportedAsString);
  },

  // Import public key from base64 string
  importPublicKey: async (base64Key: string): Promise<CryptoKey> => {
    const binaryDerString = atob(base64Key);
    const binaryDer = new Uint8Array(binaryDerString.length);
    for (let i = 0; i < binaryDerString.length; i++) {
      binaryDer[i] = binaryDerString.charCodeAt(i);
    }
    return await window.crypto.subtle.importKey(
      'spki',
      binaryDer.buffer,
      {
        name: 'ECDH',
        namedCurve: EC_CURVE,
      },
      true,
      []
    );
  },

  // Export private key to JWK object for local storage
  exportPrivateKey: async (key: CryptoKey): Promise<JsonWebKey> => {
    return await window.crypto.subtle.exportKey('jwk', key);
  },

  // Import private key from JWK object
  importPrivateKey: async (jwk: JsonWebKey): Promise<CryptoKey> => {
    return await window.crypto.subtle.importKey(
      'jwk',
      jwk,
      {
        name: 'ECDH',
        namedCurve: EC_CURVE,
      },
      true,
      ['deriveKey', 'deriveBits']
    );
  },

  // Derive AES-GCM shared key from my private key and their public key
  deriveSharedKey: async (privateKey: CryptoKey, publicKey: CryptoKey): Promise<CryptoKey> => {
    return await window.crypto.subtle.deriveKey(
      {
        name: 'ECDH',
        public: publicKey,
      },
      privateKey,
      {
        name: 'AES-GCM',
        length: 256,
      },
      false,
      ['encrypt', 'decrypt']
    );
  },

  // Encrypt a message text using the derived shared key
  encryptMessage: async (text: string, sharedKey: CryptoKey): Promise<string> => {
    const iv = window.crypto.getRandomValues(new Uint8Array(12)); // AES-GCM requires a 12-byte IV
    const encodedText = new TextEncoder().encode(text);

    const ciphertextBuffer = await window.crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv,
      },
      sharedKey,
      encodedText
    );

    // Combine IV and Ciphertext for transport
    const ciphertext = new Uint8Array(ciphertextBuffer);
    const combined = new Uint8Array(iv.length + ciphertext.length);
    combined.set(iv, 0);
    combined.set(ciphertext, iv.length);

    // Convert to base64
    const combinedAsString = String.fromCharCode.apply(null, Array.from(combined));
    return btoa(combinedAsString);
  },

  // Decrypt a message text using the derived shared key
  decryptMessage: async (base64Combined: string, sharedKey: CryptoKey): Promise<string> => {
    const binaryString = atob(base64Combined);
    const combined = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      combined[i] = binaryString.charCodeAt(i);
    }

    // Extract IV and Ciphertext
    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);

    const decryptedBuffer = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv,
      },
      sharedKey,
      ciphertext
    );

    return new TextDecoder().decode(decryptedBuffer);
  }
};
