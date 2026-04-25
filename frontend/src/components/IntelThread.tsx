import { ScrollArea } from './ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';

interface IntelThreadProps {
  content: string;
}

export function IntelThread({ content }: IntelThreadProps) {
  // Simple parser to split thread into tweets/sections
  // Assuming content is formatted with "1/ ", "2/ " etc or just paragraphs
  const sections = typeof content === 'string' ? content.split(/\n\n/).filter(Boolean) : [];

  return (
    <div className="bg-gray-950 border border-gray-800 rounded-xl overflow-hidden">
      <div className="p-4 border-b border-gray-800 bg-gray-900/50 flex items-center gap-3">
        <Avatar className="h-10 w-10 border border-cyan-500/30">
          <AvatarImage src="/agent-avatar.png" />
          <AvatarFallback className="bg-cyan-950 text-cyan-400">RA</AvatarFallback>
        </Avatar>
        <div>
          <div className="font-bold text-white">Rogue Agent</div>
          <div className="text-xs text-cyan-400">@RogueSignals</div>
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
