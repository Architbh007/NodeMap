import { Link } from 'react-router-dom';
import { ArrowRight, GitBranch, Layers, AlertTriangle, Zap, Target, Search, Shield, BarChart3, GitMerge } from 'lucide-react';
import { Button } from '@/components/ui/button';

const FEATURES = [
  {
    icon: <GitBranch className="w-5 h-5" />,
    color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
    title: 'Architecture Maps',
    description: 'Visualize your entire codebase as an interactive, expandable architecture diagram.',
  },
  {
    icon: <Layers className="w-5 h-5" />,
    color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
    title: 'Dependency Graphs',
    description: 'Trace every import relationship, resolve circular dependencies, detect dead code.',
  },
  {
    icon: <Zap className="w-5 h-5" />,
    color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    title: 'API Flow Mapping',
    description: 'Follow request flows from Route → Controller → Service → Repository automatically.',
  },
  {
    icon: <AlertTriangle className="w-5 h-5" />,
    color: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    title: 'Risk Detection',
    description: 'Score every module by complexity, coupling, and circular dependencies.',
  },
  {
    icon: <Target className="w-5 h-5" />,
    color: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
    title: 'Impact Analysis',
    description: 'Know exactly which modules are affected before you touch a single file.',
  },
  {
    icon: <Search className="w-5 h-5" />,
    color: 'text-pink-400 bg-pink-500/10 border-pink-500/20',
    title: 'Code Intelligence',
    description: 'Search files, classes, functions, and routes across the entire repository.',
  },
];

const STATS = [
  { value: '10x', label: 'Faster onboarding' },
  { value: '47+', label: 'Analysis dimensions' },
  { value: '<1s', label: 'Graph render time' },
  { value: '100%', label: 'Static, no execution' },
];

// Decorative animated graph preview (pure CSS)
function HeroGraphPreview() {
  const nodes = [
    { x: 50, y: 40, w: 80, color: '#6366f1', label: 'Frontend' },
    { x: 200, y: 40, w: 80, color: '#6366f1', label: 'Backend' },
    { x: 350, y: 40, w: 80, color: '#6366f1', label: 'Database' },
    { x: 50, y: 120, w: 70, color: '#06b6d4', label: 'components' },
    { x: 160, y: 120, w: 60, color: '#06b6d4', label: 'routes' },
    { x: 270, y: 120, w: 70, color: '#06b6d4', label: 'services' },
    { x: 380, y: 120, w: 70, color: '#06b6d4', label: 'models' },
    { x: 80, y: 200, w: 55, color: '#8b5cf6', label: 'Button.tsx' },
    { x: 190, y: 200, w: 55, color: '#8b5cf6', label: 'authRoute' },
    { x: 300, y: 200, w: 60, color: '#8b5cf6', label: 'UserService' },
  ];
  const edges = [
    [90, 56, 240, 56], [240, 56, 390, 56],
    [90, 64, 85, 120], [90, 64, 190, 120],
    [240, 64, 300, 120], [390, 64, 415, 120],
    [85, 136, 107, 200], [220, 136, 217, 200],
    [305, 136, 330, 200],
  ];

  return (
    <svg viewBox="0 0 480 240" className="w-full h-full opacity-80" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="edgeGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6366f1" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.2" />
        </linearGradient>
      </defs>

      {/* Edges */}
      {edges.map(([x1, y1, x2, y2], i) => (
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
          stroke="url(#edgeGrad)" strokeWidth="1" strokeDasharray="3,3" opacity="0.6" />
      ))}

      {/* Nodes */}
      {nodes.map(({ x, y, w, color, label }) => (
        <g key={label}>
          <rect x={x} y={y - 12} width={w} height={24} rx="6"
            fill={color} fillOpacity="0.12"
            stroke={color} strokeOpacity="0.4" strokeWidth="1" />
          <text x={x + w / 2} y={y + 4} textAnchor="middle"
            fontSize="8" fill={color} fontFamily="Inter, sans-serif" fontWeight="500">
            {label}
          </text>
        </g>
      ))}
    </svg>
  );
}

export function LandingPage() {
  return (
    <div className="min-h-screen bg-background overflow-hidden">
      {/* Navbar */}
      <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 h-14 border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-primary/10 border border-primary/30 flex items-center justify-center">
            <GitBranch className="w-3.5 h-3.5 text-primary" />
          </div>
          <span className="font-semibold text-sm gradient-text">NodeMap</span>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Dashboard
          </Link>
          <Link to="/upload">
            <Button size="sm" className="h-8 text-xs">Get Started</Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative pt-32 pb-24 px-6 flex flex-col items-center text-center overflow-hidden">
        {/* Background glow */}
        <div className="absolute inset-0 bg-hero-glow pointer-events-none" />
        <div className="absolute inset-0 bg-grid-pattern bg-grid opacity-40 pointer-events-none" />

        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-xs text-primary mb-6 animate-fade-in">
          <Shield className="w-3 h-3" />
          Static analysis — never executes your code
        </div>

        {/* Heading */}
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-none mb-6 max-w-4xl animate-fade-in">
          <span className="gradient-text">Google Maps</span>
          <br />
          <span className="text-foreground">for your codebase</span>
        </h1>

        <p className="text-lg text-muted-foreground max-w-xl mb-10 leading-relaxed animate-fade-in">
          Transform any repository into an interactive architecture map.
          Visualize dependencies, detect risks, trace API flows, and understand
          large codebases in minutes — not weeks.
        </p>

        <div className="flex items-center gap-3 animate-fade-in">
          <Link to="/upload">
            <Button size="xl" variant="glow" className="gap-2">
              Start Analyzing
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
          <Link to="/dashboard">
            <Button size="xl" variant="outline">
              View Dashboard
            </Button>
          </Link>
        </div>

        {/* Hero graph preview */}
        <div className="relative mt-20 w-full max-w-2xl animate-fade-in">
          <div className="absolute -inset-4 bg-gradient-to-b from-primary/20 via-transparent to-transparent rounded-2xl blur-2xl pointer-events-none" />
          <div className="relative glass rounded-2xl p-6 border border-primary/20 overflow-hidden">
            <div className="absolute top-3 left-3 flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-risk-critical" />
              <div className="w-2.5 h-2.5 rounded-full bg-risk-medium" />
              <div className="w-2.5 h-2.5 rounded-full bg-risk-low" />
            </div>
            <p className="text-xs text-muted-foreground text-center mb-4 font-mono">my-project — architecture map</p>
            <HeroGraphPreview />
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-12 border-y border-border/50 bg-surface/30">
        <div className="max-w-4xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8">
          {STATS.map(({ value, label }) => (
            <div key={label} className="text-center">
              <p className="text-3xl font-bold gradient-text">{value}</p>
              <p className="text-sm text-muted-foreground mt-1">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="py-24 px-6 max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-foreground mb-3">
            Everything you need to understand a codebase
          </h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            From high-level architecture to individual file dependencies — fully interactive.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map(({ icon, color, title, description }) => (
            <div key={title} className="group p-5 rounded-xl border border-border hover:border-primary/30 bg-card hover:bg-card/80 transition-all duration-200">
              <div className={`inline-flex p-2.5 rounded-lg border mb-4 ${color}`}>
                {icon}
              </div>
              <h3 className="font-semibold text-foreground mb-2">{title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 text-center border-t border-border/50">
        <div className="max-w-lg mx-auto">
          <GitMerge className="w-10 h-10 text-primary mx-auto mb-6 opacity-80" />
          <h2 className="text-3xl font-bold mb-4">Ready to map your codebase?</h2>
          <p className="text-muted-foreground mb-8">
            Upload a ZIP of your repository and get a full interactive map in seconds.
          </p>
          <Link to="/upload">
            <Button size="xl" variant="glow">
              Upload Repository <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        </div>
      </section>

      <footer className="py-6 border-t border-border/50 text-center">
        <p className="text-xs text-muted-foreground">
          NodeMap — Architecture Intelligence Platform &nbsp;·&nbsp; Static analysis only
        </p>
      </footer>
    </div>
  );
}
