import { useState } from 'react';
import { HelpCircle, MessageCircle, Send, ChevronRight, FileText, AlertCircle, ExternalLink } from 'lucide-react';
import { ScrollReveal } from '@/components/ScrollReveal';
import { motion, AnimatePresence } from 'framer-motion';

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

const suggestedQuestions = [
  'Why was this message sent?',
  'What happened to invoice INV-2024-042?',
  'Why wasn\'t anything sent to Volta Brand Agency?',
  'What does "High Risk" mean for a client?',
  'What should I do next?',
];

export default function SupportPage() {
  const [question, setQuestion] = useState('');
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);

  const handleAsk = (q?: string) => {
    const text = q || question;
    if (!text.trim()) return;
    setChat(prev => [...prev, { role: 'user', text }]);
    setQuestion('');
    setIsTyping(true);

    // Simulate AI response
    setTimeout(() => {
      const responses: Record<string, string> = {
        'Why was this message sent?': 'The last message to Meridian Creative Co. was a second follow-up for invoice INV-2024-042 ($8,500). It was triggered because the invoice has been overdue for 34 days and no reply was received after the first reminder sent on March 10th. The workflow "Standard Follow-Up" evaluated the conditions and generated this action.',
        'What happened to invoice INV-2024-042?': 'Here\'s the timeline for INV-2024-042:\n• Feb 1 — Invoice imported from CSV upload\n• Feb 16 — Invoice became overdue (due date: Feb 15)\n• Mar 10 — First reminder sent via email to Sarah Chen\n• Mar 21 — Second follow-up drafted, awaiting your approval\n\nCurrent status: Overdue, 34 days past due. Balance: $8,500.',
        'Why wasn\'t anything sent to Volta Brand Agency?': 'No automated messages were sent to Volta Brand Agency because invoice INV-2024-035 has an active dispute. When a dispute is raised, InFlowe automatically pauses all follow-up actions to prevent escalation. The dispute was raised on March 5th. You can resolve the dispute in the invoice detail view.',
        'What does "High Risk" mean for a client?': 'A "High Risk" score means the client has a pattern of late payments or unresponsiveness. For Volta Brand Agency (risk score: 85%), this is based on:\n• Average payment delay: 22 days past due\n• Response rate: 20% (1 of 5 reminders got a reply)\n• Active dispute on current invoice\n\nThis score helps prioritize your follow-ups.',
        'What should I do next?': 'Based on your current situation, here are my top recommendations:\n\n1. Review the 3 pending approvals — they\'ve been waiting since yesterday\n2. Reach out personally to Volta Brand Agency about the disputed invoice\n3. Consider offering Fern & Bloom a payment plan — their invoice is 39 days overdue with no response\n\nWould you like me to help with any of these?',
      };
      const answer = responses[text] || 'I can help you understand what InFlowe is doing and why. Try asking about a specific invoice, client, or action — for example, "Why was this message sent?" or "What happened to invoice #042?"';
      setChat(prev => [...prev, { role: 'assistant', text: answer }]);
      setIsTyping(false);
    }, 1500);
  };

  return (
    <div className="px-4 py-6 space-y-4 flex flex-col" style={{ minHeight: 'calc(100vh - 12rem)' }}>
      <ScrollReveal>
        <h1 className="text-xl font-bold" style={{ lineHeight: '1.1' }}>Support</h1>
        <p className="text-sm text-muted-foreground mt-1">Ask anything about your invoices, messages, or workflows</p>
      </ScrollReveal>

      {/* Chat area */}
      <div className="flex-1 space-y-3">
        {chat.length === 0 && (
          <ScrollReveal delay={0.1}>
            <div className="glass-card rounded-xl p-5 text-center">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <HelpCircle className="w-6 h-6 text-primary" />
              </div>
              <h2 className="font-semibold">How can I help?</h2>
              <p className="text-sm text-muted-foreground mt-1">I can explain any action InFlowe has taken and help you decide what to do next.</p>
            </div>
          </ScrollReveal>
        )}

        {chat.length === 0 && (
          <ScrollReveal delay={0.15}>
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Try asking</p>
              {suggestedQuestions.map(q => (
                <button key={q} onClick={() => handleAsk(q)}
                  className="w-full glass-card-hover rounded-xl p-3 text-left text-sm active:scale-[0.98] transition-transform flex items-center justify-between"
                >
                  <span>{q}</span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                </button>
              ))}
            </div>
          </ScrollReveal>
        )}

        <AnimatePresence>
          {chat.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-line ${
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground rounded-br-md'
                  : 'glass-card rounded-bl-md'
              }`}>
                {msg.text}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {isTyping && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
            <div className="glass-card rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-pulse-dot" />
              <div className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-pulse-dot" style={{ animationDelay: '0.3s' }} />
              <div className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-pulse-dot" style={{ animationDelay: '0.6s' }} />
            </div>
          </motion.div>
        )}
      </div>

      {/* Input */}
      <div className="sticky bottom-20 bg-background pt-2">
        <div className="flex gap-2">
          <input
            type="text" placeholder="Ask a question..."
            value={question} onChange={e => setQuestion(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAsk()}
            className="flex-1 px-4 py-3 rounded-xl bg-card border border-border text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-shadow"
          />
          <button onClick={() => handleAsk()} className="p-3 rounded-xl bg-primary text-primary-foreground active:scale-95 transition-transform">
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Quick links */}
      <ScrollReveal delay={0.2}>
        <div className="glass-card rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-muted/30"><h3 className="text-sm font-semibold">Need more help?</h3></div>
          <button className="w-full flex items-center gap-3 px-4 py-3 border-t border-border/40 text-sm hover:bg-muted/30 transition-colors active:scale-[0.99]">
            <FileText className="w-4 h-4 text-muted-foreground" />
            <span>Submit a support case</span>
          </button>
          <button className="w-full flex items-center gap-3 px-4 py-3 border-t border-border/40 text-sm hover:bg-muted/30 transition-colors active:scale-[0.99]">
            <AlertCircle className="w-4 h-4 text-destructive" />
            <span className="text-destructive font-medium">Emergency stop — halt all automation</span>
          </button>
        </div>
      </ScrollReveal>
    </div>
  );
}
