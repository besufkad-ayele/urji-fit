'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';

export interface CoachingPartner {
  id: string;
  gymId: string;
  name: string;
  relationship: string;
}

interface CoachingMessage {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

interface MessageThreadProps {
  currentUserId: string;
  partners: CoachingPartner[];
}

function threadKey(partner: CoachingPartner): string {
  return `${partner.gymId}:${partner.id}`;
}

export default function MessageThread({ currentUserId, partners }: MessageThreadProps) {
  const [selectedKey, setSelectedKey] = useState('');
  const [messages, setMessages] = useState<CoachingMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const selected = partners.find((partner) => threadKey(partner) === selectedKey) ?? partners[0] ?? null;

  const loadMessages = useCallback(async (partner: CoachingPartner) => {
    setLoading(true);
    setError('');
    try {
      const query = new URLSearchParams({ partnerId: partner.id, gymId: partner.gymId });
      const response = await fetch(`/api/coaching/messages?${query}`);
      const result = await response.json();
      if (!response.ok || !Array.isArray(result.messages)) {
        throw new Error(result.error || 'Could not load this conversation.');
      }
      setMessages(result.messages);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load this conversation.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Fetch the selected authorized thread when the conversation changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (selected) void loadMessages(selected);
  }, [selected, loadMessages]);

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = event.currentTarget;
    const content = new FormData(form).get('content');
    if (typeof content !== 'string' || !content.trim()) return;
    setSending(true);
    setError('');
    try {
      const response = await fetch('/api/coaching/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partner_id: selected.id, gym_id: selected.gymId, content }),
      });
      const result = await response.json();
      if (!response.ok || !result.message) throw new Error(result.error || 'Could not send your message.');
      setMessages((current) => [...current, result.message]);
      form.reset();
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'Could not send your message.');
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="rounded-3xl border border-[#14201A]/10 bg-[#FCFAF6] p-5 shadow-sm md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#0B3D2E]">Coaching chat</p>
          <h2 className="mt-1 font-serif text-2xl text-[#14201A]">Direct messages</h2>
        </div>
        {partners.length > 0 && (
          <label className="text-xs font-semibold text-[#5A6660]">
            Conversation
            <select
              value={selected ? threadKey(selected) : ''}
              onChange={(event) => setSelectedKey(event.target.value)}
              className="mt-1 block min-w-48 rounded-xl border border-[#14201A]/15 bg-white px-3 py-2 text-sm text-[#14201A]"
            >
              {partners.map((partner) => (
                <option key={threadKey(partner)} value={threadKey(partner)}>
                  {partner.name} · {partner.relationship}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {error && <p role="alert" className="mt-4 rounded-xl bg-[#FBE9E1] px-3 py-2 text-sm text-[#8E341E]">{error}</p>}
      {!partners.length ? (
        <p className="mt-5 rounded-2xl bg-[#F3EFE5] p-4 text-sm text-[#5A6660]">Messaging appears when you have an active trainer-client assignment.</p>
      ) : (
        <>
          <div className="mt-5 max-h-80 space-y-3 overflow-y-auto rounded-2xl bg-[#F3EFE5]/70 p-4">
            {loading ? <p className="text-sm text-[#5A6660]">Loading conversation…</p> :
              messages.length ? messages.map((message) => {
                const own = message.sender_id === currentUserId;
                return (
                  <div key={message.id} className={`flex ${own ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 ${own ? 'bg-[#0B3D2E] text-[#F2F7D9]' : 'bg-white text-[#14201A]'}`}>
                      <p className="whitespace-pre-wrap break-words text-sm">{message.content}</p>
                      <time className={`mt-1 block text-[10px] ${own ? 'text-[#F2F7D9]/70' : 'text-[#5A6660]'}`}>
                        {new Date(message.created_at).toLocaleString()}
                      </time>
                    </div>
                  </div>
                );
              }) : <p className="text-sm text-[#5A6660]">No messages yet. Start the conversation below.</p>}
          </div>
          {selected && (
            <form onSubmit={sendMessage} className="mt-4 flex gap-2">
              <textarea
                name="content"
                required
                maxLength={4000}
                rows={2}
                placeholder={`Message ${selected.name}…`}
                className="min-w-0 flex-1 resize-y rounded-xl border border-[#14201A]/15 bg-white px-3 py-2.5 text-sm text-[#14201A] outline-none focus:border-[#0B3D2E]"
              />
              <button disabled={sending} className="self-end rounded-xl bg-[#0B3D2E] px-4 py-2.5 text-sm font-semibold text-[#F2F7D9] disabled:opacity-60">
                {sending ? 'Sending…' : 'Send'}
              </button>
            </form>
          )}
        </>
      )}
    </section>
  );
}
