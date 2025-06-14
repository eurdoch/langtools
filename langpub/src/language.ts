export const availableLanguages = [
  'French',
  'Dutch',
  'English',
  'German',
  'Spanish',
  'Italian',
  'Japanese',
  'Portuguese',
  'Chinese'
];

/**
 * Detects the language of the provided text by calling the language detection API
 * using the Electron IPC api-proxy to avoid CORS issues
 * @param text The text to detect the language for
 * @returns A Promise that resolves to the detected language string
 */
export const detectLanguage = async (text: string): Promise<string> => {
  try {
    const response = await window.ipcRenderer.apiProxy('/language', 'POST', { text });
    
    if (response.status !== 200) {
      throw new Error(`Language detection failed with status: ${response.status}`);
    }

    return response.data.language;
  } catch (error) {
    console.error('Error detecting language:', error);
    return 'English'; // Default to English in case of error
  }
};

export const languageMap = {
  "fr": "French",
  "fr-FR": "French",
  "fr-CA": "French",
  "fr-BE": "French",
  "fr-CH": "French",
  "fr-LU": "French",
  
  "nl": "Dutch",
  "nl-NL": "Dutch",
  "nl-BE": "Dutch",
  
  "en": "English",
  "en-US": "English",
  "en-GB": "English",
  "en-CA": "English",
  "en-AU": "English",
  "en-NZ": "English",
  "en-IE": "English",
  "en-ZA": "English",
  "en-IN": "English",
  
  "de": "German",
  "de-DE": "German",
  "de-AT": "German",
  "de-CH": "German",
  "de-LU": "German",
  "de-LI": "German",
  
  "es": "Spanish",
  "es-ES": "Spanish",
  "es-MX": "Spanish",
  "es-AR": "Spanish",
  "es-CO": "Spanish",
  "es-CL": "Spanish",
  "es-PE": "Spanish",
  "es-VE": "Spanish",
  "es-EC": "Spanish",
  "es-GT": "Spanish",
  "es-CU": "Spanish",
  "es-BO": "Spanish",
  "es-DO": "Spanish",
  "es-HN": "Spanish",
  "es-PY": "Spanish",
  "es-SV": "Spanish",
  "es-NI": "Spanish",
  "es-CR": "Spanish",
  "es-PR": "Spanish",
  "es-PA": "Spanish",
  "es-UY": "Spanish",
  
  "it": "Italian",
  "it-IT": "Italian",
  "it-CH": "Italian",
  
  "ja": "Japanese",
  "ja-JP": "Japanese",
  
  "pt": "Portuguese",
  "pt-BR": "Portuguese",
  "pt-PT": "Portuguese",
  "pt-AO": "Portuguese",
  "pt-MZ": "Portuguese",
  
  "zh": "Chinese",
  "zh-CN": "Chinese",
  "zh-TW": "Chinese",
  "zh-HK": "Chinese",
  "zh-SG": "Chinese",
  "zh-MO": "Chinese"
}
