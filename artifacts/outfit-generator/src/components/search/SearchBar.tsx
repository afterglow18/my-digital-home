/**
 * Rounded search bar — magnifying glass on left, × clear on right.
 * Scrolls the page to top the instant the user starts typing.
 */
import React, { useRef, useEffect } from 'react';
import { Search, X } from 'lucide-react';

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  scrollTargetRef?: React.RefObject<HTMLElement>;
}

export function SearchBar({ value, onChange, placeholder = 'Search by name, category, or notes...', scrollTargetRef }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Scroll to top the instant text is entered
  useEffect(() => {
    if (value) {
      if (scrollTargetRef?.current) {
        scrollTargetRef.current.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
      } else {
        window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
      }
    }
  }, [value, scrollTargetRef]);

  return (
    <div className="relative flex items-center">
      <Search className="absolute left-3.5 w-4 h-4 text-black/35 pointer-events-none" />
      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="none"
        spellCheck={false}
        className="w-full pl-10 pr-10 py-2.5 rounded-full border-2 border-black bg-white
                   text-sm font-medium placeholder:text-black/35
                   focus:outline-none focus:ring-2 focus:ring-black/20
                   shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
      />
      {value && (
        <button
          onClick={() => { onChange(''); inputRef.current?.focus(); }}
          className="absolute right-3.5 w-5 h-5 flex items-center justify-center
                     rounded-full bg-black/10 hover:bg-black/20 transition-colors"
          aria-label="Clear search"
        >
          <X className="w-3 h-3 text-black/60" />
        </button>
      )}
    </div>
  );
}
