import type { AgentRole } from '@omen/shared';
import { Boxes, ServerCrash, Wrench } from 'lucide-react';

import { Badge } from '../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { ScrollArea } from '../ui/scroll-area';
import { cn } from '../../lib/utils';

export type RegisteredServiceStatus = 'online' | 'degraded' | 'offline';

export type RegisteredAxlService = {
  registrationId: string;
  service: string;
  version: string;
  peerId: string | null;
  role: AgentRole;
  description: string;
  methods: string[];
  tags: string[];
  status: RegisteredServiceStatus;
  registeredAt: string;
  lastSeenAt: string;
};

type ServiceRegistryPanelProps = {
  services?: RegisteredAxlService[];
  capturedAt?: string | null;
  isLoading?: boolean;
  error?: Error | null;
  className?: string;
};

const statusClassName: Record<RegisteredServiceStatus, string> = {
  online: 'border-green-500/40 bg-green-500/10 text-green-300',
  degraded: 'border-yellow-500/40 bg-yellow-500/10 text-yellow-300',
  offline: 'border-red-500/40 bg-red-500/10 text-red-300',
};

const formatRole = (role: string) => role.replace(/_/g, ' ').toUpperCase();

const formatDateTime = (value: string | null | undefined) => {
  if (!value) {
    return 'UNKNOWN';
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
};

export function ServiceRegistryPanel({
  services = [],
  capturedAt,
  isLoading,
  error,
  className,
}: ServiceRegistryPanelProps) {
  const roleCount = new Set(services.map((service) => service.role)).size;
  const methodCount = services.reduce((total, service) => total + service.methods.length, 0);

  if (isLoading && services.length === 0) {
    return (
      <Card className={cn('bg-gray-900/50 border-gray-800', className)}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-gray-400">
            <Boxes className="h-4 w-4 text-purple-300" />
            Service Registry
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-12 animate-pulse rounded-lg border border-gray-800 bg-gray-950/50" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('bg-gray-900/50 border-gray-800', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-gray-400">
              <Boxes className="h-4 w-4 text-purple-300" />
              Service Registry
            </CardTitle>
            <p className="mt-1 text-xs text-gray-500">
              {error ? 'Registry unavailable' : `Captured ${formatDateTime(capturedAt)}`}
            </p>
          </div>
          <Badge className="border-purple-500/40 bg-purple-500/10 text-purple-200">
            {services.length} SERVICES
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {error && services.length === 0 ? (
          <div className="flex h-36 flex-col items-center justify-center rounded-lg border border-red-500/20 bg-red-950/10 text-center">
            <ServerCrash className="mb-3 h-8 w-8 text-red-400/70" />
            <p className="text-sm text-red-200">Unable to load service registry.</p>
          </div>
        ) : services.length === 0 ? (
          <div className="flex h-36 flex-col items-center justify-center rounded-lg border border-gray-800 bg-gray-950/40 text-center">
            <Wrench className="mb-3 h-8 w-8 text-gray-600" />
            <p className="text-sm text-gray-500">No AXL services registered.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border border-gray-800 bg-gray-950/40 p-3">
                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Roles</div>
                <div className="mt-1 font-mono text-lg text-white">{roleCount}</div>
              </div>
              <div className="rounded-lg border border-gray-800 bg-gray-950/40 p-3">
                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Methods</div>
                <div className="mt-1 font-mono text-lg text-cyan-300">{methodCount}</div>
              </div>
              <div className="rounded-lg border border-gray-800 bg-gray-950/40 p-3">
                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Healthy</div>
                <div className="mt-1 font-mono text-lg text-green-300">
                  {services.filter((service) => service.status === 'online').length}
                </div>
              </div>
            </div>

            <ScrollArea className="h-[360px] pr-3">
              <div className="space-y-2">
                {services.map((service) => (
                  <div key={service.registrationId} className="rounded-lg border border-gray-800 bg-gray-950/40 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-mono text-sm text-white">{service.service}</div>
                        <div className="mt-1 text-xs text-gray-500">
                          {formatRole(service.role)} / {service.peerId ?? 'UNBOUND'}
                        </div>
                      </div>
                      <Badge className={cn('shrink-0 uppercase', statusClassName[service.status])}>
                        {service.status}
                      </Badge>
                    </div>
                    <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-gray-400">{service.description}</p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {service.methods.slice(0, 5).map((method) => (
                        <span key={method} className="rounded border border-cyan-900/50 bg-cyan-950/20 px-2 py-1 font-mono text-[10px] text-cyan-200">
                          {method}
                        </span>
                      ))}
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t border-gray-800 pt-2 text-xs">
                      <span className="text-gray-600">Last seen</span>
                      <span className="font-mono text-gray-400">{formatDateTime(service.lastSeenAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
