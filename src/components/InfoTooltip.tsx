import React, { useState } from 'react';
import { Info } from 'lucide-react';

export function InfoTooltip({ text }: { text: string }) {
  const [show, setShow] = useState(false);

  return (
    <div className="relative inline-flex items-center justify-center ml-2" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      <Info className="w-4 h-4 text-indigo-400 hover:text-indigo-600 cursor-help" />
      {show && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-slate-800 text-white text-xs rounded-lg shadow-lg z-50 text-center">
          {text}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-800"></div>
        </div>
      )}
    </div>
  );
}
