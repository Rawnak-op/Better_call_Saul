import { Scale, MessageSquare, Plus, Trash2, Clock, LogIn, LogOut, User, Compass, ShieldAlert, FileText, Camera, HelpCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const QUICK_PLAYBOOKS = [
  {
    icon: '🛡️',
    title: 'Police Summons / Sec 41A',
    desc: 'What to do when called to the police station',
    prompt: 'I received a call/summons from the police to appear at the station under Section 41A. How do I protect myself from arbitrary arrest and what are my legal rights?',
  },
  {
    icon: '⚖️',
    title: 'Anticipatory Bail Roadmap',
    desc: 'Pre-arrest protection grounds & process',
    prompt: 'I fear someone is going to file a false FIR against me. Explain the step-by-step roadmap to secure Anticipatory Bail before the Sessions Court or High Court.',
  },
  {
    icon: '📱',
    title: 'Electronic Evidence (Sec 65B)',
    desc: 'Admissibility of WhatsApp & CCTV',
    prompt: 'I have WhatsApp chats, call recordings, and photos as proof. How do I make electronic evidence legally admissible in court under Section 65B of the Evidence Act / BSA?',
  },
  {
    icon: '🤝',
    title: 'Compounding & FIR Quashing',
    desc: 'Settling disputes & Section 482 petitions',
    prompt: 'Can this criminal offense be settled out of court? Explain the procedure for compounding under Section 320 or filing an FIR quashing petition before the High Court.',
  },
];

export default function Sidebar({
  sessions = [],
  activeSessionId,
  onSelectSession,
  onNewSession,
  onDeleteSession,
  onSelectPlaybook,
}) {
  const { user, isAuthenticated, isGuest, setIsAuthModalOpen, logout } = useAuth();

  return (
    <aside className="flex flex-col h-full bg-dark-surface border-r border-white/5 w-full overflow-hidden">
      {/* ── Branding ───────────────────────────────────────── */}
      <div className="flex-shrink-0 px-5 py-5 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl overflow-hidden border border-gold/40 shadow-lg shadow-gold/15 flex-shrink-0 bg-dark">
            <img src="/saul-avatar.jpg" alt="Saul Goodman" className="w-full h-full object-cover" />
          </div>
          <div>
            <h2 className="text-xl font-black text-gold tracking-widest leading-none">SAUL</h2>
            <p className="text-[11px] text-slate-400 mt-0.5 tracking-wide">CRIMINAL DEFENSE STRATEGIST</p>
          </div>
        </div>
      </div>

      {/* ── User Status / Sign In Pill ─────────────────────── */}
      <div className="px-4 pt-3.5 pb-1">
        {isAuthenticated && !isGuest ? (
          <div className="flex items-center justify-between p-2 rounded-xl bg-dark-card border border-white/10 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              {user.avatar ? (
                <img src={user.avatar} alt="Profile" className="w-7 h-7 rounded-full object-cover border border-gold/40" />
              ) : (
                <div className="w-7 h-7 rounded-full bg-gold/20 text-gold flex items-center justify-center font-bold text-xs">
                  {user.name?.[0]?.toUpperCase() || 'U'}
                </div>
              )}
              <div className="min-w-0">
                <p className="font-semibold text-slate-200 truncate">{user.name}</p>
                <p className="text-[10px] text-slate-500 truncate">{user.email || 'Verified Client'}</p>
              </div>
            </div>
            <button
              onClick={logout}
              className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-white/5 transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between p-2 rounded-xl bg-gold/5 border border-gold/20 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center">
                <User className="w-3.5 h-3.5" />
              </div>
              <div>
                <p className="font-medium text-slate-300">Guest Client</p>
                <p className="text-[10px] text-slate-500">Unsaved sessions</p>
              </div>
            </div>
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="flex items-center gap-1 px-2.5 py-1 bg-gold hover:bg-gold-light text-dark font-bold text-[11px] rounded-lg transition-all shadow-sm"
            >
              <LogIn className="w-3 h-3" />
              <span>Sign In</span>
            </button>
          </div>
        )}
      </div>

      {/* ── New Consultation Action Button ─────────────────── */}
      <div className="px-4 py-2">
        <button
          onClick={onNewSession}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gold/15 hover:bg-gold/25 border border-gold/30 hover:border-gold/50 text-gold text-xs font-semibold rounded-xl transition-all shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>New Consultation</span>
        </button>
      </div>

      {/* ── Scrollable Body ────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-5">
        {/* Section 1: Recent Consultations */}
        <section>
          <div className="flex items-center gap-2 mb-2 px-1">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
              Recent Consultations
            </h3>
          </div>

          {sessions.length === 0 ? (
            <div className="px-3 py-3 text-center border border-dashed border-white/5 rounded-xl">
              <p className="text-xs text-slate-500">No active cases</p>
              <p className="text-[10px] text-slate-600 mt-0.5">Start a chat or select a strategy below</p>
            </div>
          ) : (
            <div className="space-y-1">
              {sessions.map((sess) => {
                const isActive = sess.id === activeSessionId;
                return (
                  <div
                    key={sess.id}
                    className={`group flex items-center justify-between px-3 py-2.5 rounded-xl text-xs transition-all cursor-pointer ${
                      isActive
                        ? 'bg-gold/15 text-gold border border-gold/30 font-medium'
                        : 'text-slate-300 hover:bg-white/5 border border-transparent'
                    }`}
                    onClick={() => onSelectSession(sess.id)}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <MessageSquare className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? 'text-gold' : 'text-slate-500'}`} />
                      <span className="truncate">{sess.title || 'Legal Consultation'}</span>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteSession(sess.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-rose-400 rounded transition-all ml-1"
                      title="Delete consultation"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Section 2: Defense Playbooks (1-Click Tactical Legal Guides) */}
        <section className="pt-2 border-t border-white/5">
          <div className="flex items-center gap-2 mb-2 px-1">
            <Compass className="w-3.5 h-3.5 text-gold" />
            <h3 className="text-[11px] font-semibold text-slate-300 uppercase tracking-widest">
              Defense Playbooks
            </h3>
          </div>

          <div className="space-y-2">
            {QUICK_PLAYBOOKS.map((pb, idx) => (
              <button
                key={idx}
                onClick={() => onSelectPlaybook?.(pb.prompt)}
                className="w-full text-left p-2.5 rounded-xl bg-dark-card/60 hover:bg-dark-card border border-white/5 hover:border-gold/30 transition-all group"
              >
                <div className="flex items-start gap-2.5">
                  <span className="text-base flex-shrink-0 mt-0.5">{pb.icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-slate-200 group-hover:text-gold transition-colors">
                      {pb.title}
                    </p>
                    <p className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">
                      {pb.desc}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* Section 3: Evidence Submission Tips */}
        <section className="pt-2 border-t border-white/5">
          <div className="p-3 rounded-2xl bg-gold/5 border border-gold/20">
            <div className="flex items-center gap-2 text-gold text-xs font-bold mb-1.5">
              <Camera className="w-3.5 h-3.5" />
              <span>Evidence Analysis Mode</span>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              Attach or paste (Ctrl+V) photos of FIR copies, notices, or WhatsApp chats for forensic legal analysis.
            </p>
          </div>
        </section>
      </div>

      {/* ── Footer Disclaimer ──────────────────────────────── */}
      <div className="flex-shrink-0 px-5 py-4 border-t border-white/5 bg-dark/30">
        <p className="text-[10px] text-slate-600 leading-relaxed text-center mb-2">
          ⚖️ For informational purposes only.
          <br />
          Not a substitute for professional legal advice.
        </p>
        <p className="text-[10px] text-slate-500/80 font-medium text-center">
          &copy; {new Date().getFullYear()} Rawnak Yadav
        </p>
      </div>
    </aside>
  );
}
