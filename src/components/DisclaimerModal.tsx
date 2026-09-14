'use client';

import React, { useState } from 'react';
import { AlertTriangle, ShieldCheck } from 'lucide-react';

interface DisclaimerModalProps {
  isOpen: boolean;
  userId: string;
  onAcknowledged: () => void;
}

export default function DisclaimerModal({ isOpen, userId, onAcknowledged }: DisclaimerModalProps) {
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleConfirm = async () => {
    if (!agreed) {
      setError('You must acknowledge the health notice to proceed.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/auth/disclaimer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (res.ok) {
        onAcknowledged();
      } else {
        setError(data.error || 'Failed to record acknowledgement.');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-[#FCFAF6] border border-[#14201A]/10 rounded-2xl max-w-lg w-full p-6 md:p-8 shadow-2xl animate-in fade-in zoom-in duration-200">
        <div className="flex items-center gap-3 text-[#0B3D2E] mb-4">
          <div className="w-10 h-10 rounded-xl bg-[#F2F7D9] flex items-center justify-center text-[#0B3D2E]">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-serif text-2xl font-medium tracking-tight">
              Health & Metrics Notice
            </h2>
            <p className="text-xs uppercase tracking-widest text-[rgb(90,102,96)] font-semibold">
              Mandatory Onboarding Agreement
            </p>
          </div>
        </div>

        <div className="space-y-3.5 text-sm text-[rgb(90,102,96)] leading-relaxed bg-[#F3EFE5]/70 p-4 rounded-xl border border-[#14201A]/5 my-4">
          <p>
            <strong className="text-[#14201A]">Urji Fit</strong> provides training progression suggestions, calorie/macro calculations, fasting timers, and body-composition tracking as <em>educational estimates and personal habit planning tools</em>.
          </p>
          <div className="flex gap-2.5 text-xs text-[#C1502E] bg-[#C1502E]/10 p-3 rounded-lg border border-[#C1502E]/20">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>
              <strong>Not Medical Advice:</strong> Always consult with a licensed physician or medical professional before starting any new diet, intense resistance regimen, or extended fasting routine, especially if you have pre-existing cardiovascular, metabolic, or musculoskeletal conditions.
            </span>
          </div>
          <p>
            You agree to exercise with proper form, heed physical discomfort or pain immediately, and log truthful body metrics.
          </p>
        </div>

        {error && (
          <p className="text-xs text-red-600 mb-3 bg-red-50 p-2.5 rounded-lg border border-red-200">
            {error}
          </p>
        )}

        <label className="flex items-start gap-3 cursor-pointer select-none text-xs text-[#14201A] font-medium my-4">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 w-4 h-4 rounded border-[#14201A]/20 text-[#0B3D2E] focus:ring-[#0B3D2E]"
          />
          <span>
            I understand and acknowledge that Urji Fit estimates are not medical advice and I assume full personal responsibility for my health and training decisions.
          </span>
        </label>

        <button
          onClick={handleConfirm}
          disabled={!agreed || submitting}
          className="w-full bg-[#0B3D2E] hover:bg-[#135440] disabled:opacity-50 text-[#F2F7D9] py-3 rounded-xl font-medium text-sm transition-all shadow-md flex items-center justify-center gap-2"
        >
          {submitting ? 'Saving...' : 'Acknowledge & Enter Urji Fit'}
        </button>
      </div>
    </div>
  );
}
