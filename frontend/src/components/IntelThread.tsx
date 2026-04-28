import { ScrollArea } from './ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import type { IntelSource } from '@omen/shared';

interface IntelThreadProps {
  content: string;
  title?: string;
  symbols?: string[];
  sources?: IntelSource[];
}

export function IntelThread({ content, title = 'Intel Thread', symbols = [], sources = [] }: IntelThreadProps) {
  // Simple parser to split thread into tweets/sections
  // Assuming content is formatted with "1/ ", "2/ " etc or just paragraphs
  const bodySections = typeof content === 'string' ? content.split(/\n\n/).filter(Boolean) : [];
  const sourceSection = sources.length > 0
    ? `Sources: ${sources.map((source) => source.label).join(' | ')}`
    : null;
  const sections = [
    title,
    symbols.length > 0 ? `Symbols tracked: ${symbols.join(' / ')}` : null,
    ...bodySections,
    sourceSection,
  ].filter((section): section is string => Boolean(section));

  return (
    <div className="bg-gray-950 border border-gray-800 rounded-xl overflow-hidden">
      <div className="p-4 border-b border-gray-800 bg-gray-900/50 flex items-center gap-3">
        <Avatar className="h-10 w-10 border border-cyan-500/30">
          <AvatarImage src="/generated/omen-logo-v2.png" />
          <AvatarFallback className="bg-cyan-950 text-cyan-400">OM</AvatarFallback>
        </Avatar>
        <div>
          <div className="font-bold text-white">Omen Swarm</div>
          <div className="text-xs text-cyan-400">@OmenIntel</div>
        </div>
      </div>
      
      <ScrollArea className="h-[400px] p-4">
        <div className="space-y-6">
          {sections.map((section, i) => (
            <div key={i} className="relative pl-6 border-l-2 border-gray-800 last:border-transparent">
              <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-gray-900 border-2 border-gray-700" />
              <p className="text-gray-300 whitespace-pre-wrap text-sm leading-relaxed">
                {section}
              </p>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
