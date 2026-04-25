import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { HugeiconsIcon } from '@hugeicons/react';
import { Calendar01Icon, ArrowRight01Icon } from '@hugeicons/core-free-icons';

const AGENT_AVATAR = '/logo.webp';

interface IntelCardProps {
  intel: any;
  onClick?: () => void;
}

export function IntelCard({ intel, onClick }: IntelCardProps) {
  const { content, created_at, type } = intel;
  const title = content.topic || "Market Intelligence Report";
  const excerpt = content.tweet_text || content.formatted_thread?.slice(0, 150) + '...';
  const date = new Date(created_at).toLocaleDateString(undefined, { 
    month: 'short', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const isDeepDive = type === 'deep_dive';
  const badgeText = isDeepDive ? 'DEEP DIVE' : 'ALPHA REPORT';
  const badgeClass = isDeepDive 
    ? 'bg-gradient-to-r from-amber-500/90 to-orange-500/90 backdrop-blur-md text-white border-amber-400/30 font-bold'
    : 'bg-black/50 backdrop-blur-md text-white border-white/20';

  // Generate a deterministic gradient based on the ID or title
  const gradients = [
    "from-purple-600 to-blue-600",
    "from-cyan-600 to-blue-600",
    "from-emerald-600 to-teal-600",
    "from-orange-600 to-red-600",
    "from-pink-600 to-rose-600",
  ];
  const gradientIndex = (intel.id.charCodeAt(0) || 0) % gradients.length;
  const gradient = gradients[gradientIndex];
  const imageUrl = content.image_url;

  return (
    <Card 
      className="bg-gray-900/50 border-gray-800 overflow-hidden group cursor-pointer hover:border-gray-700 transition-all duration-300 hover:shadow-lg hover:shadow-cyan-900/10"
      onClick={onClick}
    >
      {/* Hero Image / Gradient Area */}
      <div className={`h-40 w-full bg-gradient-to-br ${gradient} relative p-5 flex flex-col justify-end`}>
        {imageUrl && (
          <img 
            src={imageUrl} 
            alt={title} 
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        )}
        <div className={`absolute inset-0 ${imageUrl ? 'bg-black/60' : 'bg-black/20'} group-hover:bg-black/40 transition-colors`} />
        
        {/* Overlay Content */}
        <div className="relative z-10">
          <Badge className={`${badgeClass} mb-2 hover:bg-black/60 text-xs h-6 px-2.5`}>
            {badgeText}
          </Badge>
          <h3 className="text-xl font-bold text-white leading-tight line-clamp-2 drop-shadow-md">
            {title}
          </h3>
        </div>
      </div>

      {/* Content Area */}
      <div className="p-5 space-y-3">
        <p className="text-gray-400 line-clamp-2 text-sm leading-relaxed">
          {excerpt}
        </p>

        <div className="flex items-center justify-between pt-3 border-t border-gray-800">
          <div className="flex items-center gap-2.5">
            <Avatar className="h-7 w-7 border border-gray-700">
              <AvatarImage src={AGENT_AVATAR} />
              <AvatarFallback className="bg-cyan-950 text-cyan-400 text-[10px]">RA</AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-white">Rogue Agent</span>
              <span className="text-[10px] text-gray-500 flex items-center gap-1">
                <HugeiconsIcon icon={Calendar01Icon} className="w-3 h-3" />
                {date}
              </span>
            </div>
          </div>

          <div className="text-cyan-500 group-hover:translate-x-1 transition-transform">
            <HugeiconsIcon icon={ArrowRight01Icon} className="w-4 h-4" />
          </div>
        </div>
      </div>
    </Card>
  );
}
