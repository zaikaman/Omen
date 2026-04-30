import { Link } from 'react-router-dom';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { XLogo } from './ui/XLogo';
import { HugeiconsIcon } from '@hugeicons/react';
import { Calendar01Icon, ArrowRight01Icon } from '@hugeicons/core-free-icons';
import { Cpu, FileCheck2, Newspaper, RadioTower } from 'lucide-react';
import type { IntelCardItem } from '../types/ui-models';

const AGENT_AVATAR = '/generated/omen-logo-v2.png';

interface IntelCardProps {
  intel: IntelCardItem | null | undefined;
  isLoading?: boolean;
  error?: Error | null;
  onClick?: () => void;
}

export function IntelCard({ intel, isLoading, error, onClick }: IntelCardProps) {
  if (isLoading) {
    return <div className="h-72 bg-gray-900/50 animate-pulse rounded-xl border border-gray-800" />;
  }

  if (!intel) {
    return (
      <Card className="bg-gray-900/50 border-gray-800">
        <div className="flex h-72 flex-col items-center justify-center px-6 text-center text-gray-500">
          <Newspaper className="mb-4 h-12 w-12 opacity-20" />
          <p className="text-sm text-gray-400">
            {error ? 'Unable to load latest intelligence.' : 'No intelligence published yet.'}
          </p>
        </div>
      </Card>
    );
  }

  const { content, created_at, type } = intel;
  const title = content.topic || "Market Intelligence Report";
  const excerpt =
    content.tweet_text ||
    (content.formatted_thread ? `${content.formatted_thread.slice(0, 150)}...` : 'No summary available yet.');
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
  const proofBadges = intel.proofBadges;
  const proofHref = (section: string) =>
    proofBadges
      ? `/app/evidence?runId=${encodeURIComponent(proofBadges.runId)}&section=${encodeURIComponent(section)}`
      : null;
  const visibleProofBadges = proofBadges
    ? [
        {
          label: '0G Manifest',
          isVisible: proofBadges.hasManifest,
          section: 'storage',
          icon: FileCheck2,
          className: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-200 hover:border-cyan-400/50',
        },
        {
          label: 'Compute Hash',
          isVisible: proofBadges.hasComputeHash,
          section: 'compute',
          icon: Cpu,
          className: 'border-green-500/30 bg-green-500/10 text-green-200 hover:border-green-400/50',
        },
        {
          label: 'AXL Routed',
          isVisible: proofBadges.hasAxlRoute,
          section: 'axl-routes',
          icon: RadioTower,
          className: 'border-purple-500/30 bg-purple-500/10 text-purple-200 hover:border-purple-400/50',
        },
        {
          label: 'Post Proof',
          isVisible: proofBadges.hasPostProof,
          href: proofBadges.postProofUrl,
          icon: XLogo,
          className: 'border-pink-500/30 bg-pink-500/10 text-pink-200 hover:border-pink-400/50',
        },
      ].filter((badge) => badge.isVisible)
    : [];

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

        {proofBadges && visibleProofBadges.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {visibleProofBadges.map((proofBadge) => {
              const Icon = proofBadge.icon;
              const href = 'href' in proofBadge ? proofBadge.href : proofHref(proofBadge.section);

              if (href?.startsWith('http')) {
                return (
                  <a
                    key={proofBadge.label}
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(event) => event.stopPropagation()}
                    className={`inline-flex items-center gap-1.5 rounded border px-2 py-1 font-mono text-[10px] uppercase tracking-wide transition-colors ${proofBadge.className}`}
                    aria-label={`Open ${proofBadge.label} for this report`}
                  >
                    <Icon className="h-3 w-3" />
                    {proofBadge.label}
                  </a>
                );
              }

              return (
                <Link
                  key={proofBadge.label}
                  to={href ?? '/app/evidence'}
                  onClick={(event) => event.stopPropagation()}
                  className={`inline-flex items-center gap-1.5 rounded border px-2 py-1 font-mono text-[10px] uppercase tracking-wide transition-colors ${proofBadge.className}`}
                  aria-label={`Open ${proofBadge.label} evidence for this report`}
                >
                  <Icon className="h-3 w-3" />
                  {proofBadge.label}
                </Link>
              );
            })}
          </div>
        )}

        <div className="flex items-center justify-between pt-3 border-t border-gray-800">
          <div className="flex items-center gap-2.5">
            <Avatar className="h-7 w-7 border border-gray-700">
              <AvatarImage src={AGENT_AVATAR} />
              <AvatarFallback className="bg-cyan-950 text-cyan-400 text-[10px]">OM</AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-white">Omen</span>
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
