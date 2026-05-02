import { useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import {
  ArrowRight,
  Check,
  ChevronRight,
  Clipboard,
  Code2,
  Copy,
  Database,
  FileText,
  GitBranch,
  Home,
  Network,
  Radio,
  Search,
  ShieldCheck,
  Terminal,
  Zap,
} from 'lucide-react';

type DocsBlock =
  | { type: 'lead'; text: string }
  | { type: 'p'; text: string }
  | { type: 'h2'; text: string }
  | { type: 'h3'; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'steps'; items: { title: string; text: string }[] }
  | { type: 'code'; language: string; code: string }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'callout'; tone: 'info' | 'proof' | 'warn'; title: string; text: string };

type DocsPageContent = {
  slug: string;
  section: string;
  title: string;
  eyebrow: string;
  description: string;
  icon: typeof FileText;
  blocks: DocsBlock[];
};

const docs: DocsPageContent[] = [
  {
    slug: 'overview',
    section: 'Start Here',
    title: 'Overview',
    eyebrow: 'OMEN',
    description: 'What Omen is, what the swarm does, and how to read the proof-first dashboard.',
    icon: FileText,
    blocks: [
      {
        type: 'lead',
        text:
          'Omen is an autonomous market-intelligence swarm that scans market, social, and on-chain context, coordinates specialized agents through AXL, produces signals and long-form intel, and records verifiable proof artifacts through 0G infrastructure.',
      },
      {
        type: 'p',
        text:
          'The product is built for auditability. A signal is not treated as credible because it appears in the interface. It becomes credible when the route, agent decisions, source evidence, checkpoint artifacts, compute verification, and publication trail can be inspected together.',
      },
      { type: 'h2', text: 'What Omen Produces' },
      {
        type: 'list',
        items: [
          'Trade signals with direction, entry, targets, stop-loss, confidence, confluence, and risk context.',
          'Narrative intelligence reports that explain market structure, catalysts, sentiment, and on-chain context.',
          'Trace histories that show which agents participated, what each role returned, and where the run branched.',
          '0G proof records including manifests, artifacts, compute adjudication, and chain anchor metadata when available.',
          'Published outputs for X and Telegram when the publisher role approves the final payload.',
        ],
      },
      { type: 'h2', text: 'Core Mental Model' },
      {
        type: 'steps',
        items: [
          {
            title: 'Observe',
            text: 'Market bias, scanner, research, and chart vision roles assemble current context from live providers and technical data.',
          },
          {
            title: 'Decide',
            text: 'Analyst and critic roles convert evidence into a structured thesis, reject weak setups, or route the run to intel-only output.',
          },
          {
            title: 'Prove',
            text: 'The system persists checkpoint material, compute review, artifacts, and manifest references so outputs remain inspectable after publication.',
          },
          {
            title: 'Publish',
            text: 'The publisher role prepares final social and dashboard outputs only after the run has enough validated context.',
          },
        ],
      },
      {
        type: 'callout',
        tone: 'proof',
        title: 'Proof-first reading',
        text:
          'When evaluating an Omen output, start with the proof badges and trace timeline, then read the narrative. The interface is designed to let evidence lead the claim.',
      },
    ],
  },
  {
    slug: 'quickstart',
    section: 'Start Here',
    title: 'Quickstart',
    eyebrow: 'FIRST RUN',
    description: 'How to inspect Omen quickly during a live review or local evaluation.',
    icon: Zap,
    blocks: [
      {
        type: 'lead',
        text:
          'Use the dashboard first when you need to understand the system quickly. Use terminal checks when you need to validate AXL topology, proof endpoints, or local development behavior.',
      },
      { type: 'h2', text: 'Dashboard Review Path' },
      {
        type: 'steps',
        items: [
          {
            title: 'Open Mission Control',
            text: 'Start at /app to see current scheduler state, latest run mode, and the primary operational navigation.',
          },
          {
            title: 'Inspect signals and intel',
            text: 'Open Signal Intercept for trade theses and Intelligence Feed for long-form reports. Use the proof chips attached to each output.',
          },
          {
            title: 'Verify the proof console',
            text: 'Open Proof Console to review manifests, artifact records, compute proof, chain anchors, and iNFT status.',
          },
          {
            title: 'Review agent traces',
            text: 'Open Trace History to see role-by-role execution and AXL-routed work across the swarm.',
          },
        ],
      },
      { type: 'h2', text: 'Local Commands' },
      {
        type: 'code',
        language: 'powershell',
        code: 'pnpm install\npnpm run build\npnpm run dev',
      },
      {
        type: 'callout',
        tone: 'info',
        title: 'Primary AXL node',
        text: 'The current deployed AXL entrypoint is https://omen-axl-node.fly.dev. Use it when validating live topology or delegation behavior.',
      },
      { type: 'h2', text: 'AXL Topology Checks' },
      {
        type: 'code',
        language: 'powershell',
        code:
          'Invoke-RestMethod https://omen-axl-node.fly.dev/topology\nInvoke-RestMethod https://omen-axl-writer.fly.dev/topology',
      },
    ],
  },
  {
    slug: 'swarm-architecture',
    section: 'Architecture',
    title: 'Swarm Architecture',
    eyebrow: 'AGENTS',
    description: 'The Omen roles, branching execution graph, and quality-control gates.',
    icon: GitBranch,
    blocks: [
      {
        type: 'lead',
        text:
          'Omen is not a single prompt wrapped in a dashboard. It is a graph of specialized roles, each responsible for a narrow part of the market-intelligence workflow.',
      },
      { type: 'h2', text: 'Role Map' },
      {
        type: 'table',
        headers: ['Role', 'Responsibility'],
        rows: [
          ['Market Bias', 'Reads macro conditions and sets LONG, SHORT, or NEUTRAL context.'],
          ['Scanner', 'Searches the asset universe for candidates aligned with current bias.'],
          ['Research', 'Pulls provider data and turns it into structured evidence.'],
          ['Chart Vision', 'Analyzes multi-timeframe candlestick context through vision-capable models.'],
          ['Analyst', 'Builds a thesis with entries, targets, invalidation, confidence, and confluence.'],
          ['Critic', 'Challenges the thesis and rejects weak or under-evidenced setups.'],
          ['Intel', 'Produces narrative intelligence when signal output is not appropriate or when context deserves a report.'],
          ['Generator', 'Converts approved intelligence into publishable formats.'],
          ['Writer', 'Builds long-form article content and can recall memory through a separate AXL peer.'],
          ['Publisher', 'Prepares final dashboard, X, and Telegram output payloads.'],
        ],
      },
      { type: 'h2', text: 'Execution Shape' },
      {
        type: 'code',
        language: 'text',
        code:
          'Market Bias\n  -> Scanner -> Research -> Chart Vision -> Analyst -> Critic\n  -> if approved: Checkpoint -> Publisher\n  -> if fixable: Analyst revision -> Critic\n  -> if rejected or neutral: Intel -> Generator -> Writer -> Checkpoint -> Publisher',
      },
      {
        type: 'callout',
        tone: 'warn',
        title: 'No forced signal production',
        text:
          'A neutral or low-quality market state is allowed to produce no trade. Omen should preserve trust by refusing output when the evidence does not support conviction.',
      },
      { type: 'h2', text: 'Quality Gates' },
      {
        type: 'list',
        items: [
          'Schema validation rejects malformed role output before it can influence the run.',
          'Risk and confidence thresholds prevent weak theses from becoming public signals.',
          'Critic review adds adversarial pressure before final approval.',
          'One structured repair loop allows near-valid theses to improve without endless retries.',
          'Independent compute verification gives a second model a chance to challenge the output.',
        ],
      },
    ],
  },
  {
    slug: 'axl-network',
    section: 'Architecture',
    title: 'AXL Network',
    eyebrow: 'PEER ROUTING',
    description: 'How deployed Omen agents communicate across separate AXL nodes.',
    icon: Network,
    blocks: [
      {
        type: 'lead',
        text:
          'Omen uses Gensyn AXL as the communication layer for the deployed swarm. Each role runs as a separate Fly app with its own AXL node identity, local MCP router, Omen role host, and A2A callback server.',
      },
      { type: 'h2', text: 'Deployment Topology' },
      {
        type: 'table',
        headers: ['Component', 'Current Deployment'],
        rows: [
          ['Orchestrator', 'https://omen-axl-node.fly.dev'],
          ['Role nodes', 'Separate omen-axl-* Fly apps for market bias, scanner, research, chart vision, analyst, critic, intel, generator, writer, memory, and publisher.'],
          ['Transport', 'AXL peer-to-peer routing with explicit target peer IDs.'],
          ['Protocol surface', 'MCP services and A2A delegation requests.'],
        ],
      },
      { type: 'h2', text: 'Why AXL Matters Here' },
      {
        type: 'list',
        items: [
          'Roles do not rely on an in-process bus for the deployed demo path.',
          'The orchestrator delegates work to role-specific peer IDs.',
          'Each role exposes independent topology evidence.',
          'The writer role can call the memory role through AXL before returning article output.',
          'Verification checks assert role completion and schema validity across the network.',
        ],
      },
      { type: 'h2', text: 'Verifier' },
      {
        type: 'code',
        language: 'powershell',
        code:
          '$env:AXL_NODE_BASE_URL="https://omen-axl-node.fly.dev"\npnpm run axl:verify:a2a',
      },
      {
        type: 'callout',
        tone: 'proof',
        title: 'Expected verifier shape',
        text:
          'A healthy verification run reports allOk true, completed role states, schemaOk true, and targetPeerId values matching the delegated AXL peer IDs.',
      },
    ],
  },
  {
    slug: 'proof-trail',
    section: 'Proof System',
    title: '0G Proof Trail',
    eyebrow: 'EVIDENCE',
    description: 'How Omen records artifacts, manifests, compute review, and chain anchors.',
    icon: ShieldCheck,
    blocks: [
      {
        type: 'lead',
        text:
          'The proof layer exists so Omen outputs can be audited after the fact. A run should leave behind enough context to understand what was observed, which agents acted, what they produced, and what was ultimately published.',
      },
      { type: 'h2', text: 'Proof Objects' },
      {
        type: 'table',
        headers: ['Object', 'Purpose'],
        rows: [
          ['Run manifest', 'A structured record connecting run ID, role outputs, artifacts, timestamps, and publication state.'],
          ['Artifacts', 'Stored evidence files, generated analysis, chart images, and output payload records.'],
          ['Compute proof', 'Independent review output from 0G Compute adjudication.'],
          ['Chain anchor', 'On-chain reference that binds a manifest or proof hash to a durable registry entry.'],
          ['Post proof', 'Reference tying a published social output back to the originating run.'],
        ],
      },
      { type: 'h2', text: 'Dashboard Interpretation' },
      {
        type: 'list',
        items: [
          'A manifest badge means the run has a structured proof record.',
          'A compute badge means independent adjudication material is available.',
          'A chain badge means a proof reference has been anchored on-chain.',
          'A post badge means the publication trail can be connected to the originating run.',
        ],
      },
      {
        type: 'callout',
        tone: 'info',
        title: 'Missing proof states',
        text:
          'If a proof field is absent, the interface should show it as missing or pending. Omen should not invent placeholder hashes, fake transaction IDs, or cosmetic proof states.',
      },
    ],
  },
  {
    slug: 'signals',
    section: 'Product Surfaces',
    title: 'Signals',
    eyebrow: 'TRADE THESIS',
    description: 'How to read Omen trade signals and assess confidence.',
    icon: Radio,
    blocks: [
      {
        type: 'lead',
        text:
          'A signal is a structured thesis, not a price alert. It should explain direction, setup, risk, confidence, confluence, and invalidation in a format that can be audited against the run trace.',
      },
      { type: 'h2', text: 'Signal Anatomy' },
      {
        type: 'list',
        items: [
          'Direction: LONG or SHORT, derived from market bias and asset-specific context.',
          'Entry: the price area where the setup becomes actionable.',
          'Targets: staged objectives that define reward and thesis progression.',
          'Stop-loss: invalidation level that limits downside.',
          'Risk/reward: summary of whether the setup clears configured thresholds.',
          'Confidence: model and critic assessment of evidence quality.',
          'Confluence: the market, technical, sentiment, and catalyst factors supporting the setup.',
        ],
      },
      { type: 'h2', text: 'Approval Logic' },
      {
        type: 'steps',
        items: [
          {
            title: 'Candidate discovery',
            text: 'Scanner selects assets only after market bias establishes a useful directional context.',
          },
          {
            title: 'Evidence assembly',
            text: 'Research and chart vision roles gather provider data, chart structure, and supporting observations.',
          },
          {
            title: 'Thesis generation',
            text: 'Analyst turns the evidence into an actionable setup with required risk fields.',
          },
          {
            title: 'Critic pressure',
            text: 'Critic either approves, requests repair, or rejects the signal path.',
          },
        ],
      },
      {
        type: 'callout',
        tone: 'warn',
        title: 'Trading risk',
        text:
          'Omen outputs are intelligence artifacts, not financial advice. Users remain responsible for execution, sizing, and risk decisions.',
      },
    ],
  },
  {
    slug: 'intel',
    section: 'Product Surfaces',
    title: 'Intel Reports',
    eyebrow: 'NARRATIVE',
    description: 'How Omen generates and publishes long-form market intelligence.',
    icon: FileText,
    blocks: [
      {
        type: 'lead',
        text:
          'Intel reports give the swarm a useful output path when the market does not justify a trade, or when the broader narrative matters more than a single entry.',
      },
      { type: 'h2', text: 'Report Structure' },
      {
        type: 'list',
        items: [
          'Market context: the broad state of liquidity, sentiment, and volatility.',
          'Narrative drivers: catalysts, ecosystem activity, social acceleration, and on-chain changes.',
          'Asset relevance: why the covered topic matters now.',
          'Evidence summary: the data sources and agent findings that shaped the report.',
          'Operational conclusion: what the swarm decided to publish and why.',
        ],
      },
      { type: 'h2', text: 'Writer And Memory' },
      {
        type: 'p',
        text:
          'The writer role can request context from the memory service through AXL before drafting article output. This lets long-form reports incorporate historical context without collapsing the architecture into shared in-process memory.',
      },
      {
        type: 'code',
        language: 'json',
        code:
          '{\n  "peerContext": {\n    "service": "memory",\n    "method": "memory.recall"\n  }\n}',
      },
    ],
  },
  {
    slug: 'dashboard',
    section: 'Product Surfaces',
    title: 'Dashboard Guide',
    eyebrow: 'INTERFACE',
    description: 'What each major app area is for and how to move through an investigation.',
    icon: Home,
    blocks: [
      {
        type: 'lead',
        text:
          'The dashboard is organized around the way a reviewer investigates the system: current run state, produced outputs, proof records, analytics, and agent trace history.',
      },
      {
        type: 'table',
        headers: ['Route', 'Purpose'],
        rows: [
          ['/app', 'Mission Control for scheduler state, latest run status, and high-level operational entry.'],
          ['/app/signals', 'Signal Intercept for approved trade theses and attached evidence.'],
          ['/app/copytrade', 'Copytrade Execution for execution-oriented signal review.'],
          ['/app/intel', 'Intelligence Feed for narrative reports and article-level outputs.'],
          ['/app/analytics', 'System Analytics for signal outcomes, activity, market views, and performance.'],
          ['/app/evidence', 'Proof Console for manifests, artifacts, compute proof, anchors, and iNFT evidence.'],
          ['/app/traces', 'Agent Trace History for run timelines, role participation, and AXL routing inspection.'],
        ],
      },
      {
        type: 'callout',
        tone: 'proof',
        title: 'Recommended judge path',
        text:
          'Start with /app/evidence and /app/traces when proving technical depth. Start with /app/signals and /app/intel when evaluating product utility.',
      },
    ],
  },
  {
    slug: 'api-reference',
    section: 'Developers',
    title: 'API Reference',
    eyebrow: 'REST',
    description: 'The dashboard-facing API families and how to reason about their payloads.',
    icon: Code2,
    blocks: [
      {
        type: 'lead',
        text:
          'The frontend consumes REST API families organized around dashboard domains: runs, signals, intel, proofs, topology, logs, analytics, posts, inFT, and copytrade.',
      },
      {
        type: 'table',
        headers: ['Client Module', 'Domain'],
        rows: [
          ['lib/api/runs.ts', 'Run status, active run, latest run, and scheduler state.'],
          ['lib/api/signals.ts', 'Approved and historical trading signals.'],
          ['lib/api/intel.ts', 'Narrative intelligence reports and article detail.'],
          ['lib/api/proofs.ts', 'Proof console records and artifact references.'],
          ['lib/api/topology.ts', 'AXL peers, services, and routing topology.'],
          ['lib/api/analytics.ts', 'Dashboard analytics for outcomes, activity, and performance.'],
          ['lib/api/copytrade.ts', 'Execution-oriented copytrade state.'],
        ],
      },
      { type: 'h2', text: 'Payload Expectations' },
      {
        type: 'list',
        items: [
          'IDs should be stable enough to link records across signals, runs, proofs, and traces.',
          'Timestamps should be ISO strings and displayed with user-locale formatting in the frontend.',
          'Proof references should be nullable when absent, never replaced with fake values.',
          'Status values should be explicit strings that can be rendered with labels and icons.',
        ],
      },
    ],
  },
  {
    slug: 'data-and-storage',
    section: 'Developers',
    title: 'Data And Storage',
    eyebrow: 'DATABASE',
    description: 'How Omen separates operational state, published output, and proof records.',
    icon: Database,
    blocks: [
      {
        type: 'lead',
        text:
          'Omen stores product-facing records in PostgreSQL while proof artifacts and decentralized evidence are handled through the 0G integration layer.',
      },
      { type: 'h2', text: 'Database Source Of Truth' },
      {
        type: 'p',
        text:
          'The current database schema is tracked in packages/db/current_schema.sql. Treat it as the reference for app-facing records when making backend or dashboard changes.',
      },
      { type: 'h2', text: 'Data Boundaries' },
      {
        type: 'list',
        items: [
          'PostgreSQL: queryable product state for dashboard pages and history.',
          '0G Storage: proof artifacts, manifests, logs, and durable evidence records.',
          '0G Compute: independent adjudication output for thesis review.',
          '0G Chain: anchor references for proofs and iNFT-related registry state.',
        ],
      },
      {
        type: 'callout',
        tone: 'warn',
        title: 'Production data only',
        text:
          'When implementing new product logic, do not add mock records, fallback evidence, or hardcoded proof behavior. Empty states should report the real missing condition.',
      },
    ],
  },
  {
    slug: 'deployment',
    section: 'Operations',
    title: 'Deployment',
    eyebrow: 'OPERATIONS',
    description: 'Where the main services run and what should be checked before a demo.',
    icon: Terminal,
    blocks: [
      {
        type: 'lead',
        text:
          'Omen is deployed across multiple surfaces: the frontend dashboard, backend API, AXL role apps, database, proof infrastructure, and publishing integrations.',
      },
      {
        type: 'table',
        headers: ['Layer', 'Deployment Surface'],
        rows: [
          ['Frontend', 'Vercel hosted React and Vite dashboard.'],
          ['Backend', 'Express API and scheduler runtime.'],
          ['AXL network', 'Fly.io apps for orchestrator and role nodes.'],
          ['Database', 'Supabase PostgreSQL.'],
          ['Proof layer', '0G Storage, 0G Compute, and 0G Chain integrations.'],
          ['Publishing', 'TwitterAPI.io and Telegram Bot API.'],
        ],
      },
      { type: 'h2', text: 'Pre-Demo Checklist' },
      {
        type: 'list',
        items: [
          'Dashboard loads and can reach the backend API.',
          'Scheduler state is visible in Mission Control.',
          'AXL topology endpoint returns the orchestrator peer and known peers.',
          'A2A verifier passes for the intended profile.',
          'Proof Console shows real manifest or missing-state records without placeholders.',
          'Publishing credentials are configured only in the runtime environment.',
        ],
      },
    ],
  },
  {
    slug: 'troubleshooting',
    section: 'Operations',
    title: 'Troubleshooting',
    eyebrow: 'RUNBOOK',
    description: 'Common failure modes and the fastest way to isolate them.',
    icon: Terminal,
    blocks: [
      {
        type: 'lead',
        text:
          'Most issues can be isolated by deciding which layer failed first: scheduler, backend API, AXL route, agent schema, proof persistence, or publisher output.',
      },
      { type: 'h2', text: 'Common Checks' },
      {
        type: 'steps',
        items: [
          {
            title: 'Dashboard cannot load data',
            text: 'Check the configured API base URL, backend health, CORS, and whether the frontend environment was rebuilt after variable changes.',
          },
          {
            title: 'AXL delegation fails',
            text: 'Confirm the orchestrator base URL, target peer ID, role app status, and topology response for the target node.',
          },
          {
            title: 'Role output rejected',
            text: 'Inspect schema errors before changing prompts. The validator usually identifies the exact missing or malformed field.',
          },
          {
            title: 'Proof record missing',
            text: 'Check whether the run reached checkpointing. A failed upstream role may correctly prevent proof creation.',
          },
          {
            title: 'Publisher skipped',
            text: 'Confirm that the signal or intel payload cleared quality gates and that publishing credentials exist in the runtime environment.',
          },
        ],
      },
      { type: 'h2', text: 'Useful Commands' },
      {
        type: 'code',
        language: 'powershell',
        code:
          'pnpm run typecheck\npnpm run build\nInvoke-RestMethod https://omen-axl-node.fly.dev/topology\npnpm run axl:verify:a2a',
      },
    ],
  },
];

const toneClass = {
  info: 'border-cyan-500/20 bg-cyan-500/5 text-cyan-100',
  proof: 'border-emerald-500/20 bg-emerald-500/5 text-emerald-100',
  warn: 'border-amber-500/20 bg-amber-500/5 text-amber-100',
};

function groupedDocs() {
  return docs.reduce<Record<string, DocsPageContent[]>>((groups, page) => {
    groups[page.section] = groups[page.section] ?? [];
    groups[page.section].push(page);
    return groups;
  }, {});
}

function pageToText(page: DocsPageContent) {
  const lines = [`${page.title}`, page.description, ''];

  page.blocks.forEach((block) => {
    if (block.type === 'lead' || block.type === 'p') lines.push(block.text, '');
    if (block.type === 'h2' || block.type === 'h3') lines.push(block.text, '');
    if (block.type === 'list') lines.push(...block.items.map((item) => `- ${item}`), '');
    if (block.type === 'steps') {
      lines.push(...block.items.map((item, index) => `${index + 1}. ${item.title}: ${item.text}`), '');
    }
    if (block.type === 'code') lines.push(block.code, '');
    if (block.type === 'callout') lines.push(`${block.title}: ${block.text}`, '');
    if (block.type === 'table') {
      lines.push(block.headers.join(' | '));
      lines.push(...block.rows.map((row) => row.join(' | ')), '');
    }
  });

  return lines.join('\n').trim();
}

function DocsBlockRenderer({ block }: { block: DocsBlock }) {
  if (block.type === 'lead') {
    return <p className="text-lg leading-8 text-gray-200">{block.text}</p>;
  }

  if (block.type === 'p') {
    return <p className="text-[15px] leading-7 text-gray-300">{block.text}</p>;
  }

  if (block.type === 'h2') {
    return <h2 className="pt-8 text-2xl font-bold tracking-tight text-white">{block.text}</h2>;
  }

  if (block.type === 'h3') {
    return <h3 className="pt-4 text-lg font-semibold tracking-tight text-white">{block.text}</h3>;
  }

  if (block.type === 'list') {
    return (
      <ul className="space-y-3">
        {block.items.map((item) => (
          <li key={item} className="flex gap-3 text-[15px] leading-7 text-gray-300">
            <Check className="mt-1.5 h-4 w-4 shrink-0 text-cyan-400" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    );
  }

  if (block.type === 'steps') {
    return (
      <div className="space-y-3">
        {block.items.map((item, index) => (
          <div key={item.title} className="rounded-lg border border-gray-800 bg-gray-950/70 p-4">
            <div className="mb-2 flex items-center gap-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-md border border-cyan-500/20 bg-cyan-500/10 font-mono text-[11px] font-bold text-cyan-300">
                {String(index + 1).padStart(2, '0')}
              </span>
              <h3 className="text-sm font-semibold text-white">{item.title}</h3>
            </div>
            <p className="pl-9 text-sm leading-6 text-gray-400">{item.text}</p>
          </div>
        ))}
      </div>
    );
  }

  if (block.type === 'code') {
    return (
      <div className="overflow-hidden rounded-lg border border-gray-800 bg-[#030712]">
        <div className="flex items-center justify-between border-b border-gray-800 px-4 py-2">
          <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-gray-500">
            {block.language}
          </span>
          <Code2 className="h-4 w-4 text-cyan-500" />
        </div>
        <pre className="overflow-x-auto p-4 text-sm leading-6 text-gray-200">
          <code>{block.code}</code>
        </pre>
      </div>
    );
  }

  if (block.type === 'table') {
    return (
      <div className="overflow-hidden rounded-lg border border-gray-800">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-800 text-left text-sm">
            <thead className="bg-gray-950">
              <tr>
                {block.headers.map((header) => (
                  <th key={header} className="px-4 py-3 font-mono text-[11px] uppercase tracking-wider text-gray-500">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800 bg-gray-950/40">
              {block.rows.map((row) => (
                <tr key={row.join(':')} className="align-top">
                  {row.map((cell, index) => (
                    <td
                      key={cell}
                      className={`px-4 py-3 leading-6 ${index === 0 ? 'font-medium text-gray-100' : 'text-gray-400'}`}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-lg border p-4 ${toneClass[block.tone]}`}>
      <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-white">
        <ShieldCheck className="h-4 w-4" />
        {block.title}
      </div>
      <p className="text-sm leading-6 text-gray-300">{block.text}</p>
    </div>
  );
}

export function DocsPage() {
  const { slug } = useParams();
  const [query, setQuery] = useState('');
  const [copied, setCopied] = useState(false);
  const activeSlug = slug ?? 'overview';
  const activeIndex = docs.findIndex((page) => page.slug === activeSlug);
  const page = docs[activeIndex];
  const groups = useMemo(groupedDocs, []);

  const filteredDocs = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return docs;

    return docs.filter((item) => {
      const haystack = `${item.title} ${item.section} ${item.description} ${item.blocks
        .map((block) => JSON.stringify(block))
        .join(' ')}`.toLowerCase();
      return haystack.includes(normalized);
    });
  }, [query]);

  if (!page) {
    return <Navigate to="/docs/overview" replace />;
  }

  const nextPage = docs[activeIndex + 1] ?? docs[0];
  const Icon = page.icon;

  const copyPage = async () => {
    await navigator.clipboard.writeText(pageToText(page));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-gray-300 selection:bg-cyan-500/30">
      <header className="sticky top-0 z-40 border-b border-gray-800 bg-[#0A0A0A]/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-3 no-underline">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-cyan-500/20 bg-cyan-500/10">
              <img src="/generated/omen-logo-v2.png" alt="Omen" className="h-6 w-6 object-contain" />
            </span>
            <div>
              <div className="text-sm font-bold tracking-tight text-white">OMEN</div>
              <div className="font-mono text-[10px] uppercase tracking-wider text-gray-600">Documentation</div>
            </div>
          </Link>

          <div className="hidden min-w-0 flex-1 justify-center md:flex">
            <label className="flex h-10 w-full max-w-md items-center gap-2 rounded-lg border border-gray-800 bg-gray-950 px-3 text-sm text-gray-500 focus-within:border-cyan-500/50">
              <Search className="h-4 w-4" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search docs..."
                className="h-full min-w-0 flex-1 bg-transparent text-gray-200 outline-none placeholder:text-gray-600"
              />
              <kbd className="rounded border border-gray-700 px-1.5 py-0.5 font-mono text-[10px] text-gray-500">/</kbd>
            </label>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/app"
              className="hidden rounded-lg border border-gray-800 px-3 py-2 text-sm font-medium text-gray-300 transition-colors hover:border-cyan-500/30 hover:text-white sm:inline-flex"
            >
              Open App
            </Link>
            <button
              onClick={copyPage}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-800 bg-gray-950 px-3 py-2 text-sm font-medium text-gray-300 transition-colors hover:border-cyan-500/30 hover:text-white"
            >
              {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
              <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl grid-cols-1 md:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)_220px]">
        <aside className="min-h-0 border-b border-gray-800 bg-[#0A0A0A] md:sticky md:top-16 md:h-[calc(100vh-4rem)] md:border-b-0 md:border-r">
          <div className="p-3 md:hidden">
            <label className="flex h-10 items-center gap-2 rounded-lg border border-gray-800 bg-gray-950 px-3 text-sm text-gray-500 focus-within:border-cyan-500/50">
              <Search className="h-4 w-4" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search docs..."
                className="h-full min-w-0 flex-1 bg-transparent text-gray-200 outline-none placeholder:text-gray-600"
              />
            </label>
          </div>

          <nav className="max-h-[44vh] overflow-y-auto px-3 pb-3 md:h-full md:max-h-none md:px-5 md:py-5">
            {query.trim() ? (
              <div>
                <div className="mb-2 font-mono text-[10px] font-bold uppercase tracking-wider text-gray-500">
                  Search Results
                </div>
                <div className="space-y-1">
                  {filteredDocs.map((item) => (
                    <DocsNavLink key={item.slug} item={item} activeSlug={activeSlug} />
                  ))}
                </div>
              </div>
            ) : (
              Object.entries(groups).map(([section, items]) => (
                <div key={section} className="mb-4 last:mb-0">
                  <div className="mb-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-gray-500">
                    {section}
                  </div>
                  <div className="space-y-0.5">
                    {items.map((item) => (
                      <DocsNavLink key={item.slug} item={item} activeSlug={activeSlug} />
                    ))}
                  </div>
                </div>
              ))
            )}

            <div className="mt-5 rounded-lg border border-gray-800 bg-gray-950 p-3">
              <div className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-white">
                <Network className="h-4 w-4 text-purple-300" />
                Live AXL Entry
              </div>
              <div className="break-all font-mono text-[11px] leading-5 text-gray-500">https://omen-axl-node.fly.dev</div>
            </div>
          </nav>
        </aside>

        <main className="min-w-0 px-5 py-10 sm:px-8 lg:px-14">
          <article className="mx-auto max-w-3xl">
            <div className="mb-8">
              <div className="mb-5 flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-cyan-500/20 bg-cyan-500/10">
                  <Icon className="h-5 w-5 text-cyan-300" />
                </span>
                <div>
                  <div className="font-mono text-[11px] font-bold uppercase tracking-wider text-cyan-300">
                    {page.eyebrow}
                  </div>
                  <div className="text-sm text-gray-500">{page.section}</div>
                </div>
              </div>
              <h1 className="mb-4 text-4xl font-bold tracking-tight text-white sm:text-5xl">{page.title}</h1>
              <p className="max-w-2xl text-base leading-7 text-gray-400">{page.description}</p>
            </div>

            <div className="space-y-6">
              {page.blocks.map((block, index) => (
                <DocsBlockRenderer key={`${page.slug}-${index}`} block={block} />
              ))}
            </div>

            <Link
              to={`/docs/${nextPage.slug}`}
              className="mt-12 flex items-center justify-between rounded-lg border border-gray-800 bg-gray-950 p-5 text-left transition-colors hover:border-cyan-500/30 hover:bg-gray-900/70"
            >
              <div>
                <div className="mb-1 font-mono text-[11px] uppercase tracking-wider text-gray-500">Next</div>
                <div className="font-semibold text-white">{nextPage.title}</div>
              </div>
              <ArrowRight className="h-5 w-5 text-cyan-400" />
            </Link>
          </article>
        </main>

        <aside className="hidden border-l border-gray-800 px-6 py-10 xl:block">
          <div className="sticky top-24">
            <div className="mb-4 font-mono text-[11px] font-bold uppercase tracking-wider text-gray-500">
              On This Page
            </div>
            <div className="space-y-2">
              {page.blocks
                .filter((block) => block.type === 'h2' || block.type === 'h3')
                .map((block) => (
                  <div key={block.text} className="flex items-center gap-2 text-sm text-gray-500">
                    <ChevronRight className="h-3 w-3 text-gray-700" />
                    <span>{block.text}</span>
                  </div>
                ))}
            </div>
            <div className="mt-8 rounded-lg border border-gray-800 bg-gray-950/70 p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
                <Clipboard className="h-4 w-4 text-cyan-400" />
                Docs Status
              </div>
              <p className="text-sm leading-6 text-gray-500">
                Static product docs. Runtime evidence still comes from Omen APIs and proof records.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function DocsNavLink({ item, activeSlug }: { item: DocsPageContent; activeSlug: string }) {
  const Icon = item.icon;
  const isActive = item.slug === activeSlug;

  return (
    <Link
      to={`/docs/${item.slug}`}
      className={`flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors ${
        isActive
          ? 'border border-cyan-500/20 bg-cyan-500/10 text-cyan-300'
          : 'text-gray-500 hover:bg-gray-900 hover:text-gray-200'
      }`}
    >
      <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-cyan-300' : 'text-gray-600'}`} />
      <span className="truncate">{item.title}</span>
    </Link>
  );
}
