# Data Encryption Setup

This application uses AES-256 encryption to protect sensitive Personally Identifiable Information (PII) stored in MongoDB.

## Encrypted Fields

### Employee Model
- `email` - Employee email address
- `mobile` - Mobile phone number
- `address` - Physical address
- `firstName` - First name
- `lastName` - Last name

### Branch Model
- `address` - Branch address
- `phone` - Branch phone number
- `email` - Branch email address

## Setup Instructions

### 1. Generate Encryption Key

Run the key generation script:

```bash
node scripts/generate-encryption-key.js
```

This will generate a secure 32-byte encryption key.

### 2. Configure Environment Variable

Add the encryption key to your `.env.local` file:

```env
ENCRYPTION_KEY=your-generated-32-byte-hex-key-here
```

### 3. Important Notes

⚠️ **CRITICAL SECURITY CONSIDERATIONS:**

1. **Key Management**: 
   - Never commit the encryption key to version control
   - Store the key securely (use a password manager or secret management service)
   - Use different keys for development, staging, and production

2. **Key Backup**:
   - If you lose the encryption key, encrypted data **cannot be decrypted**
   - Keep a secure backup of your encryption key
   - Document where the key is stored for your team

3. **Database Migration**:
   - Existing unencrypted data will be automatically encrypted on the next save
   - The system handles both encrypted and unencrypted data gracefully
   - To encrypt existing data, update each record (trigger a save)

4. **Performance**:
   - Encryption/decryption happens automatically via Mongoose hooks
   - Minimal performance impact for most use cases
   - Encrypted fields are stored in MongoDB in encrypted format

5. **Search Limitations**:
   - Encrypted fields cannot be searched directly in MongoDB
   - Email searches will work but may be slower
   - Consider using a separate search index if needed

## How It Works

1. **On Save**: Before saving to MongoDB, sensitive fields are automatically encrypted using AES-256-CBC
2. **On Retrieve**: After retrieving from MongoDB, sensitive fields are automatically decrypted
3. **Format**: Encrypted data is stored in format: `iv:encryptedData` (base64 encoded)

## Testing Encryption

To verify encryption is working:

1. Check MongoDB directly - you should see encrypted values (containing `:` separator)
2. Check the application - you should see decrypted values
3. Update a record - it should be encrypted on save

## Troubleshooting

### Data appears encrypted in the application
- Check that the `ENCRYPTION_KEY` environment variable is set correctly
- Verify the key matches the one used to encrypt the data
- Check server logs for decryption errors

### Cannot decrypt existing data
- Ensure you're using the same encryption key that was used to encrypt the data
- Old unencrypted data will be automatically encrypted on next save
- If you changed the key, old encrypted data cannot be decrypted

### Performance issues
- Encryption/decryption is fast, but if you have many records, consider batch processing
- Use indexes on non-encrypted fields for better query performance


