import { useState } from 'react';
import { Badge } from './ui/badge';
import { Calendar01Icon, Share01Icon, Tick01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import type { IntelCategory, IntelSource, IntelStatus } from '@omen/shared';

interface IntelBlogProps {
  title?: string;
  content: string;
  date?: string;
  imageUrl?: string;
  tldr?: string;
  category?: IntelCategory;
  status?: IntelStatus;
  symbols?: string[];
  confidence?: number;
  sources?: IntelSource[];
  proofRefIds?: string[];
}

const formatLabel = (value: string) => value.replace(/_/g, ' ').toUpperCase();

export function IntelBlog({
  title = 'Market Intelligence Report',
  content,
  date,
  imageUrl,
  tldr,
  category,
  status,
  symbols = [],
  confidence,
  sources = [],
  proofRefIds = [],
}: IntelBlogProps) {
  const [copied, setCopied] = useState(false);

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Simple markdown-ish parser for now since we don't have a library
  // We'll handle headers (#), bold (**), and paragraphs
  const renderContent = (text: string) => {
    if (!text) return null;

    return text.split('\n').map((line, i) => {
      // Headers
      if (line.startsWith('### ')) {
        return <h3 key={i} className='text-xl font-bold text-cyan-400 mt-8 mb-4 font-mono uppercase tracking-wider border-l-4 border-cyan-500 pl-3'>{line.replace('### ', '')}</h3>;
      }
      if (line.startsWith('## ')) {
        return <h2 key={i} className='text-2xl font-bold text-white mt-10 mb-6 border-b border-cyan-900/50 pb-2 font-mono uppercase tracking-widest'>{line.replace('## ', '')}</h2>;
      }
      if (line.startsWith('# ')) {
        return <h1 key={i} className='text-4xl font-black text-white mt-8 mb-8 tracking-tighter'>{line.replace('# ', '')}</h1>;
      }

      // Blockquotes
      if (line.startsWith('> ')) {
        return (
          <blockquote key={i} className='border-l-4 border-cyan-500/50 bg-cyan-950/10 p-4 my-6 italic text-gray-300'>
            {parseInline(line.replace('> ', ''))}
          </blockquote>
        );
      }

      // Lists
      if (line.trim().startsWith('- ')) {
        return (
          <div key={i} className='flex items-start gap-3 mb-3 ml-2 group'>
            <div className='w-1.5 h-1.5 rounded-none bg-cyan-500 mt-2.5 shrink-0 group-hover:bg-cyan-400 transition-colors rotate-45' />
            <p className='text-gray-300 leading-relaxed font-serif text-lg'>
              {parseInline(line.replace('- ', ''))}
            </p>
          </div>
        );
      }

      // Empty lines
      if (line.trim() === '') {
        return <div key={i} className='h-6' />;
      }

      // Regular paragraphs
      return (
        <p key={i} className='text-gray-300 leading-relaxed mb-4 font-serif text-lg text-justify'>
          {parseInline(line)}
        </p>
      );
    });
  };

  // Helper to handle bold text (**text**)
  const parseInline = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className='text-cyan-200 font-semibold'>{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  return (
    <div className='bg-black border border-gray-800 rounded-none overflow-hidden flex flex-col shadow-[0_0_30px_rgba(0,255,255,0.05)]'>
      {imageUrl && (
        <div className='w-full h-[28rem] md:h-[32rem] relative shrink-0 group'>
          <img src={imageUrl} alt={title} className='w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-700' />
          <div className='absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent' />
          <div className='absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-black to-transparent'>
            <div className='flex items-center gap-3 mb-4'>
              <Badge variant='outline' className='bg-cyan-950/50 text-cyan-400 border-cyan-500/50 rounded-none px-3 py-1 font-mono text-xs tracking-widest uppercase'>
                CLASSIFIED INTEL
              </Badge>
              {date && (
                <div className='flex items-center gap-2 text-xs text-cyan-600 font-mono uppercase tracking-wider'>
                  <HugeiconsIcon icon={Calendar01Icon} className='w-3 h-3' />
                  {date}
                </div>
              )}
            </div>
            <h1 className='text-4xl md:text-5xl font-black text-white tracking-tighter leading-tight mb-2 font-sans'>
              {title}
            </h1>
          </div>
        </div>
      )}

      {!imageUrl && (
        <div className='p-8 border-b border-gray-800 bg-gray-950'>
          <div className='flex items-center gap-3 mb-4'>
            <Badge variant='outline' className='bg-cyan-950/50 text-cyan-400 border-cyan-500/50 rounded-none px-3 py-1 font-mono text-xs tracking-widest uppercase'>
              CLASSIFIED INTEL
            </Badge>
            {date && (
              <div className='flex items-center gap-2 text-xs text-cyan-600 font-mono uppercase tracking-wider'>
                <HugeiconsIcon icon={Calendar01Icon} className='w-3 h-3' />
                {date}
              </div>
            )}
          </div>
          <h1 className='text-4xl md:text-5xl font-black text-white tracking-tighter leading-tight font-sans'>
            {title}
          </h1>
        </div>
      )}

      <div className='p-8 md:p-12 bg-black relative'>
        {/* Background Grid */}
        <div className='absolute inset-0 bg-[linear-gradient(to_right,#111_1px,transparent_1px),linear-gradient(to_bottom,#111_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none' />

        <div className='relative max-w-3xl mx-auto'>
          {tldr && (
            <div className='mb-12 p-6 border border-cyan-900/30 bg-cyan-950/5 relative overflow-hidden'>
              <div className='absolute top-0 left-0 w-1 h-full bg-cyan-500' />
              <h4 className='text-cyan-500 font-mono text-sm uppercase tracking-widest mb-2 flex items-center gap-2'>
                <span className='w-2 h-2 bg-cyan-500 rounded-full animate-pulse' />
                Executive Summary
              </h4>
              <p className='text-lg text-cyan-100/80 font-sans leading-relaxed italic'>
                {tldr}
              </p>
            </div>
          )}

          <div className='mb-10 grid grid-cols-1 gap-3 border border-gray-800 bg-gray-950/60 p-4 sm:grid-cols-2 lg:grid-cols-4'>
            {category && (
              <div>
                <div className='font-mono text-[10px] uppercase tracking-widest text-gray-600'>Category</div>
                <div className='mt-1 font-mono text-xs text-cyan-300'>{formatLabel(category)}</div>
              </div>
            )}
            {typeof confidence === 'number' && (
              <div>
                <div className='font-mono text-[10px] uppercase tracking-widest text-gray-600'>Confidence</div>
                <div className='mt-1 font-mono text-xs text-cyan-300'>{confidence}%</div>
              </div>
            )}
            {status && (
              <div>
                <div className='font-mono text-[10px] uppercase tracking-widest text-gray-600'>Status</div>
                <div className='mt-1 font-mono text-xs text-cyan-300'>{formatLabel(status)}</div>
              </div>
            )}
            <div>
              <div className='font-mono text-[10px] uppercase tracking-widest text-gray-600'>Symbols</div>
              <div className='mt-1 font-mono text-xs text-cyan-300'>{symbols.length > 0 ? symbols.join(' / ') : 'MARKET'}</div>
            </div>
          </div>

          <div className='prose prose-invert prose-lg max-w-none prose-headings:font-sans prose-p:font-serif prose-p:text-gray-300 prose-a:text-cyan-400 hover:prose-a:text-cyan-300'>
            {renderContent(content)}
          </div>

          {(sources.length > 0 || proofRefIds.length > 0) && (
            <div className='mt-14 grid grid-cols-1 gap-6 border-t border-gray-800 pt-8 md:grid-cols-2'>
              {sources.length > 0 && (
                <div>
                  <h4 className='mb-3 font-mono text-xs uppercase tracking-widest text-gray-500'>Sources</h4>
                  <div className='space-y-2'>
                    {sources.map((source) => (
                      <div key={`${source.provider}-${source.label}`} className='text-sm text-gray-400'>
                        {source.url ? (
                          <a href={source.url} target='_blank' rel='noreferrer' className='text-cyan-400 hover:text-cyan-300'>
                            {source.label}
                          </a>
                        ) : (
                          <span>{source.label}</span>
                        )}
                        <span className='ml-2 font-mono text-[10px] uppercase tracking-wider text-gray-600'>{source.provider}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {proofRefIds.length > 0 && (
                <div>
                  <h4 className='mb-3 font-mono text-xs uppercase tracking-widest text-gray-500'>0G Proof Refs</h4>
                  <div className='flex flex-wrap gap-2'>
                    {proofRefIds.map((proofRefId) => (
                      <span key={proofRefId} className='border border-gray-800 bg-gray-950 px-2 py-1 font-mono text-[10px] text-gray-400'>
                        {proofRefId}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className='mt-16 pt-8 border-t border-gray-800 flex items-center justify-between'>
            <div className='font-mono text-xs text-gray-600 uppercase tracking-widest'>
              End of Transmission
            </div>
            <button
              onClick={handleShare}
              className='flex items-center gap-2 text-gray-500 hover:text-cyan-400 transition-colors font-mono text-xs uppercase tracking-wider'
            >
              {copied ? <HugeiconsIcon icon={Tick01Icon} className='w-4 h-4' /> : <HugeiconsIcon icon={Share01Icon} className='w-4 h-4' />}
              {copied ? 'Copied' : 'Share Intel'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
