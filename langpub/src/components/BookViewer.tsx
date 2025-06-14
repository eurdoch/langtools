import { useState, useEffect, useRef, useImperativeHandle, forwardRef } from 'react'
import { ReactReader } from 'react-reader'
import type { Contents } from 'epubjs'
import { availableLanguages, detectLanguage, languageMap } from '../language'

interface BookViewerProps {
  filePath: string;
  onTextSelection?: (text: string | null) => void;
  setBookLanguage: (language: string) => void;
  onLocationChange?: (location: string | number) => void;
  initialLocation?: string | number;
  initialFontSize?: number;
}

const BookViewer = forwardRef<
  { decreaseFontSize: () => void; increaseFontSize: () => void; fontSize: number }, 
  BookViewerProps
>(({ filePath, onTextSelection, setBookLanguage, onLocationChange, initialLocation = 0, initialFontSize = 100 }, ref) => {
  const [location, setLocation] = useState<string | number>(initialLocation)
  const [bookUrl, setBookUrl] = useState<string | null>(null)
  const [totalLocations, setTotalLocations] = useState<number>(0)
  const [selectedText, setSelectedText] = useState<string | null>(null)
  const [fontSize, setFontSize] = useState<number>(initialFontSize) // Initialize with saved font size
  const renditionRef = useRef<any>(null)
  const onTextSelectionRef = useRef(onTextSelection)
  const onLocationChangeRef = useRef(onLocationChange)

  // Update refs when props change
  useEffect(() => {
    onTextSelectionRef.current = onTextSelection
  }, [onTextSelection])
  
  useEffect(() => {
    onLocationChangeRef.current = onLocationChange
  }, [onLocationChange])
  
  // Expose functions to parent component
  useImperativeHandle(ref, () => ({
    decreaseFontSize,
    increaseFontSize,
    fontSize
  }))

  useEffect(() => {
    if (!filePath) return
    
    let objectUrl: string | null = null
    
    // Load the book
    const loadBook = async () => {
      try {
        // Read the file directly using Electron's IPC
        const fileResult = await window.ipcRenderer.readFile(filePath)
        
        if (fileResult.success && fileResult.data) {
          // Create a blob from the base64 data
          const binaryData = atob(fileResult.data)
          const arrayBuffer = new ArrayBuffer(binaryData.length)
          const uint8Array = new Uint8Array(arrayBuffer)
          
          for (let i = 0; i < binaryData.length; i++) {
            uint8Array[i] = binaryData.charCodeAt(i)
          }
          
          const blob = new Blob([uint8Array], { type: 'application/epub+zip' })
          objectUrl = URL.createObjectURL(blob)
          
          // Set book URL for ReactReader
          setBookUrl(objectUrl)
        } else {
          throw new Error(fileResult.error || 'Failed to read file')
        }
      } catch (error) {
        console.error('Error loading EPUB:', error)
      }
    }

    loadBook()

    // Cleanup
    return () => {
      // Revoke object URL to avoid memory leaks
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl)
      }
    }
  }, [filePath])

  // Calculate reading progress
  const locationChanged = (epubcifi: string) => {
    // Persist location
    setLocation(epubcifi)
    
    // Call the onLocationChange callback if provided
    if (onLocationChangeRef.current) {
      onLocationChangeRef.current(epubcifi)
    }
    
    // Calculate progress
    if (totalLocations > 0) {
      const currentLocation = epubcifi.split('/')[2]
      const percentage = Math.round((parseInt(currentLocation) / totalLocations) * 100)
      // setProgress(percentage)
      console.log(`Reading progress: ${percentage}%`)
    }
  }
  
  // Increase font size
  const increaseFontSize = () => {
    const newSize = Math.min(fontSize + 10, 200) // Limit max font size to 200%
    setFontSize(newSize)
    updateFontSize(newSize)
  }
  
  // Decrease font size
  const decreaseFontSize = () => {
    const newSize = Math.max(fontSize - 10, 70) // Limit min font size to 70%
    setFontSize(newSize)
    updateFontSize(newSize)
  }
  
  // Apply font size to reader
  const updateFontSize = (size: number) => {
    if (renditionRef.current) {
      renditionRef.current.themes.fontSize(`${size}%`)
    }
  }

  return (
    <div className="book-viewer-container" style={{ position: 'relative' }}>
      {bookUrl ? (
        <>
          <div className="reader-container" style={{ height: '100%', overflow: 'auto' }}>
            <ReactReader
              url={bookUrl}
              location={location}
              locationChanged={locationChanged}
              getRendition={rendition => {
                // Store rendition reference
                renditionRef.current = rendition
                
                // Set styles on rendition
                rendition.themes.default({
                  '::selection': {
                    background: 'rgba(74, 144, 226, 0.3)'
                  },
                  '.epubjs-hl': {
                    fill: 'rgba(74, 144, 226, 0.3)'
                  },
                  'body': {
                    padding: '0 8px !important',
                    margin: '0 !important'
                  }
                })
                
                // Set initial font size
                updateFontSize(fontSize)
                
                // Store total locations for progress calculation
                rendition.book.ready.then(() => {
                  rendition.book.locations.generate(1000).then((locations: any) => {
                    setTotalLocations(locations.length)
                  })

                  // We only need to detect the language once
                  const languageDetectionHandler = async () => {
                    try {
                      // First check if we can get the language from metadata
                      // Use type assertion to access possibly undefined or differently named properties
                      const bookMetadata = (rendition.book as any).package?.metadata || (rendition.book as any).packaging?.metadata;
                      const dcLanguage = bookMetadata?.language as string | undefined;
                      const convertedLanguage = dcLanguage ? (languageMap as Record<string, string>)[dcLanguage] : undefined;
                      
                      if (convertedLanguage) {
                        // We found the language in metadata
                        console.log("Found language in book metadata:", convertedLanguage);
                        setBookLanguage(convertedLanguage);
                        rendition.off('rendered', languageDetectionHandler);
                        return;
                      }
                      
                      console.log("Attempting to detect language from spine item...");
                      
                      // Access spine items from the book - use type assertion for compatibility
                      const spine = rendition.book.spine as any;
                      const spineItems = spine.spineItems || spine.items || [];
                      const fourthItem = spineItems[3];
                      
                      if (fourthItem && typeof fourthItem.load === 'function') {
                        fourthItem.load(rendition.book.load.bind(rendition.book))
                        .then((contents: any) => {
                          const paragraphs = contents.querySelectorAll('p');
                          if (paragraphs.length >= 2) {
                            const firstParagraph = paragraphs[0].textContent.trim();
                            const secondParagraph = paragraphs[1].textContent.trim();
                            
                            const excerpt = firstParagraph + "\n\n" + secondParagraph;
                            detectLanguage(excerpt).then(detectedLanguage => {
                              console.log('Detected language: ', detectedLanguage);
                              if (availableLanguages.includes(detectedLanguage)) {
                                setBookLanguage(detectedLanguage);
                              } 
                            });
                          } else {
                            console.log("No paragraphs found in this spine item");
                          }
                          
                          // When done, unload to free memory
                          if (typeof fourthItem.unload === 'function') {
                            fourthItem.unload();
                          }
                        })
                        .catch((error: Error) => {
                          console.error("Error loading spine item:", error);
                        });
                      }
                        
                    } catch (error) {
                      console.error("Error detecting language from content:", error);
                    }
                  };
                  
                  // Call the handler for the first render and register it for future renders
                  languageDetectionHandler();
                })
                
                // Add selection event listener
                rendition.on('selected', (_cfiRange: string, contents: Contents) => {
                  // Get the selected text
                  const text = contents.window.getSelection()?.toString()
                  if (text && text.trim() !== '') {
                    console.log('Selected text:', text)
                    
                    // Check if the selected text is different from the current one
                    if (text !== selectedText) {
                      setSelectedText(text)
                      // Pass selected text to parent component if callback exists
                      if (onTextSelectionRef.current) {
                        onTextSelectionRef.current(text)
                      }
                    }
                  }
                })
                
                // Handle clicks without selections
                rendition.on('mouseup', () => {
                  // Get current selection
                  const selection = window.getSelection()
                  const hasSelection = selection && !selection.isCollapsed && selection.toString().trim() !== ''
                  
                  // Only clear if there's no selection and it was a click (not a drag)
                  if (!hasSelection) {
                    // We don't clear the selection here, 
                    // which allows the right panel content to remain
                    
                    // Note: We're not calling onTextSelection(null) here,
                    // which means the App component will keep its current state
                  }
                })
              }}
              epubOptions={{
                flow: 'scrolled',
                manager: 'continuous',
              }}
              tocChanged={toc => {
                console.log('Table of contents:', toc)
              }}
              epubInitOptions={{
                openAs: 'epub'
              }}
              loadingView={<div className="loading">Loading...</div>}
              showToc={true}
              // Omitting styles because of TypeScript error
              // styles={readerStyles as any}
            />
          </div>
        </>
      ) : (
        <div className="loading">Loading book...</div>
      )}
    </div>
  )
})

export default BookViewer
