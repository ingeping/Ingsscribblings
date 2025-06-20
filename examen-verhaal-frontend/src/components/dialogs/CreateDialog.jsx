import { useState, useEffect } from 'react';
import { adminVerhalenAPI, adminCategoriesAPI } from '../../services/adminApi';
import mammoth from 'mammoth';
import toast from 'react-hot-toast';
import RichTextDisplay from '../admin/RichTextDisplay';

const CreateDialog = ({ isOpen, onClose, onSave, type }) => {
  // Initialize with empty values for both story and category types
  const [formData, setFormData] = useState({
    // Story fields
    title: '',
    text: '',
    description: '',
    published: true,
    category: '',
    cover_image: null,
    date: new Date().toISOString().split('T')[0],
    is_spotlighted: false,
    is_uitgelicht: false,
    is_downloadable: false,
    url: '',
    // Category fields
    naam: '',
    word_file: null
  });
  const [error, setError] = useState('');
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [coverPreview, setCoverPreview] = useState(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [wordFilename, setWordFilename] = useState('');
  const [isShaking, setIsShaking] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const scrollToTop = () => {
    const dialogContent = document.querySelector('.max-h-\\[90vh\\].overflow-y-auto');
    if (dialogContent) {
      dialogContent.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const data = await adminCategoriesAPI.getAll();
        setCategories(data);
      } catch (err) {
        console.error('Error fetching categories:', err);
        setError('Kon categorieën niet ophalen');
      }
    };

    if (isOpen && type === 'story') {
      fetchCategories();
    }
  }, [isOpen, type]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const validateForm = () => {
    const errors = [];
    
    if (type === 'story') {
      if (!formData.title?.trim()) {
        errors.push('Titel is verplicht');
      }
      if (!formData.text?.trim()) {
        errors.push('Verhaal is verplicht');
      }
      if (!formData.category) {
        errors.push('Categorie is verplicht');
      }
    } else {
      if (!formData.naam?.trim()) {
        errors.push('Naam is verplicht');
      }
    }

    if (errors.length > 0) {
      setError(errors.join('\n'));
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
      scrollToTop();
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitted(true);
    setError('');
    setIsLoading(true);
    scrollToTop();

    try {
      if (type === 'story') {
        // Validate form first
        if (!validateForm()) {
          setIsLoading(false);
          return;
        }

        // Transform the data to match API field names
        const transformedData = {
          titel: formData.title.trim(),
          tekst: formData.text,
          beschrijving: formData.description?.trim() || '',
          is_onzichtbaar: !formData.published,
          categorie: parseInt(formData.category, 10),
          datum: formData.date,
          is_uitgelicht: formData.is_uitgelicht || false,
          is_spotlighted: formData.is_spotlighted || false,
          is_downloadable: formData.is_downloadable || false,
          url: formData.url?.trim() || '',
          cover_image: formData.cover_image,
          word_file: formData.word_file
        };

        // Show loading toast if PDF generation is enabled
        const toastId = formData.is_downloadable ? toast.loading('Word document wordt verwerkt naar PDF...') : null;
        
        const result = await onSave(transformedData);
        
        // Update toast based on PDF generation
        if (formData.is_downloadable) {
          toast.success('PDF succesvol gegenereerd!', { id: toastId });
        }
        
        if (result) {
          setIsLoading(false);
          onClose();
        }
      } else {
        // Validate form first
        if (!validateForm()) {
          setIsLoading(false);
          return;
        }

        const result = await onSave(formData);
        if (result) {
          setIsLoading(false);
          onClose();
        }
      }
    } catch (err) {
      console.error('Error saving:', err);
      setError(err.message || 'Er is iets misgegaan bij het opslaan');
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
      scrollToTop();
      setIsLoading(false);
      // Dismiss loading toast if there was an error
      if (formData.is_downloadable) {
        toast.error('Er is een fout opgetreden bij het genereren van de PDF', { id: toastId });
      }
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked, files } = e.target;
    
    if (type === 'file') {
      setFormData(prev => ({
        ...prev,
        [name]: files[0]
      }));
      if (files && files[0]) {
        setCoverPreview(URL.createObjectURL(files[0]));
        setRemoveImage(false);
      }
    } else if (type === 'checkbox') {
      setFormData(prev => ({
        ...prev,
        [name]: checked
      }));
    } else if (name === 'text') {
      // Preserve all whitespace and line breaks exactly as entered
      setFormData(prev => ({
        ...prev,
        text: value
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleWordImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.convertToHtml({ arrayBuffer });
      const html = result.value;

      // Convert HTML formatting to markdown-style formatting
      const formattedText = html
        // Convert bold and italic (must be done first)
        .replace(/<strong[^>]*><em[^>]*>(.*?)<\/em><\/strong>/gi, '***$1***')
        // Convert bold
        .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
        // Convert italic
        .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
        // Convert underline
        .replace(/<u[^>]*>(.*?)<\/u>/gi, '__$1__')
        // Convert strikethrough
        .replace(/<s[^>]*>(.*?)<\/s>/gi, '~~$1~~')
        // Convert code
        .replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`')
        // Convert paragraphs to double newlines
        .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
        // Convert line breaks to single newlines
        .replace(/<br\s*\/?>/gi, '\n')
        // Remove other HTML tags
        .replace(/<[^>]*>/g, '')
        // Clean up extra spaces and newlines while preserving structure
        .replace(/\n\s*\n\s*\n/g, '\n\n')
        .replace(/\s+$/gm, '') // Remove trailing spaces on each line
        .trim();

      setFormData(prev => ({
        ...prev,
        text: formattedText,
        word_file: file
      }));
      setWordFilename(file.name);
      
      // Store the filename temporarily in localStorage
      localStorage.setItem('temp_word_filename', file.name);
    } catch (error) {
      console.error('Error importing Word document:', error);
      setError('Er is een fout opgetreden bij het importeren van het Word document');
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
      scrollToTop();
    }
  };

  useEffect(() => {
    if (isOpen) {
      setIsSubmitted(false);
      setIsLoading(false);
      // Always keep all fields in formData to avoid undefined to defined transitions
      setFormData({
        // Story fields
        title: '',
        text: '',
        description: '',
        published: true,
        category: '',
        cover_image: null,
        date: new Date().toISOString().split('T')[0],
        is_spotlighted: false,
        is_uitgelicht: false,
        is_downloadable: false,
        url: '',
        // Category fields
        naam: '',
        word_file: null
      });
      setError('');
      setCoverPreview(null);
      setRemoveImage(false);
      setWordFilename('');
      // Clear any temporary word filename from localStorage
      localStorage.removeItem('temp_word_filename');
    }
  }, [isOpen, type]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div 
        className={`bg-[#FFFFF5] rounded-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-xl ${isShaking ? 'animate-shake' : ''}`}
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4 sm:p-6">
          <h2 className="text-xl font-bold mb-4">
            {type === 'story' ? 'Nieuw Verhaal' : 'Nieuwe Categorie'}
          </h2>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4 whitespace-pre-line">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            {type === 'story' ? (
              <>
                <div className="flex flex-col gap-6">
                  <div className="flex flex-col md:flex-row gap-6">
                    <div className="flex-1 flex flex-col gap-3 min-w-[200px]">
                      <div>
                        <label className="block text-sm font-mono font-bold mb-1">
                          Titel <span className={`${isSubmitted ? 'text-red-500' : 'text-gray-400'}`}>*</span>
                        </label>
                        <input
                          type="text"
                          name="title"
                          value={formData.title}
                          onChange={handleChange}
                          required
                          className={`w-full px-3 py-2 border rounded-md bg-[#F7F6ED] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                            isSubmitted ? 'invalid:border-red-500 invalid:focus:ring-red-500' : ''
                          }`}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-mono font-bold mb-1">
                          Categorie <span className={`${isSubmitted ? 'text-red-500' : 'text-gray-400'}`}>*</span>
                        </label>
                        <select
                          name="category"
                          value={formData.category || ''}
                          onChange={handleChange}
                          required
                          className={`w-full px-3 py-2 border rounded-md bg-[#F7F6ED] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-no-repeat bg-[right_0.75rem_center] pr-8 ${
                            isSubmitted ? 'invalid:border-red-500 invalid:focus:ring-red-500' : ''
                          }`}
                          style={{ backgroundImage: "url(\"data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%236B7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3E%3C/svg%3E\")", backgroundSize: "1.5em 1.5em" }}
                        >
                          <option value="">Selecteer een categorie</option>
                          {categories.map(cat => (
                            <option key={cat.id} value={cat.id}>{cat.naam}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-mono font-bold mb-1">
                          Datum <span className={`${isSubmitted ? 'text-red-500' : 'text-gray-400'}`}>*</span>
                        </label>
                        <input
                          type="date"
                          name="date"
                          value={formData.date || ''}
                          onChange={handleChange}
                          required
                          className={`w-full px-3 py-2 border rounded-md bg-[#F7F6ED] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                            isSubmitted ? 'invalid:border-red-500 invalid:focus:ring-red-500' : ''
                          }`}
                        />
                      </div>
                      <div className="flex flex-col gap-2 mt-2">
                        <label className="flex items-center gap-2 text-base font-mono">
                          <input
                            type="checkbox"
                            name="is_uitgelicht"
                            checked={!!formData.is_uitgelicht}
                            onChange={handleChange}
                            className="accent-black"
                          />
                          Uitgelicht
                        </label>
                        <label className="flex items-center gap-2 text-base font-mono">
                          <input
                            type="checkbox"
                            name="is_spotlighted"
                            checked={!!formData.is_spotlighted}
                            onChange={handleChange}
                            className="accent-black"
                          />
                          Spotlight
                        </label>
                        <label className="flex items-center gap-2 text-base font-mono">
                          <input
                            type="checkbox"
                            name="is_downloadable"
                            checked={!!formData.is_downloadable}
                            onChange={handleChange}
                            className="accent-black"
                          />
                          Download als pdf
                        </label>
                      </div>
                    </div>
                    <div className="flex-1 flex flex-col items-center justify-start min-w-[220px]">
                      <label className="block text-sm font-mono font-bold mb-1 w-full text-left">
                        {coverPreview ? 'Omslagfoto' : 'Voeg omslagfoto toe'}
                      </label>
                      <div className="relative w-full h-[200px] flex items-center justify-center border-2 border-dashed border-gray-400 rounded-md bg-[#D9D9D9] cursor-pointer group">
                        <input
                          type="file"
                          name="cover_image"
                          onChange={handleChange}
                          accept="image/*"
                          className="opacity-0 absolute inset-0 w-full h-full cursor-pointer z-10"
                          tabIndex="-1"
                        />
                        {coverPreview ? (
                          <>
                            <img src={coverPreview} alt="Preview omslag" className="object-contain max-h-full max-w-full z-0" />
                            <div 
                              className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all duration-200 flex items-center justify-center z-20 cursor-pointer"
                              onClick={(e) => {
                                e.stopPropagation();
                                document.querySelector('input[name="cover_image"]').click();
                              }}
                            >
                              <span className="text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-sm font-mono">
                                Klik om te vervangen
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setCoverPreview(null);
                                setFormData(prev => ({ ...prev, cover_image: null }));
                                setRemoveImage(true);
                              }}
                              className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-30"
                              title="Verwijder omslagfoto"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                              </svg>
                            </button>
                          </>
                        ) : (
                          <div className="flex flex-col items-center gap-2">
                            <svg width="45" height="40" viewBox="0 0 45 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <g clipPath="url(#clip0_159_301)">
                                <path d="M30 26.6667L22.5 20M22.5 20L15 26.6667M22.5 20V35M38.2312 30.65C40.06 29.7638 41.5047 28.3615 42.3373 26.6644C43.1698 24.9673 43.3429 23.072 42.8291 21.2778C42.3154 19.4836 41.144 17.8925 39.5 16.7557C37.856 15.619 35.8329 15.0012 33.75 15H31.3875C30.82 13.0487 29.7622 11.2372 28.2937 9.70165C26.8251 8.16608 24.9841 6.94641 22.9089 6.13434C20.8338 5.32227 18.5785 4.93892 16.3127 5.01313C14.0469 5.08734 11.8295 5.61716 9.8272 6.56277C7.82491 7.50838 6.08983 8.84516 4.75241 10.4726C3.415 12.1001 2.51004 13.9759 2.10559 15.959C1.70113 17.9421 1.8077 19.9809 2.41727 21.9221C3.02685 23.8633 4.12358 25.6564 5.625 27.1667" stroke="#F3F3F3" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
                              </g>
                              <defs>
                                <clipPath id="clip0_159_301">
                                  <rect width="45" height="40" fill="white"/>
                                </clipPath>
                              </defs>
                            </svg>
                            <span className="text-gray-500 text-center text-lg select-none pointer-events-none z-0">Klik om omslagfoto toe te voegen</span>
                          </div>
                        )}
                      </div>
                      
                      {/* Publiceer-oog knop */}
                      <div className="w-full flex justify-end mt-2">
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, published: !prev.published }))}
                          className="flex items-center gap-2 text-base font-mono focus:outline-none group"
                          aria-pressed={formData.published}
                          title={formData.published ? 'Verhaal verbergen' : 'Verhaal publiceren'}
                        >
                          {formData.published ? (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="#111">
                              <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                              <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                            </svg>
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="#111">
                              <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414-1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd" />
                              <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
                            </svg>
                          )}
                          Publiceer
                        </button>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-base font-mono font-bold mb-1">
                      Korte beschrijving
                    </label>
                    <textarea
                      name="description"
                      value={formData.description}
                      onChange={handleChange}
                      rows="2"
                      className={`w-full px-3 py-2 border rounded-md bg-[#D9D9D9] font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                    />
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="block text-base font-mono font-bold">
                        Verhaal <span className={`${isSubmitted ? 'text-red-500' : 'text-gray-400'}`}>*</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowPreview(!showPreview)}
                        disabled={!formData.text?.trim()}
                        className={`text-gray-600 hover:text-gray-800 focus:outline-none ${!formData.text?.trim() ? 'opacity-50 cursor-not-allowed' : ''}`}
                        title={!formData.text?.trim() ? 'Geen preview beschikbaar' : 'Preview verhaal'}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                    <textarea
                      name="text"
                      value={formData.text}
                      onChange={handleChange}
                      required
                      rows={10}
                      className={`w-full px-3 py-2 border rounded-md bg-[#F7F6ED] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        isSubmitted ? 'invalid:border-red-500 invalid:focus:ring-red-500' : ''
                      }`}
                    />
                    {showPreview && (
                      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                        <div className="bg-[#FFFFF5] rounded-lg w-full max-w-2xl max-h-[80vh] overflow-y-auto p-6">
                          <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold font-mono">Preview</h3>
                            <button
                              onClick={() => setShowPreview(false)}
                              className="text-gray-600 hover:text-gray-800 focus:outline-none"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                          <div className="prose prose-lg max-w-none mx-auto px-4 sm:px-6 md:px-8">
                            <div className="bg-white rounded-lg shadow-sm p-6 md:p-8">
                              <RichTextDisplay content={formData.text || ''} />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-mono font-bold mb-1">
                      URL
                    </label>
                    <input
                      type="url"
                      name="url"
                      value={formData.url}
                      onChange={handleChange}
                      placeholder="https://example.com"
                      className="w-full px-3 py-2 border rounded-md bg-[#F7F6ED] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
                <div className="relative mb-4">
                  <label className="block text-base font-mono font-bold mb-2">
                    Word Document
                  </label>
                  
                  {wordFilename ? (
                    <div className="flex items-center gap-3 px-4 py-3 bg-green-50 border border-green-200 rounded-md">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-600" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span className="text-green-700 font-mono flex-grow truncate">
                        {wordFilename}
                      </span>
                      <button 
                        type="button"
                        onClick={() => {
                          if (confirm(`Wilt u het document "${wordFilename}" verwijderen?`)) {
                            setWordFilename('');
                            setFormData(prev => ({
                              ...prev,
                              text: '',
                              word_file: null
                            }));
                            
                            // Remove temp filename from localStorage
                            localStorage.removeItem('temp_word_filename');
                            
                            // Reset file input
                            const fileInput = document.querySelector('input[type="file"][accept=".docx"]');
                            if (fileInput) {
                              fileInput.value = "";
                            }
                          }
                        }}
                        className="ml-2 text-red-500 hover:text-red-700 focus:outline-none"
                        title="Verwijder document"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                  ) : (
                    <div className="flex">
                      <label className="flex-grow flex items-center gap-3 px-4 py-3 bg-blue-50 hover:bg-blue-100 transition-colors border border-blue-200 rounded-md cursor-pointer">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span className="text-blue-700 font-mono">
                          Word document importeren
                        </span>
                        <input
                          type="file"
                          accept=".docx"
                          onChange={handleWordImport}
                          className="sr-only"
                        />
                      </label>
                    </div>
                  )}
                </div>
                <div className="flex justify-end gap-4 mt-6 pt-4 border-t">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800 font-mono"
                  >
                    Annuleren
                  </button>
                  {formData.published ? (
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 font-mono"
                    >
                      {isLoading ? 'Bezig...' : 'Verhaal Publiceren'}
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 font-mono"
                    >
                      {isLoading ? 'Bezig...' : 'Verhaal Opslaan'}
                    </button>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-mono font-bold mb-1">
                      Naam <span className={`${isSubmitted ? 'text-red-500' : 'text-gray-400'}`}>*</span>
                    </label>
                    <input
                      type="text"
                      name="naam"
                      value={formData.naam}
                      onChange={handleChange}
                      required
                      className={`w-full px-3 py-2 border rounded-md bg-[#F7F6ED] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        isSubmitted ? 'invalid:border-red-500 invalid:focus:ring-red-500' : ''
                      }`}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-mono font-bold mb-1">
                      Beschrijving
                    </label>
                    <textarea
                      name="beschrijving"
                      value={formData.beschrijving || ''}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border rounded-md bg-[#F7F6ED] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      rows="3"
                    />
                  </div>

                  <div className="flex justify-start">
                    <label className="flex items-center gap-2 text-base font-mono">
                      <input
                        type="checkbox"
                        name="is_uitgelicht"
                        checked={formData.is_uitgelicht}
                        onChange={handleChange}
                        className="accent-black"
                      />
                      <span className="block text-sm">Uitgelicht</span>
                    </label>
                  </div>

                  <div>
                    <label className="block text-sm font-mono font-bold mb-1">
                      Cover Afbeelding
                    </label>
                    <div className="relative w-full h-[200px] flex items-center justify-center border-2 border-dashed border-gray-400 rounded-md bg-[#D9D9D9] cursor-pointer group">
                      <input
                        type="file"
                        name="cover_image"
                        onChange={handleChange}
                        accept="image/*"
                        className="opacity-0 absolute inset-0 w-full h-full cursor-pointer z-10"
                        tabIndex="-1"
                      />
                      {coverPreview ? (
                        <>
                          <img src={coverPreview} alt="Preview omslag" className="object-contain max-h-full max-w-full z-0" />
                          <div 
                            className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all duration-200 flex items-center justify-center z-20 cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              document.querySelector('input[name="cover_image"]').click();
                            }}
                          >
                            <span className="text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-sm font-mono">
                              Klik om te vervangen
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setCoverPreview(null);
                              setFormData(prev => ({ ...prev, cover_image: null }));
                              setRemoveImage(true);
                            }}
                            className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-30"
                            title="Verwijder omslagfoto"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                          </button>
                        </>
                      ) : (
                        <div className="flex flex-col items-center gap-2">
                          <svg width="45" height="40" viewBox="0 0 45 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <g clipPath="url(#clip0_159_301)">
                              <path d="M30 26.6667L22.5 20M22.5 20L15 26.6667M22.5 20V35M38.2312 30.65C40.06 29.7638 41.5047 28.3615 42.3373 26.6644C43.1698 24.9673 43.3429 23.072 42.8291 21.2778C42.3154 19.4836 41.144 17.8925 39.5 16.7557C37.856 15.619 35.8329 15.0012 33.75 15H31.3875C30.82 13.0487 29.7622 11.2372 28.2937 9.70165C26.8251 8.16608 24.9841 6.94641 22.9089 6.13434C20.8338 5.32227 18.5785 4.93892 16.3127 5.01313C14.0469 5.08734 11.8295 5.61716 9.8272 6.56277C7.82491 7.50838 6.08983 8.84516 4.75241 10.4726C3.415 12.1001 2.51004 13.9759 2.10559 15.959C1.70113 17.9421 1.8077 19.9809 2.41727 21.9221C3.02685 23.8633 4.12358 25.6564 5.625 27.1667" stroke="#F3F3F3" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
                            </g>
                            <defs>
                              <clipPath id="clip0_159_301">
                                <rect width="45" height="40" fill="white"/>
                              </clipPath>
                            </defs>
                          </svg>
                          <span className="text-gray-500 text-center text-lg select-none pointer-events-none z-0">Klik om omslagfoto toe te voegen</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-4 mt-6 pt-4 border-t">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800 font-mono"
                  >
                    Annuleren
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 font-mono"
                  >
                    {isLoading ? 'Bezig...' : 'Opslaan'}
                  </button>
                </div>
              </>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};

export default CreateDialog; 