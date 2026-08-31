import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Flame, Target, AlertTriangle, TrendingUp, ArrowRight, Zap } from "lucide-react";
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { DashboardLayout } from "../layouts/DashboardLayout";
import { api } from "../services/api";
import { Card, Badge, SeverityBadge, LoadingBlock, EmptyState } from "../components/ui";
import { DashboardData, DigitalTwinView } from "../types";

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [twin, setTwin] = useState<DigitalTwinView | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([api.get("/analytics/dashboard"), api.get("/digital-twin")])
      .then(([dashRes, twinRes]) => {
        setData(dashRes.data);
        setTwin(twinRes.data.twin);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading || !data || !twin) {
    return (
      <DashboardLayout title="Dashboard">
        <LoadingBlock />
      </DashboardLayout>
    );
  }

  const { summary } = data;

  return (
    <DashboardLayout title="Dashboard" subtitle={`Goal: ${summary.currentGoal}`}>
      {/* TOP SUMMARY CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <SummaryCard icon={Target} label="Skills Completed" value={`${summary.completedSkills}/${summary.totalSkills}`} />
        <SummaryCard icon={Flame} label="Active Days (14d)" value={String(summary.learningStreakDays)} />
        <SummaryCard icon={TrendingUp} label="Current Milestone" value={summary.currentMilestone} />
        <SummaryCard
          icon={AlertTriangle}
          label="Active Bottlenecks"
          value={String(summary.activeBottleneckCount)}
          tone={summary.activeBottleneckCount > 0 ? "alert" : "signal"}
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-6 mb-6">
        {/* TODAY'S LEARNING / MICRO-SESSION QUICK START */}
        {data.nextUp && (
          <Card
            title="Today's Learning"
            eyebrow="Pick up where you left off"
            action={<Zap size={16} className="text-twin" />}
            className="lg:col-span-2"
          >
            <p className="text-sm text-mist-100 font-medium mb-0.5">{data.nextUp.skillName}</p>
            <p className="text-xs text-mist-400 mb-2">~{data.nextUp.estimatedMinutes} min estimated for the whole topic</p>
            {data.nextUp.videoTitle && <p className="text-xs text-mist-300 mb-2 truncate">🎥 {data.nextUp.videoTitle}</p>}
            <div className="flex flex-wrap gap-2 mb-4">
              {data.nextUp.videoTitle && <Badge tone="twin">Video {data.nextUp.videoProgress ?? 0}% watched</Badge>}
              {data.nextUp.bestQuizScore !== null && data.nextUp.bestQuizScore !== undefined && <Badge tone={data.nextUp.bestQuizScore >= 70 ? "signal" : "alert"}>Quiz {data.nextUp.bestQuizScore}%</Badge>}
            </div>
            <p className="text-xs uppercase tracking-widest text-mist-500 font-mono mb-2">How much time do you have?</p>
            <div className="flex flex-wrap gap-2">
              {[10, 15, 20, 30, 45, 60].map((m) => (
                <button
                  key={m}
                  onClick={() => navigate(`/learning-path/${data.nextUp!.itemId}?duration=${m}`)}
                  className="px-3.5 py-2 rounded-lg text-sm font-medium bg-graphite-700 text-mist-100 border border-graphite-600 hover:border-signal-dim/50 hover:bg-graphite-600 transition-colors"
                >
                  ⚡ {m} min
                </button>
              ))}
            </div>
          </Card>
        )}

        {/* WEAK CONCEPTS */}
        <Card title="Needs Practice" eyebrow="From your recent quizzes" className={data.nextUp ? "lg:col-span-1" : "lg:col-span-3"}>
          {data.weakConcepts.length > 0 ? (
            <div className="space-y-2.5">
              {data.weakConcepts.map((w) => (
                <div key={w.concept} className="p-3 rounded-lg bg-alert-soft border border-alert/20">
                  <p className="text-sm font-medium text-mist-50">{w.concept}</p>
                  <p className="text-xs text-mist-300 mt-0.5">{w.description}</p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No weak areas detected" description="Your recent quiz performance looks solid." />
          )}
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-6 mb-6">
        {/* DIGITAL TWIN CARD */}
        <Card title="Learner Digital Twin" eyebrow="Live profile" className="lg:col-span-1">
          <div className="space-y-3 text-sm">
            <Row label="Goal" value={twin.goal} />
            <Row label="Learning style" value={twin.learningDna?.learningStyle || "—"} />
            <Row label="Consistency" value={`${twin.learningDna?.consistencyScore ?? "—"}/100`} />
            <div>
              <p className="text-mist-400 text-xs mb-1">Strengths</p>
              <div className="flex flex-wrap gap-1.5">
                {twin.strengths.map((s) => (
                  <Badge key={s} tone="signal">
                    {s}
                  </Badge>
                ))}
              </div>
            </div>
            {twin.weaknesses.length > 0 && (
              <div>
                <p className="text-mist-400 text-xs mb-1">Weaknesses</p>
                <div className="flex flex-wrap gap-1.5">
                  {twin.weaknesses.map((w) => (
                    <Badge key={w} tone="alert">
                      {w}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            <p className="text-mist-300 text-xs leading-relaxed pt-2 border-t border-graphite-600">{twin.insight}</p>
            <Link to="/digital-twin" className="text-signal text-xs inline-flex items-center gap-1 hover:underline">
              View full twin <ArrowRight size={12} />
            </Link>
          </div>
        </Card>

        {/* SKILL RADAR */}
        <Card title="Skill Map" eyebrow="Proficiency" className="lg:col-span-2">
          {data.skillRadar.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <RadarChart data={data.skillRadar} outerRadius="75%">
                <PolarGrid stroke="#28303F" />
                <PolarAngleAxis dataKey="skill" tick={{ fill: "#8B93A7", fontSize: 11 }} />
                <PolarRadiusAxis domain={[0, 100]} tick={{ fill: "#3A4356", fontSize: 9 }} />
                <Radar dataKey="proficiency" stroke="#2FE6D0" fill="#2FE6D0" fillOpacity={0.25} />
                <Tooltip contentStyle={{ background: "#151A24", border: "1px solid #28303F", borderRadius: 8 }} />
              </RadarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState title="No skills tracked yet" description="Complete an assessment to populate your skill map." />
          )}
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        {/* BOTTLENECK ALERT */}
        <Card title="Bottleneck Detection" eyebrow="Behavior analysis">
          {data.bottlenecks.length > 0 ? (
            <div className="space-y-3">
              {data.bottlenecks.slice(0, 2).map((b) => (
                <div key={b.id} className="flex items-start gap-3 p-3 rounded-lg bg-alert-soft border border-alert/20">
                  <AlertTriangle size={16} className="text-alert shrink-0 mt-0.5" />
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-medium text-mist-50">{b.type.replace(/_/g, " ")}</p>
                      <SeverityBadge severity={b.severity} />
                    </div>
                    <p className="text-xs text-mist-300">{b.description}</p>
                  </div>
                </div>
              ))}
              <Link to="/bottlenecks" className="text-signal text-xs inline-flex items-center gap-1 hover:underline">
                View full analysis <ArrowRight size={12} />
              </Link>
            </div>
          ) : (
            <EmptyState title="No bottlenecks detected" description="Your learning behavior looks healthy." />
          )}
        </Card>

        {/* PATH CORRECTION ALERT */}
        <Card title="Path Correction Alert" eyebrow="Self-correcting engine">
          {data.recentCorrections.length > 0 ? (
            <div>
              <p className="text-sm text-mist-100 mb-2 font-medium">Your learning path was updated.</p>
              <p className="text-xs text-mist-300 leading-relaxed mb-3">{data.recentCorrections[0].reason}</p>
              <Link to="/path-corrections" className="text-signal text-xs inline-flex items-center gap-1 hover:underline">
                View analysis <ArrowRight size={12} />
              </Link>
            </div>
          ) : (
            <EmptyState title="No corrections yet" description="Your path is on track — no revisions needed." />
          )}
        </Card>
      </div>

      {/* WEEKLY ACTIVITY */}
      <Card title="Weekly Learning Activity" eyebrow="Analytics">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data.weeklyActivity}>
            <XAxis dataKey="day" tick={{ fill: "#8B93A7", fontSize: 12 }} axisLine={{ stroke: "#28303F" }} tickLine={false} />
            <YAxis tick={{ fill: "#8B93A7", fontSize: 12 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background: "#151A24", border: "1px solid #28303F", borderRadius: 8 }} />
            <Bar dataKey="minutes" fill="#2FE6D0" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </DashboardLayout>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  tone = "default",
}: {
  icon: any;
  label: string;
  value: string;
  tone?: "default" | "signal" | "alert";
}) {
  const toneClass = tone === "alert" ? "text-alert" : tone === "signal" ? "text-signal" : "text-mist-200";
  return (
    <div className="bg-graphite-800/60 border border-graphite-600 rounded-xl p-4">
      <Icon size={16} className={`${toneClass} mb-3`} strokeWidth={1.8} />
      <p className="text-lg font-display font-bold text-mist-50 truncate">{value}</p>
      <p className="text-xs text-mist-400 mt-0.5">{label}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-mist-400 text-xs">{label}</span>
      <span className="text-mist-100 font-medium">{value}</span>
    </div>
  );
}
