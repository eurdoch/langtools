import express from 'express';
import axios from 'axios';
import { PollyClient, SynthesizeSpeechCommand } from "@aws-sdk/client-polly";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import OpenAI from 'openai';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { MongoClient } from 'mongodb';

const app = express();
app.use(express.json());

const config = {
  AWS_REGION: process.env.AWS_REGION || "us-east-1",
  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
  MODEL_ID: "anthropic.claude-3-5-sonnet-20240620-v1:0",
};

const pollyClient = new PollyClient({
  region: config.AWS_REGION, 
  credentials: {
    accessKeyId: config.AWS_ACCESS_KEY_ID,
    secretAccessKey: config.AWS_SECRET_ACCESS_KEY,
  }
});

// Initialize AWS SES client for email verification
const sesClient = new SESClient({
  region: config.AWS_REGION,
  credentials: {
    accessKeyId: config.AWS_ACCESS_KEY_ID,
    secretAccessKey: config.AWS_SECRET_ACCESS_KEY
  }
});

// Verification configuration
const SES_SENDER_EMAIL = process.env.SES_SENDER_EMAIL || 'athousandapps@gmail.com';
const JWT_SECRET = process.env.JWT_SECRET || 'langpub-jwt-secret-key-development-only';
const JWT_EXPIRES_IN = '30d';
const DEMO_JWT_EXPIRES_IN = '2h';
const DEMO_EMAIL = process.env.DEMO_EMAIL;
const VERIFICATION_CODE_EXPIRY = 10 * 60 * 1000; // 10 minutes

// In-memory store for verification codes (in production, use a database)
const verificationCodes = new Map();

// MongoDB connection
let db = null;
let userCollection = null;
let verificationCollection = null;

// Initialize MongoDB connection
const initializeDatabase = async () => {
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      console.error('MONGO_URI environment variable is not set');
      return;
    }

    const client = new MongoClient(mongoUri);
    await client.connect();
    console.log('Connected to MongoDB successfully');
    
    db = client.db('langpub');
    userCollection = db.collection('users');
    verificationCollection = db.collection('verification_codes');
    
    // Create indexes for better performance
    await userCollection.createIndex({ user_id: 1 }, { unique: true });
    await userCollection.createIndex({ email: 1 });
    await verificationCollection.createIndex({ email: 1 });
    await verificationCollection.createIndex({ expires: 1 }, { expireAfterSeconds: 0 });
    
    console.log('Database indexes created successfully');
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error);
  }
};

// Initialize database connection
initializeDatabase();

const LANGUAGE_TO_VOICE = {
  'French': 'Mathieu',
  'Dutch': 'Ruben',
  'English': 'Matthew',
  'German': 'Hans',
  'Spanish': 'Enrique',
  'Italian': 'Giorgio',
  'Japanese': 'Takumi',
  'Portuguese': 'Cristiano',
  'Chinese': 'Zhiwei'
};

// Email hash function for consistent user ID generation
const generateConsistentHash = (email) => {
  const normalizedEmail = email.toLowerCase();
  const salt = process.env.SALT || 'langpub-default-salt';
  
  const hashSegment = (input, seed) => {
    let result = 0;
    const data = input + salt + seed.toString();
    
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      result = ((result << 5) - result) + char;
      result = result & result;
    }
    
    let secondResult = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      secondResult = ((secondResult << 7) + secondResult) ^ char;
      secondResult = secondResult & secondResult;
    }
    
    const hex = Math.abs(result ^ secondResult).toString(16);
    return hex.padStart(8, '0');
  };
  
  const segments = 8;
  let hashParts = [];
  
  for (let i = 0; i < segments; i++) {
    const segmentInput = normalizedEmail + i.toString();
    hashParts.push(hashSegment(segmentInput, i));
  }
  
  return hashParts.join('');
};

// Generate a verification code
const generateVerificationCode = () => {
  return crypto.randomInt(100000, 999999).toString();
};

// Cleanup expired verification codes
const cleanupExpiredCodes = async () => {
  try {
    // Cleanup in-memory codes
    const now = Date.now();
    for (const [email, data] of verificationCodes.entries()) {
      if (data.expires < now) {
        verificationCodes.delete(email);
      }
    }
    
    // Cleanup database codes (if database is available)
    if (verificationCollection) {
      await verificationCollection.deleteMany({
        expires: { $lt: new Date() }
      });
      console.log('Cleaned up expired verification codes from database');
    }
  } catch (error) {
    console.error('Error cleaning up expired verification codes:', error);
  }
};

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Run cleanup periodically
setInterval(cleanupExpiredCodes, 60 * 60 * 1000); // Every hour

app.get('/ping', (req, res) => {
  console.log('Received /ping request');
  res.status(200).send('pong');
});

// Send verification email
app.post('/verification/send', async (req, res) => {
  const { email } = req.body;
  
  if (!email) {
    return res.status(400).json({ error: 'Email address is required' });
  }

  // For demo account, skip actual verification
  if (email === DEMO_EMAIL) {
    console.log('Demo account detected, skipping email verification send');
    return res.status(200).json({
      status: 'pending',
      to: email,
      channel: 'email',
      date_created: new Date().toISOString(),
      valid: true
    });
  }

  try {
    // Generate a verification code
    const verificationCode = generateVerificationCode();
    
    // Store the code in database (fallback to memory if database not available)
    const expiryTime = new Date(Date.now() + VERIFICATION_CODE_EXPIRY);
    
    if (verificationCollection) {
      await verificationCollection.updateOne(
        { email: email.toLowerCase() },
        { 
          $set: { 
            email: email.toLowerCase(),
            code: verificationCode,
            expires: expiryTime,
            created_at: new Date()
          } 
        },
        { upsert: true }
      );
    } else {
      // Fallback to in-memory storage
      verificationCodes.set(email.toLowerCase(), {
        code: verificationCode,
        expires: Date.now() + VERIFICATION_CODE_EXPIRY,
        created_at: new Date()
      });
    }
    
    // Prepare the email
    const sendEmailCommand = new SendEmailCommand({
      Destination: {
        ToAddresses: [email],
      },
      Message: {
        Body: {
          Html: {
            Charset: "UTF-8",
            Data: `
              <!DOCTYPE html>
              <html lang="en">
              <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>LangPub Sign In</title>
                <style>
                  body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
                    line-height: 1.6;
                    color: #333;
                    max-width: 600px;
                    margin: 0 auto;
                    padding: 20px;
                    background-color: #f8f9fa;
                  }
                  .container {
                    background: white;
                    border-radius: 12px;
                    padding: 40px;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
                    border: 1px solid #e9ecef;
                  }
                  .header {
                    text-align: center;
                    margin-bottom: 30px;
                    padding-bottom: 20px;
                    border-bottom: 1px solid #e9ecef;
                  }
                  .logo {
                    width: 60px;
                    height: 60px;
                    border-radius: 50%;
                    margin: 0 auto 15px;
                    background: linear-gradient(135deg, #007bff 0%, #0056b3 100%);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    font-size: 24px;
                    font-weight: bold;
                  }
                  .title {
                    margin: 0;
                    font-size: 24px;
                    font-weight: 600;
                    color: #2c3e50;
                  }
                  .subtitle {
                    margin: 5px 0 0;
                    font-size: 16px;
                    color: #6c757d;
                  }
                  .code-section {
                    text-align: center;
                    margin: 30px 0;
                    padding: 25px;
                    background: #f8f9fa;
                    border-radius: 8px;
                    border: 2px dashed #dee2e6;
                  }
                  .code {
                    font-size: 32px;
                    font-weight: bold;
                    color: #007bff;
                    letter-spacing: 4px;
                    font-family: 'Courier New', monospace;
                    margin: 10px 0;
                  }
                  .code-label {
                    font-size: 14px;
                    color: #6c757d;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                    margin-bottom: 5px;
                  }
                  .instructions {
                    background: #e3f2fd;
                    border-left: 4px solid #2196f3;
                    padding: 15px 20px;
                    margin: 25px 0;
                    border-radius: 0 6px 6px 0;
                  }
                  .instructions h3 {
                    margin: 0 0 10px;
                    color: #1976d2;
                    font-size: 16px;
                  }
                  .instructions p {
                    margin: 0;
                    font-size: 14px;
                    color: #424242;
                  }
                  .security-notice {
                    background: #fff3cd;
                    border: 1px solid #ffeaa7;
                    border-radius: 6px;
                    padding: 15px;
                    margin: 25px 0;
                    font-size: 14px;
                    color: #856404;
                  }
                  .footer {
                    text-align: center;
                    margin-top: 30px;
                    padding-top: 20px;
                    border-top: 1px solid #e9ecef;
                    font-size: 12px;
                    color: #6c757d;
                  }
                  .footer a {
                    color: #007bff;
                    text-decoration: none;
                  }
                </style>
              </head>
              <body>
                <div class="container">
                  <div class="header">
                    <div class="logo">L</div>
                    <h1 class="title">Sign in to LangPub</h1>
                    <p class="subtitle">Your language learning companion</p>
                  </div>
                  
                  <div class="code-section">
                    <div class="code-label">Your verification code</div>
                    <div class="code">${verificationCode}</div>
                  </div>
                  
                  <div class="instructions">
                    <h3>How to complete sign in:</h3>
                    <p>Enter this 6-digit code in the LangPub app to complete your sign in. This code is valid for 10 minutes.</p>
                  </div>
                  
                  <div class="security-notice">
                    <strong>Security Notice:</strong> If you didn't request this code, please ignore this email. Never share your verification codes with anyone.
                  </div>
                  
                  <div class="footer">
                    <p>This email was sent to ${email}</p>
                    <p>© ${new Date().getFullYear()} LangPub. All rights reserved.</p>
                  </div>
                </div>
              </body>
              </html>
            `,
          },
          Text: {
            Charset: "UTF-8",
            Data: `LANGPUB - Sign In Verification

Your verification code: ${verificationCode}

Enter this 6-digit code in the LangPub app to complete your sign in. This code will expire in 10 minutes.

Security Notice: If you didn't request this code, please ignore this email. Never share your verification codes with anyone.

This email was sent to ${email}
© ${new Date().getFullYear()} LangPub. All rights reserved.`,
          },
        },
        Subject: {
          Charset: "UTF-8",
          Data: "Your LangPub sign in code",
        },
      },
      Source: SES_SENDER_EMAIL,
      ReplyToAddresses: [SES_SENDER_EMAIL],
    });
    
    // Send the email
    await sesClient.send(sendEmailCommand);
    
    // Return success response
    res.status(200).json({
      status: 'pending',
      to: email,
      channel: 'email',
      date_created: new Date().toISOString(),
      valid: true
    });
  } catch (error) {
    console.error('Error sending verification code:', error);
    res.status(500).json({
      error: error.message || 'Failed to send verification code'
    });
  }
});

// Check verification code
app.post('/verification/check', async (req, res) => {
  const { email, code } = req.body;
  
  if (!email || !code) {
    return res.status(400).json({ 
      error: 'Email and verification code are required' 
    });
  }

  try {
    let verificationStatus = 'pending';
    
    // Check if this is the demo account
    if (email === DEMO_EMAIL) {
      console.log('Demo account detected, bypassing verification');
      verificationStatus = 'approved';
    } else {
      // Find verification code in database or memory
      let storedVerification = null;
      
      if (verificationCollection) {
        storedVerification = await verificationCollection.findOne({
          email: email.toLowerCase(),
          code: code,
          expires: { $gt: new Date() }
        });
        
        if (storedVerification) {
          verificationStatus = 'approved';
          // Delete the used code from database
          await verificationCollection.deleteOne({ _id: storedVerification._id });
        }
      } else {
        // Fallback to in-memory verification
        storedVerification = verificationCodes.get(email.toLowerCase());
        
        if (storedVerification && storedVerification.code === code && storedVerification.expires > Date.now()) {
          verificationStatus = 'approved';
          // Delete the used code
          verificationCodes.delete(email.toLowerCase());
        }
      }
      
      if (!storedVerification || verificationStatus !== 'approved') {
        verificationStatus = 'failed';
      }
    }

    // If verification is successful, generate JWT and return user data
    if (verificationStatus === 'approved') {
      // Generate user ID from email
      const userId = generateConsistentHash(email);
      console.log('Generated user ID from email:', userId);
      
      // Check if user exists in database and create/update as needed
      let user = null;
      let userResponse = null;
      
      if (userCollection) {
        // Try to find the user by user_id
        user = await userCollection.findOne({ user_id: userId });
        
        if (user) {
          console.log('User found in database:', user.user_id);
          
          // Update last login time
          await userCollection.updateOne(
            { user_id: userId },
            { 
              $set: { 
                last_login: new Date(),
                email: email // Update email in case it changed case
              }
            }
          );
          
          // Get the updated user data
          user = await userCollection.findOne({ user_id: userId });
        } else {
          console.log('Creating new user with ID:', userId);
          
          // Create a new user entry
          const newUser = {
            user_id: userId,
            email: email,
            created_at: new Date(),
            last_login: new Date(),
            premium: false,
            premium_updated_at: null,
            subscription_receipts: [],
            settings: {
              preferred_languages: [],
              font_size: 100
            }
          };
          
          // Insert the new user into the database
          const result = await userCollection.insertOne(newUser);
          console.log('New user created with DB ID:', result.insertedId);
          
          // Get the created user
          user = await userCollection.findOne({ _id: result.insertedId });
        }
        
        // Generate JWT for the user
        const token = jwt.sign(
          { 
            user_id: userId,
            email: email,
            is_demo: email === DEMO_EMAIL,
          }, 
          JWT_SECRET, 
          { expiresIn: email === DEMO_EMAIL ? DEMO_JWT_EXPIRES_IN : JWT_EXPIRES_IN }
        );
        
        // Create the user response with token
        userResponse = {
          user_id: user.user_id,
          email: user.email,
          token: token,
          premium: user.premium || false,
          created_at: user.created_at,
          last_login: user.last_login,
          settings: user.settings || {}
        };
      } else {
        console.log('No database connection, creating minimal user response');
        
        // Generate JWT for the user
        const token = jwt.sign(
          { 
            user_id: userId,
            email: email,
            is_demo: email === DEMO_EMAIL,
          }, 
          JWT_SECRET, 
          { expiresIn: email === DEMO_EMAIL ? DEMO_JWT_EXPIRES_IN : JWT_EXPIRES_IN }
        );
        
        // Create a minimal user response without database
        userResponse = {
          user_id: userId,
          email: email,
          token: token,
          premium: false,
          created_at: new Date(),
          last_login: new Date(),
          settings: {}
        };
      }
      
      res.status(200).json(userResponse);
    } else {
      // If verification failed
      res.status(400).json({ 
        status: verificationStatus,
        error: 'Verification failed',
        message: 'The verification code is invalid or expired'
      });
    }
  } catch (error) {
    console.error('Error checking verification code:', error);
    res.status(500).json({
      error: error.message || 'Failed to check verification code'
    });
  }
});

// Get user information route
app.get('/verification/user', authenticateToken, async (req, res) => {
  try {
    // Extract user_id from the authenticated token
    const { user_id, email, is_demo } = req.user;
    
    if (!user_id) {
      return res.status(400).json({ error: 'Invalid user token' });
    }

    // Look up user in the database if available
    if (userCollection) {
      const user = await userCollection.findOne({ user_id });
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      // Return user information from database
      res.status(200).json({
        user_id: user.user_id,
        email: user.email || '',
        premium: user.premium || false,
        created_at: user.created_at,
        last_login: user.last_login,
        is_demo: is_demo || false,
        settings: user.settings || {}
      });
    } else {
      // If no database connection, return minimal user info from token
      res.status(200).json({
        user_id: user_id,
        email: email || '',
        premium: false,
        created_at: new Date(),
        last_login: new Date(),
        is_demo: is_demo || false,
        settings: {}
      });
    }
  } catch (error) {
    console.error('Error getting user information:', error);
    res.status(500).json({
      error: error.message || 'Failed to retrieve user information'
    });
  }
});

app.post('/translate', async (req, res) => {
  console.log('Received /translate request');
  const { language, text } = req.body;
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;

  if (!anthropicApiKey) {
    res.status(500).send('ANTHROPIC_API_KEY must be set');
    return;
  }

  const prompt = `Translate the following text from source language to target language. Only return the translated text.
Do not return any text like 'The following is a translation'. Just the translation.

Source language: ${language}
Target language: English
Text: ${text}
`;

  try {
    const response = await axios.post('https://api.anthropic.com/v1/messages', {
      model: 'claude-3-haiku-20240307',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    }, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01'
      }
    });

    const translatedText = response.data.content[0].text;
    res.status(200).json({ translated_text: translatedText });
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/speech', async (req, res) => {
  console.log('Received /speech request');
  const { language, text } = req.body;
  const voiceId = LANGUAGE_TO_VOICE[language];

  if (!voiceId) {
    res.status(400).send('Invalid language');
    return;
  }

  try {
    const command = new SynthesizeSpeechCommand({
      Text: text,
      OutputFormat: "mp3", // Can be "mp3", "ogg_vorbis", or "pcm"
      VoiceId: voiceId,
    });

    const response = await pollyClient.send(command);

    if (response.AudioStream) {
      const audioBuffer = await response.AudioStream.transformToByteArray();
      console.log('Speech synthesis successful');
      res.status(200);
      res.set({
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.length
      });

    res.send(Buffer.from(audioBuffer));
    } else {
      res.status(500).send('Failed to generate speech');
    }
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/language', async (req, res) => {
  console.log('Received /language request');
  const { text } = req.body;
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;

  if (!anthropicApiKey) {
    res.status(500).send('ANTHROPIC_API_KEY must be set');
    return;
  }

  const prompt = `
Format your response as JSON with field language.

Return the language of the text in this webpage in the style of { language: "Spanish" }. 

Text: ${text}
`;

  try {
    const response = await axios.post('https://api.anthropic.com/v1/messages', {
      model: 'claude-3-haiku-20240307',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    }, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01'
      }
    });

    // TODO if parse fails retry query
    const language = response.data.content[0].text;
    const parsed = JSON.parse(language);
    res.status(200).json(parsed);
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/verb-tenses', async (req, res) => {
  console.log('Received /verb-tenses request');
  const { verb } = req.body;
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;

  if (!anthropicApiKey) {
    res.status(500).send('ANTHROPIC_API_KEY must be set');
    return;
  }

  const prompt = `
Return all tenses and conjugations of the verb ${verb}, including the infinitive and affirmative along with translation in English.
`;

  try {
    const response = await axios.post('https://api.anthropic.com/v1/messages', {
      model: 'claude-3-haiku-20240307',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    }, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01'
      }
    });

    const verbTenses = response.data.content[0].text;
    const jsonResponse = {
      message: verbTenses,
    }
    res.status(200).json(jsonResponse);
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/marks', async (req, res) => {
  console.log('Received /marks request');
  const { language, text } = req.body;
  console.log('Language: ', language);
  console.log('Text', text);
  const voiceId = LANGUAGE_TO_VOICE[language];

  if (!voiceId) {
    res.status(400).send('Invalid language');
    return;
  }

  try {
    const command = new SynthesizeSpeechCommand({
      Text: text,
      OutputFormat: "json",
      VoiceId: voiceId,
      SpeechMarkTypes: ["word"]
    });

    const response = await pollyClient.send(command);

    if (response.AudioStream) {
      const chunks = [];
      for await (const chunk of response.AudioStream) {
        chunks.push(chunk);
      }
      
      const buffer = Buffer.concat(chunks);
      const markData = buffer.toString('utf8');
      
      // Parse each line as JSON objects and return as array
      const marks = markData.trim().split('\n').map(line => JSON.parse(line));
      
      console.log('Speech marks generated successfully');
      res.status(200).json({ marks });
    } else {
      res.status(500).send('Failed to generate speech marks');
    }
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/explain', async (req, res) => {
  console.log('Received /explain request');
  const { word, language, sentence } = req.body;
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;

  if (!anthropicApiKey) {
    res.status(500).send('ANTHROPIC_API_KEY must be set');
    return;
  }

  const prompt = `
Explain the meaning of the following word using English in the context of the given sentence. 
Provide a clear and concise explanation suitable for language learners.

Sentence: ${sentence}
Language: ${language}
Word: ${word}
`;

  try {
    const response = await axios.post('https://api.anthropic.com/v1/messages', {
      model: 'claude-3-haiku-20240307',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    }, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01'
      }
    });

    const explanation = response.data.content[0].text;
    res.status(200).json({ explanation });
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/chat', async (req, res) => {
  console.log('Received /chat request');
  console.log('Request body:', req.body);
  const { messages, language } = req.body;
  
  // Validate required parameters
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    console.error('Missing or invalid messages array');
    res.status(400).send('Missing or invalid messages array');
    return;
  }
  
  if (!language) {
    console.error('Missing language parameter');
    res.status(400).send('Missing language parameter');
    return;
  }
  
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;

  if (!anthropicApiKey) {
    res.status(500).send('ANTHROPIC_API_KEY must be set');
    return;
  }

  // Create the system prompt to establish context
  const systemPrompt = `You are a language learning assistant helping someone learn ${language}. 
Provide helpful, concise explanations in English about word meanings, usage, grammar, or any other aspects they ask about.
Your responses should be informative and educational, helping the learner understand the language better.`;

  let formattedMessages = [];

  // Add the conversation history
  messages.forEach(message => {
    formattedMessages.push({
      role: message.role,
      content: message.content
    });
  });

  try {
    console.log('Sending request to Anthropic API with formatted messages:', JSON.stringify(formattedMessages));
    
    const response = await axios.post('https://api.anthropic.com/v1/messages', {
      system: systemPrompt,
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 8096,
      messages: formattedMessages
    }, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01'
      }
    });

    console.log('Received response from Anthropic API:', response.status);
    
    if (response.data && response.data.content && response.data.content[0]) {
      const aiResponse = response.data.content[0].text;
      console.log('AI response:', aiResponse.substring(0, 100) + '...');
      res.status(200).json({ response: aiResponse });
    } else {
      console.error('Unexpected response structure from Anthropic API:', JSON.stringify(response.data));
      res.status(500).json({ 
        error: 'Unexpected API response structure', 
        details: 'The AI response did not contain expected content'
      });
    }
  } catch (err) {
    console.error('Error communicating with Anthropic API:');
    if (err.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.error('Response error data:', err.response.data);
      console.error('Response error status:', err.response.status);
      console.error('Response error headers:', err.response.headers);
      res.status(err.response.status).json({ 
        error: 'API Error', 
        details: err.response.data,
        message: err.message
      });
    } else if (err.request) {
      // The request was made but no response was received
      console.error('No response received:', err.request);
      res.status(500).json({ 
        error: 'No response from API',
        message: err.message
      });
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error('Error setting up request:', err.message);
      res.status(500).json({ 
        error: 'Request setup error',
        message: err.message
      });
    }
  }
});

app.post('/query', async (req, res) => {
  console.log('Received /query request');
  const { prompt } = req.body;
  const deepseekApiKey = process.env.DEEPSEEK_API_KEY;

  if (!deepseekApiKey) {
    res.status(500).send('DEEPSEEK_API_KEY must be set');
    return;
  }

  try {
    const openai = new OpenAI({
      baseURL: 'https://api.deepseek.com',
      apiKey: deepseekApiKey
    });
    const completion = await openai.chat.completions.create({
      model: "deepseek-chat",
      messages: [
	{ role: 'user', content: prompt },
      ],
      max_tokens: 1024,
      response_format: {
        'type': 'json_object',
      }
    });

    const jsonResponse = JSON.parse(completion.choices[0].message.content);
    res.status(200).json(jsonResponse);
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});


app.listen(3004, () => {
  console.log('Server listening on port 3004');
});

