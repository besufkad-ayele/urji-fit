'use client';

import React from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
}: ModalProps) {
  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className={`bg-[#FCFAF6] border border-[#14201A]/10 rounded-3xl ${sizeClasses[size]} w-full max-h-[90vh] overflow-hidden shadow-2xl animate-in zoom-in duration-200`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#14201A]/10">
          <h2 className="font-serif text-2xl text-[#0B3D2E] font-medium">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-[rgb(90,102,96)] hover:text-[#0B3D2E] hover:bg-black/5 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {children}
        </div>
      </div>
    </div>
  );
}
