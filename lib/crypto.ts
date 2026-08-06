// utils/crypto.ts

// ==========================================
// 1. IMAGE COMPRESSION UTILITY (Client-Side)
// ==========================================
export async function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        
        let width = img.width;
        let height = img.height;
        const MAX_WIDTH = 2048; // Crisp resolution standard for high-quality printing
        
        // Scale down if image resolution exceeds MAX_WIDTH
        if (width > MAX_WIDTH) {
          height = Math.round((height * MAX_WIDTH) / width);
          width = MAX_WIDTH;
        }
        
        canvas.width = width;
        canvas.height = height;
        ctx?.drawImage(img, 0, 0, width, height);
        
        // Export to JPEG at 75% compression quality (reduces size by up to 90%)
        canvas.toBlob((blob) => {
          resolve(blob || file);
        }, "image/jpeg", 0.75);
      };
    };
  });
}

// ==========================================
// 2. ENCRYPTION HELPER (AES-GCM 256-bit)
// ==========================================
export async function encryptFile(
  fileBlob: Blob
): Promise<{ encryptedDataStr: string; keyString: string; ivString: string }> {
  // 1. Generate a random AES-GCM 256-bit key
  const key = await window.crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );

  // 2. Generate a random 12-byte Initialization Vector (IV)
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  // 3. Convert Blob to ArrayBuffer
  const fileBuffer = await fileBlob.arrayBuffer();

  // 4. Encrypt the file buffer
  const encryptedBuffer = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    key,
    fileBuffer
  );

  // 5. Convert encrypted buffer to Base64 String
  const encryptedBytes = new Uint8Array(encryptedBuffer);
  let binary = "";
  for (let i = 0; i < encryptedBytes.byteLength; i++) {
    binary += String.fromCharCode(encryptedBytes[i]);
  }
  const encryptedDataStr = window.btoa(binary);

  // 6. Export the AES Key to Base64 format for storing in Firestore
  const exportedRawKey = await window.crypto.subtle.exportKey("raw", key);
  const exportedRawBytes = new Uint8Array(exportedRawKey);
  let keyBinary = "";
  for (let i = 0; i < exportedRawBytes.byteLength; i++) {
    keyBinary += String.fromCharCode(exportedRawBytes[i]);
  }
  const keyString = window.btoa(keyBinary);

  // 7. Export the IV to Base64
  let ivBinary = "";
  for (let i = 0; i < iv.byteLength; i++) {
    ivBinary += String.fromCharCode(iv[i]);
  }
  const ivString = window.btoa(ivBinary);

  return { encryptedDataStr, keyString, ivString };
}

// ==========================================
// 3. CHUNKING UTILITY (Splits String to ~900KB Chunks)
// ==========================================
export function chunkString(str: string, chunkSize = 900 * 1024): string[] {
  const chunks: string[] = [];
  let offset = 0;
  while (offset < str.length) {
    chunks.push(str.substring(offset, offset + chunkSize));
    offset += chunkSize;
  }
  return chunks;
}

// ==========================================
// 4. DECRYPTION HELPER (Reconstructs original file)
// ==========================================
export async function decryptFile(
  encryptedDataStr: string,
  keyString: string,
  ivString: string,
  fileType: string
): Promise<string> {
  // 1. Import the AES-GCM Key from Base64 string
  const keyBinary = window.atob(keyString);
  const keyBytes = new Uint8Array(keyBinary.length);
  for (let i = 0; i < keyBinary.length; i++) {
    keyBytes[i] = keyBinary.charCodeAt(i);
  }
  const key = await window.crypto.subtle.importKey(
    "raw",
    keyBytes.buffer,
    { name: "AES-GCM" },
    true,
    ["decrypt"]
  );

  // 2. Decode the IV from Base64 string
  const ivBinary = window.atob(ivString);
  const iv = new Uint8Array(ivBinary.length);
  for (let i = 0; i < ivBinary.length; i++) {
    iv[i] = ivBinary.charCodeAt(i);
  }

  // 3. Decode the Encrypted Data from Base64 string
  const encryptedBinary = window.atob(encryptedDataStr);
  const encryptedBytes = new Uint8Array(encryptedBinary.length);
  for (let i = 0; i < encryptedBinary.length; i++) {
    encryptedBytes[i] = encryptedBinary.charCodeAt(i);
  }

  // 4. Decrypt the binary buffer
  const decryptedBuffer = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv },
    key,
    encryptedBytes.buffer
  );

  // 5. Convert decrypted buffer back into a local browser URL blob
  const decryptedBlob = new Blob([decryptedBuffer], { type: fileType });
  return URL.createObjectURL(decryptedBlob);
}