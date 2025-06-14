import React, { useState, useRef, ChangeEvent, useEffect } from 'react'
import './App.css'
import BookViewer from './components/BookViewer'
import VolumeUpIcon from '@mui/icons-material/VolumeUp'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import FormatSizeIcon from '@mui/icons-material/FormatSize'
import AddIcon from '@mui/icons-material/Add'
import RemoveIcon from '@mui/icons-material/Remove'
import IconButton from '@mui/material/IconButton'
import CircularProgress from '@mui/material/CircularProgress'
import Button from '@mui/material/Button'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogTitle from '@mui/material/DialogTitle'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import TextField from '@mui/material/TextField'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import { availableLanguages } from './language'

// Interface for the persisted state
interface AppState {
  currentFile: string | null;
  currentLocation: string | number;
  bookLanguage: string | null;
  fontSize: number;
}

// Interface for user authentication
interface UserData {
  user_id: string;
  email: string;
  token: string;
  premium: boolean;
  created_at: string;
  last_login: string;
}

function App() {
  // Authentication states
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false)
  const [userData, setUserData] = useState<UserData | null>(null)
  const [email, setEmail] = useState<string>('')
  const [verificationCode, setVerificationCode] = useState<string>('')
  const [isEmailSent, setIsEmailSent] = useState<boolean>(false)
  const [isSendingEmail, setIsSendingEmail] = useState<boolean>(false)
  const [isVerifying, setIsVerifying] = useState<boolean>(false)
  const [authError, setAuthError] = useState<string | null>(null)

  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [selectedText, setSelectedText] = useState<string | null>(null)
  const [translatedText, setTranslatedText] = useState<string | null>(null)
  const [isTranslating, setIsTranslating] = useState<boolean>(false)
  const [bookLanguage, setBookLanguage] = useState<string | null>(null)
  const [isLoadingAudio, setIsLoadingAudio] = useState<boolean>(false)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [currentLocation, setCurrentLocation] = useState<string | number>(0)
  const [fontSize, setFontSize] = useState<number>(100) // Track the current font size
  
  // Word details states
  const [selectedWord, setSelectedWord] = useState<string | null>(null)
  const [translatedWord, setTranslatedWord] = useState<string | null>(null)
  const [isTranslatingWord, setIsTranslatingWord] = useState<boolean>(false)
  const [wordAudioUrl, setWordAudioUrl] = useState<string | null>(null)
  const [isLoadingWordAudio, setIsLoadingWordAudio] = useState<boolean>(false)
  const wordAudioRef = useRef<HTMLAudioElement | null>(null)
  
  // Chat explanation states
  const [chatMessages, setChatMessages] = useState<{role: string, content: string}[]>([])
  const [isExplainingWord, setIsExplainingWord] = useState<boolean>(false)
  const [newChatMessage, setNewChatMessage] = useState<string>('')
  
  // Reference to the BookViewer component
  const bookViewerRef = useRef<any>(null)
  
  // Language selection dialog state
  const [languageDialogOpen, setLanguageDialogOpen] = useState<boolean>(false)
  const [pendingTranslationText, setPendingTranslationText] = useState<string | null>(null)
  
  // Word selection mode state
  const [isSelectionMode, setIsSelectionMode] = useState<boolean>(false)
  const [selectedWords, setSelectedWords] = useState<string[]>([])
  const selectionTimeoutRef = useRef<number | null>(null)
  
  // Flag to avoid saving state during initial load
  const initialLoadRef = useRef<boolean>(true)
  
  // Check for existing authentication on app load
  useEffect(() => {
    const checkExistingAuth = () => {
      try {
        const storedUserData = localStorage.getItem('langpub_user')
        if (storedUserData) {
          const userData = JSON.parse(storedUserData) as UserData
          setUserData(userData)
          setIsAuthenticated(true)
          console.log('User authenticated from storage:', userData.email)
        }
      } catch (error) {
        console.error('Error checking existing authentication:', error)
        localStorage.removeItem('langpub_user')
      }
    }

    checkExistingAuth()
  }, [])

  // Load app state from disk when component mounts
  useEffect(() => {
    const loadAppState = async () => {
      try {
        console.log('Loading app state from disk...')
        const result = await window.ipcRenderer.loadAppState()
        
        if (result.success && result.data) {
          console.log('State loaded:', result.data)
          
          // Apply the loaded state
          const state = result.data as AppState
          
          if (state.currentFile) {
            setSelectedFile(state.currentFile)
          }
          
          if (state.bookLanguage) {
            setBookLanguage(state.bookLanguage)
          }
          
          if (state.currentLocation) {
            setCurrentLocation(state.currentLocation)
          }
          
          if (state.fontSize) {
            setFontSize(state.fontSize)
          }
        } else {
          console.log('No saved state found or state loading failed')
        }
      } catch (error) {
        console.error('Error loading app state:', error)
      } finally {
        // Set initialLoadRef to false after loading
        initialLoadRef.current = false
      }
    }
    
    loadAppState()
  }, [])
  
  // Save app state when relevant state changes
  useEffect(() => {
    // Skip saving during initial load
    if (initialLoadRef.current) {
      return
    }
    
    // Only save if we have a file selected
    if (!selectedFile) {
      return
    }
    
    const saveAppState = async () => {
      try {
        const state: AppState = {
          currentFile: selectedFile,
          currentLocation: currentLocation,
          bookLanguage: bookLanguage,
          fontSize: fontSize
        }
        
        console.log('Saving app state:', state)
        await window.ipcRenderer.saveAppState(state)
      } catch (error) {
        console.error('Error saving app state:', error)
      }
    }
    
    saveAppState()
  }, [selectedFile, currentLocation, bookLanguage, fontSize])

  const handleOpenFile = async () => {
    try {
      const result = await window.ipcRenderer.openFileDialog()
      
      if (!result.canceled && result.filePaths.length > 0) {
        const filePath = result.filePaths[0]
        
        // Reset language and selected text when loading a new book
        setBookLanguage(null)
        setSelectedText(null)
        setTranslatedText(null)
        setSelectedWord(null)
        setTranslatedWord(null)
        setChatMessages([])
        
        // Set the new file path
        setSelectedFile(filePath)
        console.log('Selected file:', filePath)
      }
    } catch (error) {
      console.error('Error opening file:', error)
    }
  }

  // Authentication functions
  const sendVerificationEmail = async () => {
    if (!email.trim()) {
      setAuthError('Please enter a valid email address')
      return
    }

    setIsSendingEmail(true)
    setAuthError(null)

    try {
      const response = await window.ipcRenderer.apiProxy('/verification/send', 'POST', { email })
      
      if (response.status === 200) {
        setIsEmailSent(true)
        console.log('Verification email sent successfully')
      } else {
        throw new Error(response.data?.error || 'Failed to send verification email')
      }
    } catch (error) {
      console.error('Error sending verification email:', error)
      setAuthError('Failed to send verification email. Please try again.')
    } finally {
      setIsSendingEmail(false)
    }
  }

  const verifyCode = async () => {
    if (!verificationCode.trim() || verificationCode.length !== 6) {
      setAuthError('Please enter a valid 6-digit code')
      return
    }

    setIsVerifying(true)
    setAuthError(null)

    try {
      const response = await window.ipcRenderer.apiProxy('/verification/check', 'POST', { 
        email, 
        code: verificationCode 
      })
      
      if (response.status === 200 && response.data) {
        const userData = response.data as UserData
        setUserData(userData)
        setIsAuthenticated(true)
        
        // Store user data in localStorage
        localStorage.setItem('langpub_user', JSON.stringify(userData))
        
        console.log('User authenticated successfully:', userData.email)
      } else {
        throw new Error(response.data?.error || 'Invalid verification code')
      }
    } catch (error) {
      console.error('Error verifying code:', error)
      setAuthError('Invalid or expired verification code. Please try again.')
    } finally {
      setIsVerifying(false)
    }
  }

  const logout = () => {
    setIsAuthenticated(false)
    setUserData(null)
    setEmail('')
    setVerificationCode('')
    setIsEmailSent(false)
    setAuthError(null)
    localStorage.removeItem('langpub_user')
    console.log('User logged out')
  }
  
  const translateText = async (text: string) => {
    if (!text) return
    
    // Show language selection dialog if language not selected
    if (!bookLanguage) {
      setPendingTranslationText(text)
      setLanguageDialogOpen(true)
      return
    }
    
    setIsTranslating(true)
    setTranslatedText(null)
    
    // Clear any previous audio
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl)
      setAudioUrl(null)
    }
    
    // Reset audio loading state
    setIsLoadingAudio(false)
    
    try {
      const translateResponse = await window.ipcRenderer.apiProxy('/translate', 'POST', { 
        language: bookLanguage, 
        text 
      })
      
      if (translateResponse.status !== 200 || !translateResponse.data) {
        throw new Error('Failed to translate text')
      }
      
      setTranslatedText(translateResponse.data.translated_text)
      fetchAudio(text, bookLanguage)
    } catch (error) {
      console.error('Translation error:', error)
      setTranslatedText('Translation failed. Please try again.')
    } finally {
      setIsTranslating(false)
    }
  }
  
  const fetchAudio = async (text: string, language: string) => {
    try {
      setIsLoadingAudio(true)
      
      // Use the speech endpoint to get audio
      const speechResponse = await window.ipcRenderer.apiProxy('/speech', 'POST', {
        language,
        text
      })
      
      if (speechResponse.status === 200) {
        // The response is an ArrayBuffer containing the MP3 data
        // First convert the response data to a Uint8Array
        const base64String = speechResponse.data
        
        // Check if the response is already binary or if it's a base64 string
        let audioData
        if (typeof base64String === 'string') {
          const binaryString = atob(base64String)
          const bytes = new Uint8Array(binaryString.length)
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i)
          }
          audioData = bytes
        } else {
          // Handle case where data is already a binary format
          audioData = new Uint8Array(base64String)
        }
        
        // Create a blob and an object URL
        const blob = new Blob([audioData], { type: 'audio/mp3' })
        const url = URL.createObjectURL(blob)
        setAudioUrl(url)
        
        console.log('Audio fetched successfully')
      } else {
        console.error('Error fetching audio:', speechResponse)
      }
    } catch (error) {
      console.error('Error fetching audio:', error)
    } finally {
      setIsLoadingAudio(false)
    }
  }
  
  const playAudio = () => {
    if (audioRef.current && audioUrl) {
      audioRef.current.play()
    } else if (selectedText && bookLanguage) {
      // If audio hasn't been fetched yet, fetch it now
      fetchAudio(selectedText, bookLanguage)
    }
  }
  
  // Handle language change from the dropdown
  const handleLanguageChange = (event: ChangeEvent<HTMLInputElement> | Event) => {
    const newLanguage = (event.target as HTMLInputElement).value
    
    // Only update if the language has changed
    if (newLanguage !== bookLanguage) {
      console.log('Language changed to:', newLanguage)
      setBookLanguage(newLanguage)
    }
  }
  
  // Handle language selection from the dialog
  const handleLanguageDialogClose = () => {
    setLanguageDialogOpen(false)
    setPendingTranslationText(null)
  }
  
  // Handle language selection and continue translation
  const handleLanguageSelect = () => {
    setLanguageDialogOpen(false)
    
    // If we have pending text and language is now set, translate it
    if (pendingTranslationText && bookLanguage) {
      translateText(pendingTranslationText)
    }
    
    setPendingTranslationText(null)
  }

  const handleTextSelection = (text: string | null) => {
    // Only update if text is provided (not null)
    // This allows us to ignore the clearing events and keep the current state
    if (text) {
      // Only update if the text is different from what's already selected
      if (text !== selectedText) {
        setSelectedText(text)
        translateText(text)
      }
    }
    // When text is null, we do nothing - maintaining the current state
  }
  
  // Helper function to clean a word
  const cleanWordText = (word: string): string => {
    if (!word || word.trim() === '') return ''
    
    // Clean the word
    const trimmedWord = word.trim()
    const cleanWord = trimmedWord
      .replace(/^[^\wÀ-ÿ\u00C0-\u017F]+/, '') // Remove leading punctuation
      .replace(/[^\wÀ-ÿ\u00C0-\u017F]+$/, '') // Remove trailing punctuation
    
    return cleanWord
  }
  
  // Handle mouse down on word (start of potential long press)
  const handleWordMouseDown = (word: string) => {
    const cleanWord = cleanWordText(word)
    if (cleanWord === '') return
    
    // Set a timeout to detect long press (500ms)
    if (selectionTimeoutRef.current) {
      window.clearTimeout(selectionTimeoutRef.current)
    }
    
    selectionTimeoutRef.current = window.setTimeout(() => {
      console.log('Long press detected on word:', cleanWord)
      setIsSelectionMode(true)
      setSelectedWords([cleanWord])
    }, 500) // 500ms for long press
  }
  
  // Handle touch start on word (for mobile devices)
  const handleWordTouchStart = (word: string) => {
    const cleanWord = cleanWordText(word)
    if (cleanWord === '') return
    
    // Set a timeout to detect long press (500ms)
    if (selectionTimeoutRef.current) {
      window.clearTimeout(selectionTimeoutRef.current)
    }
    
    selectionTimeoutRef.current = window.setTimeout(() => {
      console.log('Long press detected on word (touch):', cleanWord)
      setIsSelectionMode(true)
      setSelectedWords([cleanWord])
    }, 500) // 500ms for long press
  }
  
  // Handle mouse up on word
  const handleWordMouseUp = () => {
    // Clear the long press timeout
    if (selectionTimeoutRef.current) {
      window.clearTimeout(selectionTimeoutRef.current)
      selectionTimeoutRef.current = null
    }
    
    // If we're in selection mode, finish the selection
    if (isSelectionMode) {
      console.log('Selection complete:', selectedWords)
      
      // Join the selected words with spaces
      const selectedPhrase = selectedWords.join(' ')
      
      // Reset chat messages
      setChatMessages([])
      
      // Set the selected word to the phrase
      setSelectedWord(selectedPhrase)
      
      // Translate the phrase
      translateWord(selectedPhrase)
      
      // Get audio for the phrase
      fetchWordAudio(selectedPhrase)
      
      // Exit selection mode
      setIsSelectionMode(false)
      setSelectedWords([])
    }
  }
  
  // Handle mouse enter on word (during drag)
  const handleWordMouseEnter = (word: string) => {
    if (!isSelectionMode) return
    
    const cleanWord = cleanWordText(word)
    if (cleanWord === '') return
    
    // Add the word to the selection if it's not already there
    if (!selectedWords.includes(cleanWord)) {
      setSelectedWords([...selectedWords, cleanWord])
    }
  }
  
  // Handle touch end (for mobile)
  const handleTouchEnd = () => {
    // Reuse the same logic as mouse up
    handleWordMouseUp()
  }
  
  // Handle touch move (for mobile)
  const handleWordTouchMove = (e: React.TouchEvent) => {
    if (!isSelectionMode) return
    
    // Get the element under the touch point
    const touch = e.touches[0]
    const element = document.elementFromPoint(touch.clientX, touch.clientY)
    
    // If it's a word element, handle it
    if (element && element.classList.contains('clickable-word')) {
      const wordText = element.textContent || ''
      const cleanWord = cleanWordText(wordText)
      
      if (cleanWord !== '' && !selectedWords.includes(cleanWord)) {
        setSelectedWords([...selectedWords, cleanWord])
      }
    }
  }
  
  // Regular word click handler (for single clicks)
  const handleWordClick = (word: string) => {
    // If this is the end of a long press, don't process as a click
    if (isSelectionMode) return
    
    const cleanWord = cleanWordText(word)
    if (cleanWord === '') return
    
    console.log('Clicked word:', cleanWord)
    
    // Reset chat messages when selecting a new word
    setChatMessages([])
    
    // Set the selected word
    setSelectedWord(cleanWord)
    
    // Translate the word
    translateWord(cleanWord)
    
    // Get audio for the word
    fetchWordAudio(cleanWord)
  }
  
  const translateWord = async (word: string, forcedLanguage?: string) => {
    if (!word) return
    
    // Use forced language or bookLanguage
    const languageToUse = forcedLanguage || bookLanguage
    
    // If we still don't have a language, we can't translate
    if (!languageToUse) return
    
    setIsTranslatingWord(true)
    setTranslatedWord(null)
    
    try {
      // Use the API to translate just this word
      const translateResponse = await window.ipcRenderer.apiProxy('/translate', 'POST', { 
        language: languageToUse, 
        text: word 
      })
      
      if (translateResponse.status === 200 && translateResponse.data) {
        setTranslatedWord(translateResponse.data.translated_text)
      } else {
        throw new Error('Failed to translate word')
      }
    } catch (error) {
      console.error('Word translation error:', error)
      setTranslatedWord('Translation failed')
    } finally {
      setIsTranslatingWord(false)
    }
  }
  
  const fetchWordAudio = async (word: string, forcedLanguage?: string) => {
    if (!word) return
    
    // Use forced language or bookLanguage
    const languageToUse = forcedLanguage || bookLanguage
    
    // If we still don't have a language, we can't get audio
    if (!languageToUse) return
    
    setIsLoadingWordAudio(true)
    
    // Clear any previous audio
    if (wordAudioUrl) {
      URL.revokeObjectURL(wordAudioUrl)
      setWordAudioUrl(null)
    }
    
    try {
      // Use the speech endpoint to get audio for just this word
      const speechResponse = await window.ipcRenderer.apiProxy('/speech', 'POST', {
        language: languageToUse,
        text: word
      })
      
      if (speechResponse.status === 200) {
        // Process the audio data similarly to the fetchAudio function
        const base64String = speechResponse.data
        
        let audioData
        if (typeof base64String === 'string') {
          const binaryString = atob(base64String)
          const bytes = new Uint8Array(binaryString.length)
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i)
          }
          audioData = bytes
        } else {
          audioData = new Uint8Array(base64String)
        }
        
        const blob = new Blob([audioData], { type: 'audio/mp3' })
        const url = URL.createObjectURL(blob)
        setWordAudioUrl(url)
        
        console.log('Word audio fetched successfully')
      }
    } catch (error) {
      console.error('Error fetching word audio:', error)
    } finally {
      setIsLoadingWordAudio(false)
    }
  }
  
  const playWordAudio = () => {
    if (wordAudioRef.current && wordAudioUrl) {
      wordAudioRef.current.play()
    }
  }
  
  // Custom font size control methods
  const increaseFontSize = () => {
    const newSize = Math.min(fontSize + 10, 200) // Limit max font size to 200%
    setFontSize(newSize)
    if (bookViewerRef.current) {
      bookViewerRef.current.increaseFontSize()
    }
  }
  
  const decreaseFontSize = () => {
    const newSize = Math.max(fontSize - 10, 70) // Limit min font size to 70%
    setFontSize(newSize)
    if (bookViewerRef.current) {
      bookViewerRef.current.decreaseFontSize()
    }
  }
  
  const explainWord = async () => {
    if (!selectedWord || !bookLanguage) return
    
    setIsExplainingWord(true)
    console.log('Explaining word:', selectedWord, 'Language:', bookLanguage);
    
    try {
      // Create an initial user message asking for explanation (will be added to chat history)
      const initialUserMessage = `Explain the meaning of "${selectedWord}" in ${bookLanguage}.`;
      
      // Use the explain endpoint to get an explanation for the word
      const explainResponse = await window.ipcRenderer.apiProxy('/explain', 'POST', {
        word: selectedWord,
        language: bookLanguage,
        sentence: selectedText
      })
      
      console.log('Explanation response:', explainResponse);
      
      if (explainResponse.status === 200 && explainResponse.data) {
        // Initialize the chat with both a user query (implicit) and the AI's explanation
        const initialChat = [
          { role: 'user', content: initialUserMessage },
          { role: 'assistant', content: explainResponse.data.explanation }
        ];
        
        setChatMessages(initialChat);
        console.log('Set initial chat messages:', initialChat);
      } else {
        throw new Error('Failed to get word explanation')
      }
    } catch (error) {
      console.error('Word explanation error:', error)
      setChatMessages([
        { role: 'assistant', content: 'Could not get an explanation for this word.' }
      ])
    } finally {
      setIsExplainingWord(false)
    }
  }
  
  // Function to send a new message to the chat
  const sendChatMessage = async () => {
    if (!newChatMessage.trim() || !bookLanguage) return
    
    console.log('Sending chat message:', newChatMessage);
    console.log('Current book language:', bookLanguage);
    console.log('Current chat messages:', chatMessages);
    
    // Add the user message to the chat
    const updatedMessages = [
      ...chatMessages,
      { role: 'user', content: newChatMessage }
    ]
    setChatMessages(updatedMessages)
    setNewChatMessage('') // Clear the input
    
    // Set loading state
    setIsExplainingWord(true)
    
    try {
      // Make sure we're passing valid data to the API
      const validMessages = updatedMessages.filter(msg => 
        msg.role && (msg.role === 'user' || msg.role === 'assistant' || msg.role === 'system') && 
        msg.content && typeof msg.content === 'string'
      );
      
      console.log('Validated messages for API:', validMessages);
      
      if (validMessages.length === 0) {
        console.error('No valid messages to send to API');
        throw new Error('No valid messages to send to API');
      }
      
      // Send the conversation history to the API for a response
      console.log('Sending request to /chat API with:', {
        language: bookLanguage,
        messages: validMessages
      });
      
      const chatResponse = await window.ipcRenderer.apiProxy('/chat', 'POST', {
        language: bookLanguage,
        messages: validMessages
      });
      
      console.log('Chat response:', chatResponse);
      
      if (chatResponse.status === 200 && chatResponse.data && chatResponse.data.response) {
        console.log('Successfully received chat response');
        // Add the AI's response to the chat
        setChatMessages([
          ...updatedMessages,
          { role: 'assistant', content: chatResponse.data.response }
        ]);
      } else {
        console.error('Invalid response structure:', chatResponse);
        if (chatResponse.data && chatResponse.data.error) {
          throw new Error(`API Error: ${chatResponse.data.error} - ${chatResponse.data.message || chatResponse.data.details || ''}`);
        } else {
          throw new Error(`Failed to get chat response: Status ${chatResponse.status}`);
        }
      }
    } catch (error) {
      console.error('Chat response error:', error);
      const typedError = error as Error;
      console.error('Error details:', typedError.message);
      // Create a user-friendly error message
      let errorMessage = 'Sorry, I had trouble responding to your message.';
      
      if (typedError.message) {
        if (typedError.message.includes('claude-3-5-haiku-20241022')) {
          errorMessage += ' There was a model configuration issue. Please try again.';
        } else {
          errorMessage += ` Error: ${typedError.message}`;
        }
      }
      
      setChatMessages([
        ...updatedMessages,
        { role: 'assistant', content: errorMessage }
      ])
    } finally {
      setIsExplainingWord(false)
    }
  }

  // Show login screen if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="container">
        <Box 
          display="flex" 
          flexDirection="column" 
          alignItems="center" 
          justifyContent="center" 
          minHeight="100vh"
          padding={3}
        >
          <Typography variant="h3" component="h1" gutterBottom>
            Welcome to LangPub
          </Typography>
          <Typography variant="h6" color="text.secondary" gutterBottom sx={{ mb: 4 }}>
            Your language learning companion
          </Typography>
          
          <Box 
            component="form" 
            sx={{ 
              width: '100%', 
              maxWidth: 400,
              display: 'flex',
              flexDirection: 'column',
              gap: 2
            }}
            onSubmit={(e) => {
              e.preventDefault()
              if (!isEmailSent) {
                sendVerificationEmail()
              } else {
                verifyCode()
              }
            }}
          >
            {!isEmailSent ? (
              <>
                <TextField
                  type="email"
                  label="Email Address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  fullWidth
                  required
                  disabled={isSendingEmail}
                />
                <Button
                  type="submit"
                  variant="contained"
                  fullWidth
                  disabled={isSendingEmail || !email.trim()}
                  sx={{ mt: 2 }}
                >
                  {isSendingEmail ? (
                    <>
                      <CircularProgress size={20} sx={{ mr: 1 }} />
                      Sending...
                    </>
                  ) : (
                    'Send Verification Code'
                  )}
                </Button>
              </>
            ) : (
              <>
                <Typography variant="body1" textAlign="center" sx={{ mb: 2 }}>
                  We've sent a 6-digit verification code to <strong>{email}</strong>
                </Typography>
                <TextField
                  label="Verification Code"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  fullWidth
                  required
                  inputProps={{ maxLength: 6 }}
                  disabled={isVerifying}
                />
                <Button
                  type="submit"
                  variant="contained"
                  fullWidth
                  disabled={isVerifying || verificationCode.length !== 6}
                  sx={{ mt: 2 }}
                >
                  {isVerifying ? (
                    <>
                      <CircularProgress size={20} sx={{ mr: 1 }} />
                      Verifying...
                    </>
                  ) : (
                    'Verify Code'
                  )}
                </Button>
                <Button
                  variant="text"
                  fullWidth
                  onClick={() => {
                    setIsEmailSent(false)
                    setVerificationCode('')
                    setAuthError(null)
                  }}
                  disabled={isVerifying}
                >
                  Use Different Email
                </Button>
              </>
            )}
            
            {authError && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {authError}
              </Alert>
            )}
          </Box>
        </Box>
      </div>
    )
  }

  return (
    <div className="container">
      <div className="header" style={{ 
        display: 'flex', 
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button onClick={handleOpenFile} className="open-epub-button">Open Epub</button>
          
          {selectedFile && (
            <div className="font-controls" style={{ 
              display: 'flex', 
              alignItems: 'center'
            }}>
              <FormatSizeIcon style={{ marginRight: '5px' }} />
              <IconButton 
                onClick={decreaseFontSize} 
                size="small" 
                aria-label="decrease font size"
              >
                <RemoveIcon />
              </IconButton>
              <span style={{ margin: '0 8px', minWidth: '40px', textAlign: 'center' }}>
                {fontSize}%
              </span>
              <IconButton 
                onClick={increaseFontSize} 
                size="small" 
                aria-label="increase font size"
              >
                <AddIcon />
              </IconButton>
            </div>
          )}
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {userData && (
            <Typography variant="body2" color="text.secondary">
              {userData.email}
            </Typography>
          )}
          <Button 
            variant="outlined" 
            size="small" 
            onClick={logout}
          >
            Logout
          </Button>
        </div>
      </div>
      
      {!selectedFile ? (
        <div className="welcome">
          <p>Welcome to LangPub! Click the Open Epub button to get started.</p>
        </div>
      ) : (
        <div className="main-content">
          <div className="viewer-container">
            <BookViewer 
              ref={bookViewerRef}
              filePath={selectedFile} 
              onTextSelection={handleTextSelection}
              setBookLanguage={setBookLanguage}
              onLocationChange={setCurrentLocation}
              initialLocation={currentLocation}
              initialFontSize={fontSize}
            />
          </div>
          <div className="right-panel">
            <div className="panel-header">
              <h2>Translation</h2>
              <div className="language-selector">
                <Select
                  onChange={handleLanguageChange}
                  value={bookLanguage}
                  displayEmpty
                  inputProps={{ 'aria-label': 'Language' }}
                  className="language-select"
                >
                  {availableLanguages.map((language) => (
                    <MenuItem key={language} value={language}>
                      {language}
                    </MenuItem>
                  ))}
                </Select>
              </div>
            </div>
            <div className="panel-content">
              {selectedText ? (
                <div className="selected-text-panel">
                  <div className="snippet-header">
                    <h3>Original:</h3>
                    {bookLanguage && (
                      <div className="audio-controls">
                        {isLoadingAudio ? (
                          <CircularProgress size={24} />
                        ) : audioUrl ? (
                          <IconButton 
                            aria-label="play audio" 
                            onClick={playAudio}
                            size="small"
                            className="play-button"
                          >
                            <VolumeUpIcon />
                          </IconButton>
                        ) : null}
                      </div>
                    )}
                  </div>
                  <div 
                    className="text-snippet"
                    style={{ position: 'relative' }}
                    onMouseDown={(e) => {
                      // If clicking directly on the container (not on a word), clear selection mode
                      if (e.target === e.currentTarget && isSelectionMode) {
                        setIsSelectionMode(false)
                        setSelectedWords([])
                      }
                    }}
                    onTouchStart={(e) => {
                      // If touching directly on the container (not on a word), clear selection mode
                      if (e.target === e.currentTarget && isSelectionMode) {
                        setIsSelectionMode(false)
                        setSelectedWords([])
                      }
                    }}
                  >
                    {isSelectionMode && (
                      <div className="selection-mode-indicator" style={{
                        position: 'absolute',
                        top: '0px',
                        right: '0px',
                        padding: '4px 8px',
                        backgroundColor: 'rgba(74, 144, 226, 0.8)',
                        color: 'white',
                        borderRadius: '0 0 0 4px',
                        fontSize: '11px',
                        zIndex: 1
                      }}>
                        Selection Mode: {selectedWords.length} words
                      </div>
                    )}
                    {selectedText && selectedText.split(/\s+/).map((word, index, array) => {
                      const isLastWord = index === array.length - 1
                      
                      // Check if the word has any alphanumeric characters
                      if (/[\wÀ-ÿ\u00C0-\u017F]/.test(word)) {
                        // Extract leading and trailing punctuation
                        const match = word.match(/^([^\wÀ-ÿ\u00C0-\u017F]*)(.+?)([^\wÀ-ÿ\u00C0-\u017F]*)$/)
                        
                        if (match) {
                          const [, leadingPunct, actualWord, trailingPunct] = match
                          return (
                            <React.Fragment key={index}>
                              {leadingPunct}
                              <span 
                                className={`clickable-word ${isSelectionMode && selectedWords.includes(actualWord) ? 'selected-word' : ''}`}
                                onClick={() => handleWordClick(actualWord)}
                                onMouseDown={(e) => {
                                  e.stopPropagation() // Prevent container's mouseDown from firing
                                  handleWordMouseDown(actualWord)
                                }}
                                onMouseUp={handleWordMouseUp}
                                onMouseEnter={() => handleWordMouseEnter(actualWord)}
                                onTouchStart={(e) => {
                                  e.stopPropagation() // Prevent container's touchStart from firing
                                  handleWordTouchStart(actualWord)
                                }}
                                onTouchEnd={handleTouchEnd}
                                onTouchMove={handleWordTouchMove}
                                style={{
                                  backgroundColor: isSelectionMode && selectedWords.includes(actualWord) ? 'rgba(74, 144, 226, 0.3)' : 'transparent',
                                  cursor: isSelectionMode ? 'grab' : 'pointer',
                                  userSelect: 'none', /* Prevent native text selection */
                                  WebkitUserSelect: 'none',
                                  MozUserSelect: 'none'
                                }}
                              >
                                {actualWord}
                              </span>
                              {trailingPunct}
                              {!isLastWord && ' '}
                            </React.Fragment>
                          )
                        }
                      }
                      
                      // If there's no match (e.g., just punctuation), render without click handler
                      return (
                        <React.Fragment key={index}>
                          <span>{word}</span>
                          {!isLastWord && ' '}
                        </React.Fragment>
                      )
                    })}
                  </div>
                  <audio ref={audioRef} src={audioUrl || ''} />{/* Hidden audio element */}
                  
                  {isTranslating ? (
                    <div className="translation-loading">Translating...</div>
                  ) : (
                    <>
                      <h3>Translated:</h3>
                      <div className="text-snippet translation">{translatedText}</div>
                    </>
                  )}
                  
                  {/* Word details section */}
                  {selectedWord && (
                    <div className="word-details">
                      <h3>Word Details</h3>
                      <div className="word-details-content">
                        <div className="word-row">
                          <div className="word-original">
                            <span className="word-label">Original:</span>
                            <span className="word-value">{selectedWord}</span>
                            <IconButton 
                              aria-label="play word audio" 
                              onClick={playWordAudio}
                              disabled={!wordAudioUrl || isLoadingWordAudio}
                              size="small"
                              className="word-play-button"
                            >
                              {isLoadingWordAudio ? (
                                <CircularProgress size={18} />
                              ) : (
                                <VolumeUpIcon fontSize="small" />
                              )}
                            </IconButton>
                          </div>
                          <div className="word-translation">
                            <span className="word-label">Translation:</span>
                            {isTranslatingWord ? (
                              <span className="word-loading">Translating...</span>
                            ) : (
                              <span className="word-value">{translatedWord}</span>
                            )}
                          </div>
                        </div>
                        
                        {chatMessages.length === 0 && !isExplainingWord && (
                          <div className="word-explanation-button-container">
                            <Button 
                              variant="outlined" 
                              size="small" 
                              onClick={explainWord}
                              startIcon={<InfoOutlinedIcon />}
                              className="explain-button"
                            >
                              Explain this word
                            </Button>
                          </div>
                        )}
                        
                        {isExplainingWord && chatMessages.length === 0 && (
                          <div className="word-explanation-loading">
                            <CircularProgress size={20} />
                            <span>Getting explanation...</span>
                          </div>
                        )}
                        
                        {chatMessages.length > 0 && (
                          <div className="chat-container">
                            <h4>Chat:</h4>
                            <div className="chat-messages">
                              {chatMessages.map((message, index) => (
                                <div 
                                  key={index} 
                                  className={`chat-message ${message.role === 'assistant' ? 'assistant' : 'user'}`}
                                >
                                  <div className="message-content">
                                    {message.content}
                                  </div>
                                </div>
                              ))}
                              {isExplainingWord && (
                                <div className="chat-loading">
                                  <CircularProgress size={18} />
                                </div>
                              )}
                            </div>
                            <div className="chat-input">
                              <input 
                                type="text" 
                                value={newChatMessage}
                                onChange={(e) => setNewChatMessage(e.target.value)}
                                placeholder="Ask a question..."
                                onKeyPress={(e) => {
                                  if (e.key === 'Enter') {
                                    sendChatMessage();
                                  }
                                }}
                                disabled={isExplainingWord}
                              />
                              <Button 
                                variant="contained" 
                                size="small"
                                onClick={sendChatMessage}
                                disabled={isExplainingWord || !newChatMessage.trim()}
                              >
                                Send
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                      <audio ref={wordAudioRef} src={wordAudioUrl || ''} />
                    </div>
                  )}
                </div>
              ) : (
                <p className="no-selection">Select text from the book to translate it.</p>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Language Selection Dialog */}
      <Dialog
        open={languageDialogOpen}
        onClose={handleLanguageDialogClose}
        aria-labelledby="language-dialog-title"
      >
        <DialogTitle id="language-dialog-title">Select Language</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Please select the language of the book to enable translation.
          </DialogContentText>
          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel id="dialog-language-select-label">Language</InputLabel>
            <Select
              labelId="dialog-language-select-label"
              value={bookLanguage || ''}
              onChange={handleLanguageChange}
              label="Language"
              fullWidth
            >
              {availableLanguages.map((language) => (
                <MenuItem key={language} value={language}>
                  {language}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleLanguageDialogClose}>Cancel</Button>
          <Button 
            onClick={handleLanguageSelect} 
            disabled={!bookLanguage}
            variant="contained" 
            color="primary"
          >
            Continue
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  )
}

export default App
