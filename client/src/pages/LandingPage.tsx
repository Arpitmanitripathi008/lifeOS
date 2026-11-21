import { Link } from 'react-router-dom';
import {
  CalendarDays,
  GraduationCap,
  Sparkles,
  ArrowRight,
  BookOpen,
  BrainCircuit,
  Lock,
  CheckCircle2,
} from 'lucide-react';

export function LandingPage() {
  return (
    <div className="min-h-screen bg-ivory text-charcoal font-sans flex flex-col selection:bg-olive selection:text-paper">
      {/* 1. Navigation Header */}
      <header className="sticky top-0 z-50 bg-paper/90 backdrop-blur-md border-b border-border-light">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Brand Logo */}
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-olive flex items-center justify-center shadow-sm group-hover:bg-olive-dark transition-colors">
              <span className="text-paper text-base font-serif font-bold">L</span>
            </div>
            <div>
              <span className="font-serif text-lg font-bold text-charcoal tracking-tight block">
                LifeOS
              </span>
              <span className="text-[10px] font-sans font-medium text-muted uppercase tracking-wider block -mt-1">
                Student Edition
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-muted">
            <a href="#features" className="hover:text-charcoal transition-colors">
              Features
            </a>
            <a href="#intelligence" className="hover:text-charcoal transition-colors">
              Academic AI
            </a>
            <a href="#architecture" className="hover:text-charcoal transition-colors">
              Architecture
            </a>
            <a href="#demo" className="hover:text-charcoal transition-colors">
              Demo Access
            </a>
          </nav>

          {/* Action CTAs */}
          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="px-4 py-2 text-sm font-semibold text-charcoal hover:text-olive rounded-lg hover:bg-cream transition-colors"
            >
              Sign In
            </Link>
            <Link
              to="/signup"
              className="px-4 py-2 text-sm font-semibold text-paper bg-olive hover:bg-olive-dark rounded-lg shadow-sm hover:shadow transition-all"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* 2. Hero Section */}
      <main className="flex-1">
        <section className="relative pt-16 pb-20 sm:pt-24 sm:pb-28 overflow-hidden">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
            {/* Pill Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-olive-50 border border-olive-200/50 text-olive text-xs font-semibold uppercase tracking-wider mb-6 shadow-xs animate-fade-in">
              <Sparkles className="w-3.5 h-3.5" />
              <span>AI-Powered Adaptive Academic Operating System</span>
            </div>

            {/* Main Headline */}
            <h1 className="font-serif text-4xl sm:text-6xl lg:text-7xl font-bold text-charcoal tracking-tight leading-[1.1] mb-6">
              Your College Life, Study Schedule & Wellness. <br className="hidden sm:inline" />
              <span className="text-olive italic font-serif">In Perfect Harmony.</span>
            </h1>

            {/* Subtitle */}
            <p className="max-w-2xl mx-auto text-base sm:text-xl text-muted leading-relaxed mb-10">
              <strong className="text-charcoal font-semibold">LifeOS adapts to your life</strong> — you never adapt to LifeOS. Real-time conflict-free scheduling, multimodal syllabus OCR, spaced exam preparation, and private student workspaces.
            </p>

            {/* Primary Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 max-w-md mx-auto mb-14">
              <Link
                to="/login"
                className="w-full sm:w-auto px-7 py-3.5 text-base font-semibold text-paper bg-olive hover:bg-olive-dark rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 group"
              >
                <span>Launch Workspace (Sign In)</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                to="/login?demo=true"
                className="w-full sm:w-auto px-7 py-3.5 text-base font-semibold text-charcoal bg-paper hover:bg-cream border border-border rounded-xl shadow-xs hover:shadow transition-all flex items-center justify-center gap-2"
              >
                <Lock className="w-4 h-4 text-olive" />
                <span>1-Click Demo Login</span>
              </Link>
            </div>

            {/* Trust & Performance Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto text-left">
              <div className="p-4 rounded-xl bg-paper/80 border border-border-light shadow-2xs">
                <div className="text-2xl font-serif font-bold text-charcoal">98%</div>
                <div className="text-xs font-medium text-muted mt-1">Problem Alignment</div>
                <div className="text-[11px] text-muted/80 mt-0.5">Real university syllabus intelligence</div>
              </div>
              <div className="p-4 rounded-xl bg-paper/80 border border-border-light shadow-2xs">
                <div className="text-2xl font-serif font-bold text-olive">0 Overlaps</div>
                <div className="text-xs font-medium text-muted mt-1">Conflict-Free Math</div>
                <div className="text-[11px] text-muted/80 mt-0.5">Guaranteed deterministic engine</div>
              </div>
              <div className="p-4 rounded-xl bg-paper/80 border border-border-light shadow-2xs">
                <div className="text-2xl font-serif font-bold text-charcoal">100% Isolated</div>
                <div className="text-xs font-medium text-muted mt-1">Multi-Tenancy Security</div>
                <div className="text-[11px] text-muted/80 mt-0.5">Encrypted private student workspaces</div>
              </div>
              <div className="p-4 rounded-xl bg-paper/80 border border-border-light shadow-2xs">
                <div className="text-2xl font-serif font-bold text-accent-rust">Real-Time</div>
                <div className="text-xs font-medium text-muted mt-1">Local Clock Cursor</div>
                <div className="text-[11px] text-muted/80 mt-0.5">Zero phantom past tasks</div>
              </div>
            </div>
          </div>
        </section>

        {/* 3. Core Features Section */}
        <section id="features" className="py-20 bg-paper border-y border-border-light">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <h2 className="font-serif text-3xl sm:text-4xl font-bold text-charcoal mb-4">
                Engineered for Academic Excellence
              </h2>
              <p className="text-muted text-base">
                Everything college students need to stay on top of classes, coursework, and personal habits without burnout.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Feature 1 */}
              <div className="p-6 rounded-2xl bg-ivory/60 border border-border-light hover:border-olive/30 transition-all shadow-xs flex flex-col">
                <div className="w-12 h-12 rounded-xl bg-olive-100/70 text-olive flex items-center justify-center mb-5">
                  <CalendarDays className="w-6 h-6" />
                </div>
                <h3 className="font-serif text-xl font-bold text-charcoal mb-2">
                  Deterministic Adaptive Scheduler
                </h3>
                <p className="text-muted text-sm leading-relaxed mb-4 flex-1">
                  Mathematically guarantees zero overlapping slots. Respects college lectures, mandatory meal buffers (Breakfast, Lunch, Dinner), and automatically prevents tasks in past morning hours.
                </p>
                <div className="text-xs font-medium text-olive flex items-center gap-1.5 pt-3 border-t border-border-light">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Clock-aware real-time cursor</span>
                </div>
              </div>

              {/* Feature 2 */}
              <div className="p-6 rounded-2xl bg-ivory/60 border border-border-light hover:border-olive/30 transition-all shadow-xs flex flex-col">
                <div className="w-12 h-12 rounded-xl bg-olive-100/70 text-olive flex items-center justify-center mb-5">
                  <BrainCircuit className="w-6 h-6" />
                </div>
                <h3 className="font-serif text-xl font-bold text-charcoal mb-2">
                  Multimodal Academic OCR
                </h3>
                <p className="text-muted text-sm leading-relaxed mb-4 flex-1">
                  Upload official exam timetables or multi-unit course syllabi (PDF, Word, or camera photos). Gemini extracts subjects, units, topics, and automatically merges equivalent Roman numeral subjects.
                </p>
                <div className="text-xs font-medium text-olive flex items-center gap-1.5 pt-3 border-t border-border-light">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Smart deduplication & code matching</span>
                </div>
              </div>

              {/* Feature 3 */}
              <div className="p-6 rounded-2xl bg-ivory/60 border border-border-light hover:border-olive/30 transition-all shadow-xs flex flex-col">
                <div className="w-12 h-12 rounded-xl bg-olive-100/70 text-olive flex items-center justify-center mb-5">
                  <BookOpen className="w-6 h-6" />
                </div>
                <h3 className="font-serif text-xl font-bold text-charcoal mb-2">
                  Integrated Assignments Hub
                </h3>
                <p className="text-muted text-sm leading-relaxed mb-4 flex-1">
                  Dedicated coursework management with subject tagging, urgency countdowns, and 1-click schedule planning. Push high-priority assignment work directly into your daily timeline.
                </p>
                <div className="text-xs font-medium text-olive flex items-center gap-1.5 pt-3 border-t border-border-light">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Deadline tracking & 1-click planner</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 4. Live Demo Access Section */}
        <section id="demo" className="py-20 bg-ivory">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="p-8 sm:p-12 rounded-3xl bg-paper border border-border shadow-sm text-center">
              <div className="w-14 h-14 rounded-2xl bg-olive text-paper flex items-center justify-center mx-auto mb-6 shadow-md">
                <GraduationCap className="w-7 h-7" />
              </div>
              <h2 className="font-serif text-3xl font-bold text-charcoal mb-3">
                Ready to Experience LifeOS?
              </h2>
              <p className="text-muted text-base max-w-xl mx-auto mb-8">
                Sign in with the pre-seeded demo student account to explore the full suite of adaptive scheduling, syllabus mastery, and daily reviews.
              </p>

              {/* Demo Account Box */}
              <div className="inline-block p-4 sm:p-6 rounded-2xl bg-ivory border border-border-light max-w-md w-full mb-8 text-left">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted mb-3 flex items-center justify-between">
                  <span>Demo Evaluator Credentials</span>
                  <span className="text-[10px] bg-olive-100 text-olive px-2 py-0.5 rounded font-mono">1-Click Ready</span>
                </div>
                <div className="space-y-2 text-sm font-mono">
                  <div className="flex justify-between items-center py-1 border-b border-border-light">
                    <span className="text-muted">Username:</span>
                    <span className="font-bold text-charcoal">alex_rivera</span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-muted">Password:</span>
                    <span className="font-bold text-charcoal">password123</span>
                  </div>
                </div>
              </div>

              <div>
                <Link
                  to="/login?demo=true"
                  className="inline-flex items-center gap-2 px-8 py-3.5 text-base font-semibold text-paper bg-olive hover:bg-olive-dark rounded-xl shadow-md hover:shadow-lg transition-all"
                >
                  <span>Launch Demo Workspace</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* 5. Footer */}
      <footer className="bg-paper border-t border-border-light py-8 text-center text-xs text-muted">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-serif font-bold text-charcoal">LifeOS</span>
            <span>• Student Edition</span>
          </div>
          <div className="text-muted">
            Built for Hack2Skill PromptWar Competition • 100% Privacy & Isolated Workspaces
          </div>
          <div className="flex items-center gap-4">
            <Link to="/login" className="hover:text-charcoal transition-colors">
              Sign In
            </Link>
            <Link to="/signup" className="hover:text-charcoal transition-colors">
              Sign Up
            </Link>
            <a
              href="https://github.com/Arpitmanitripathi008/lifeOS"
              target="_blank"
              rel="noreferrer"
              className="hover:text-charcoal transition-colors"
            >
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
export default LandingPage;
