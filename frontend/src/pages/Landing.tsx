import { Link } from "react-router-dom";
import { ArrowRight, GitBranch, Fingerprint, AlertTriangle, RefreshCw, BarChart3 } from "lucide-react";

const FLOW_STEPS = ["Learner", "Digital Twin", "Learning Path", "Feedback", "Adaptation"];

export default function Landing() {
  return (
    <div className="min-h-screen bg-graphite-950 text-mist-100">
      <header className="max-w-6xl mx-auto px-8 py-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-signal/15 border border-signal-dim/40 flex items-center justify-center">
            <span className="font-display font-bold text-signal text-sm">Lt</span>
          </div>
          <span className="font-display font-bold text-mist-50 tracking-tight">LearnTwin</span>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/login" className="text-sm text-mist-300 hover:text-mist-50 transition-colors px-3 py-2">
            Log in
          </Link>
          <Link
            to="/signup"
            className="text-sm font-medium bg-signal text-graphite-950 px-4 py-2 rounded-lg hover:bg-signal-dim transition-colors"
          >
            Get started
          </Link>
        </div>
      </header>

      {/* HERO */}
      <section className="max-w-5xl mx-auto px-8 pt-16 pb-24 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-graphite-600 text-xs font-mono text-mist-300 mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-signal animate-pulse" />
          Self-correcting learning, live
        </div>
        <h1 className="font-display text-5xl md:text-6xl font-bold tracking-tight text-mist-50 leading-[1.05]">
          Your learning path
          <br />
          should learn <span className="text-signal">from you.</span>
        </h1>
        <p className="mt-6 text-lg text-mist-300 max-w-2xl mx-auto">
          LearnTwin builds a living Digital Twin of how you actually learn — not what you say you prefer —
          finds the real root cause when you get stuck, and rewrites your roadmap before you waste another week
          on the wrong topic.
        </p>
        <div className="mt-10 flex items-center justify-center gap-4">
          <Link
            to="/signup"
            className="inline-flex items-center gap-2 bg-signal text-graphite-950 px-6 py-3 rounded-lg font-medium hover:bg-signal-dim transition-colors"
          >
            Build my Digital Twin <ArrowRight size={16} />
          </Link>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 text-mist-200 px-6 py-3 rounded-lg font-medium border border-graphite-600 hover:bg-graphite-800 transition-colors"
          >
            See the demo account
          </Link>
        </div>

        {/* signature flow diagram */}
        <div className="mt-20 flex items-center justify-center gap-1 md:gap-3 flex-wrap">
          {FLOW_STEPS.map((step, idx) => (
            <div key={step} className="flex items-center gap-1 md:gap-3">
              <div className="px-4 py-2.5 rounded-lg bg-graphite-800 border border-graphite-600 text-sm font-mono text-mist-200">
                {step}
              </div>
              {idx < FLOW_STEPS.length - 1 && <ArrowRight size={16} className="text-mist-500" />}
            </div>
          ))}
        </div>
      </section>

      {/* PROBLEM */}
      <section className="border-t border-graphite-700 bg-graphite-900/40">
        <div className="max-w-5xl mx-auto px-8 py-20">
          <p className="text-xs font-mono uppercase tracking-widest text-mist-400 mb-3">The problem</p>
          <h2 className="font-display text-3xl font-bold text-mist-50 max-w-2xl">
            Generic roadmaps assume everyone learns the same way.
          </h2>
          <p className="text-mist-300 mt-4 max-w-2xl">
            A learner can finish 30 videos and solve zero problems. Fail an advanced topic because a
            foundational concept never stuck. Traditional platforms track completion — not comprehension.
          </p>
        </div>
      </section>

      {/* MODULES */}
      <section className="max-w-6xl mx-auto px-8 py-20">
        <p className="text-xs font-mono uppercase tracking-widest text-mist-400 mb-3">How it works</p>
        <h2 className="font-display text-3xl font-bold text-mist-50 mb-12 max-w-2xl">
          Four engines, one continuously updating twin.
        </h2>
        <div className="grid md:grid-cols-2 gap-5">
          <FeatureCard
            icon={Fingerprint}
            title="Dynamic Learner Digital Twin"
            body="A living profile of your goals, skills, behavior, and consistency — updated after every course, quiz, and practice session."
          />
          <FeatureCard
            icon={AlertTriangle}
            title="Failure-Aware Learning Engine"
            body="Instead of just marking a topic FAILED, LearnTwin walks the skill dependency graph to find the real root cause."
          />
          <FeatureCard
            icon={GitBranch}
            title="Self-Correcting Path"
            body="When a foundational gap is detected, your roadmap is rewritten automatically — with a plain-language explanation of why."
          />
          <FeatureCard
            icon={BarChart3}
            title="Bottleneck Detection"
            body="Passive learning, theory/practice imbalance, inconsistency, and difficulty mismatch are all caught before they compound."
          />
        </div>
      </section>

      {/* BEFORE/AFTER */}
      <section className="border-t border-graphite-700 bg-graphite-900/40">
        <div className="max-w-5xl mx-auto px-8 py-20">
          <p className="text-xs font-mono uppercase tracking-widest text-mist-400 mb-3">Self-correction in action</p>
          <h2 className="font-display text-3xl font-bold text-mist-50 mb-10">See the before and after.</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-graphite-800 border border-graphite-600 rounded-xl p-6">
              <p className="text-xs font-mono text-mist-400 mb-4">ORIGINAL PATH</p>
              <PathList items={["Promises", "Async/Await", "React API"]} />
            </div>
            <div className="bg-graphite-800 border border-signal-dim/40 rounded-xl p-6 relative">
              <div className="absolute -top-3 left-6 bg-signal text-graphite-950 text-[11px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                <RefreshCw size={11} /> AI-Adapted
              </div>
              <p className="text-xs font-mono text-mist-400 mb-4">CORRECTED PATH</p>
              <PathList items={["Callbacks Revision", "Callback Practice", "Promises", "Async/Await", "React API"]} highlight={2} />
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-5xl mx-auto px-8 py-24 text-center">
        <h2 className="font-display text-3xl font-bold text-mist-50 mb-4">Stop following a roadmap that doesn't know you.</h2>
        <Link
          to="/signup"
          className="inline-flex items-center gap-2 bg-signal text-graphite-950 px-6 py-3 rounded-lg font-medium hover:bg-signal-dim transition-colors mt-4"
        >
          Create your Digital Twin <ArrowRight size={16} />
        </Link>
      </section>

      <footer className="border-t border-graphite-700 py-8 text-center text-xs text-mist-500 font-mono">
        LearnTwin — built for HCL Amplified Hackathon
      </footer>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, body }: { icon: any; title: string; body: string }) {
  return (
    <div className="bg-graphite-800/60 border border-graphite-600 rounded-xl p-6">
      <div className="w-10 h-10 rounded-lg bg-signal-soft flex items-center justify-center mb-4">
        <Icon size={18} className="text-signal" strokeWidth={1.8} />
      </div>
      <h3 className="font-display font-semibold text-mist-50 mb-2">{title}</h3>
      <p className="text-sm text-mist-300 leading-relaxed">{body}</p>
    </div>
  );
}

function PathList({ items, highlight }: { items: string[]; highlight?: number }) {
  return (
    <ol className="space-y-2">
      {items.map((item, idx) => (
        <li
          key={item}
          className={`text-sm px-3 py-2 rounded-lg font-mono ${
            idx === highlight ? "bg-signal-soft text-signal border border-signal-dim/40" : "bg-graphite-700/60 text-mist-200"
          }`}
        >
          {item}
        </li>
      ))}
    </ol>
  );
}
