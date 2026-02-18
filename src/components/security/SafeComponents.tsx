import React, { useState } from 'react';
import { sanitizeHtml, sanitizeText, useSanitizedHtml } from '../../utils/sanitize';

/**
 * Example: Safe HTML rendering component
 * Use this when you need to render HTML from untrusted sources like:
 * - User-generated content
 * - API responses
 * - Rich text editor output
 */
export const SafeHtmlContent: React.FC<{ content: string; className?: string }> = ({ 
  content, 
  className 
}) => {
  const sanitizedContent = useSanitizedHtml(content);
  
  return (
    <div 
      className={className}
      dangerouslySetInnerHTML={sanitizedContent}
    />
  );
};

/**
 * Example: Safe text input component with real-time sanitization
 */
export const SafeTextInput: React.FC<{
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}> = ({ value, onChange, placeholder, className }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const sanitized = sanitizeText(e.target.value);
    onChange(sanitized);
  };

  return (
    <input
      type="text"
      value={value}
      onChange={handleChange}
      placeholder={placeholder}
      className={className}
    />
  );
};

/**
 * Example: Safe textarea with HTML sanitization
 */
export const SafeTextArea: React.FC<{
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  allowHtml?: boolean;
}> = ({ value, onChange, placeholder, className, allowHtml = false }) => {
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const sanitized = allowHtml 
      ? sanitizeHtml(e.target.value)
      : sanitizeText(e.target.value);
    onChange(sanitized);
  };

  return (
    <textarea
      value={value}
      onChange={handleChange}
      placeholder={placeholder}
      className={className}
    />
  );
};

/**
 * Example: Comment component with XSS protection
 */
export const SafeComment: React.FC<{
  author: string;
  content: string;
  timestamp: string;
}> = ({ author, content, timestamp }) => {
  // Sanitize all user inputs
  const safeAuthor = sanitizeText(author);
  const safeContent = sanitizeHtml(content);

  return (
    <div className="border rounded-lg p-4 mb-4">
      <div className="flex justify-between items-center mb-2">
        <span className="font-semibold">{safeAuthor}</span>
        <span className="text-sm text-gray-500">{timestamp}</span>
      </div>
      <div dangerouslySetInnerHTML={{ __html: safeContent }} />
    </div>
  );
};

/**
 * Example usage in a form component
 */
export const SafeFormExample: React.FC = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // All inputs are already sanitized via SafeTextInput/SafeTextArea
    console.log('Safe form data:', formData);
    
    // Send to API...
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block mb-2">Name</label>
        <SafeTextInput
          value={formData.name}
          onChange={(name) => setFormData({ ...formData, name })}
          placeholder="Your name"
          className="w-full px-4 py-2 border rounded"
        />
      </div>

      <div>
        <label className="block mb-2">Email</label>
        <SafeTextInput
          value={formData.email}
          onChange={(email) => setFormData({ ...formData, email })}
          placeholder="your@email.com"
          className="w-full px-4 py-2 border rounded"
        />
      </div>

      <div>
        <label className="block mb-2">Message</label>
        <SafeTextArea
          value={formData.message}
          onChange={(message) => setFormData({ ...formData, message })}
          placeholder="Your message"
          className="w-full px-4 py-2 border rounded h-32"
        />
      </div>

      <button 
        type="submit"
        className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        Submit
      </button>
    </form>
  );
};
