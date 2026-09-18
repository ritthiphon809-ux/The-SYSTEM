import React, { useState, useEffect } from 'react';
import { Shield, Sparkles, User, Target, MessageSquare, ArrowRight, CheckCircle2, QrCode, ExternalLink, Activity } from 'lucide-react';
import { playUiClick, playLevelUpSound, triggerHaptic } from '../utils/audio.ts';

interface HunterOnboardingModalProps {
  isOpen: boolean;
  onCompleteOnboarding: (profile: {
    displayName: string;
    fitnessGoal: 'FAT_LOSS' | 'MUSCLE_GAIN' | 'ENDURANCE' | 'SOLO_LEVELING';
    weightKg?: number;
    heightCm?: number;
    lineUserId?: string;
    lineDisplayName?: string;
    linePictureUrl?: string;
  }) => void;
  initialLineUser?: {
    userId: string;
    displayName: string;
    pictureUrl?: string;
  };
  lineOaBasicId?: string;
  lineLoginConfigured?: boolean;
}

export function HunterOnboardingModal({
  isOpen,
  onCompleteOnboarding,
  initialLineUser,
  lineOaBasicId,
  lineLoginConfigured
}: HunterOnboardingModalProps) {
  const [step, setStep] = useState<'AWAKENING' | 'LINE_CONNECT' | 'REGISTRATION'>('AWAKENING');
  const [displayName, setDisplayName] = useState(initialLineUser?.displayName || '');
  const [fitnessGoal, setFitnessGoal] = useState<'FAT_LOSS' | 'MUSCLE_GAIN' | 'ENDURANCE' | 'SOLO_LEVELING'>('SOLO_LEVELING');
  const [weightKg, setWeightKg] = useState<string>('70');
  const [heightCm, setHeightCm] = useState<string>('175');
  const [lineConnected, setLineConnected] = useState<boolean>(Boolean(initialLineUser?.userId));
  const [lineUserId, setLineUserId] = useState<string>(initialLineUser?.userId || '');
  const [lineDisplayName, setLineDisplayName] = useState<string>(initialLineUser?.displayName || '');
  const [linePictureUrl, setLinePictureUrl] = useState<string>(initialLineUser?.pictureUrl || '');
  const [isLoadingAuth, setIsLoadingAuth] = useState(false);

  useEffect(() => {
    if (initialLineUser?.userId) {
      setLineUserId(initialLineUser.userId);
      setLineDisplayName(initialLineUser.displayName);
      setLinePictureUrl(initialLineUser.pictureUrl || '');
      setDisplayName(initialLineUser.displayName);
      setLineConnected(true);
      setStep('REGISTRATION');
    }
  }, [initialLineUser]);

  if (!isOpen) return null;

  const handleStartLineLogin = async () => {
    playUiClick();
    setIsLoadingAuth(true);
    try {
      const res = await fetch('/api/auth/line/login-url');
      const data = await res.json();
      if (data.available && data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        // Fallback: Simulation/Manual input if credentials not yet configured
        const simulatedId = `U${Math.random().toString(36).substring(2, 10)}${Date.now()}`;
        setLineUserId(simulatedId);
        setLineDisplayName(displayName || 'NEW HUNTER');
        setLineConnected(true);
        setStep('REGISTRATION');
      }
    } catch {
      const simulatedId = `U${Math.random().toString(36).substring(2, 10)}${Date.now()}`;
      setLineUserId(simulatedId);
      setLineConnected(true);
      setStep('REGISTRATION');
    } finally {
      setIsLoadingAuth(false);
    }
  };

  const handleSubmitProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) return;

    playLevelUpSound();
    triggerHaptic('success');

    onCompleteOnboarding({
      displayName: displayName.trim(),
      fitnessGoal,
      weightKg: weightKg ? parseFloat(weightKg) : undefined,
      heightCm: heightCm ? parseFloat(heightCm) : undefined,
      lineUserId: lineUserId || undefined,
      lineDisplayName: lineDisplayName || undefined,
      linePictureUrl: linePictureUrl || undefined
    });
  };

  const lineOaUrl = lineOaBasicId
    ? `https://line.me/R/ti/p/${lineOaBasicId.startsWith('@') ? lineOaBasicId : `@${lineOaBasicId}`}`
    : 'https://line.me/R/ti/p/@thesystem';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in font-mono-system">
      <div className="w-full max-w-lg bg-[#060a14] border-2 border-cyan-500/90 rounded-sm shadow-[0_0_60px_rgba(56,189,248,0.3)] overflow-hidden system-bracket relative">
        {/* Top Header */}
        <div className="p-4 bg-slate-950 border-b border-cyan-950 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping"></span>
            <span className="text-xs font-bold tracking-widest text-cyan-300 uppercase">
              THE SYSTEM // AWAKENING PROTOCOL
            </span>
          </div>
          <span className="text-[10px] text-slate-500">INITIATION ID: {lineUserId ? lineUserId.slice(0, 8) : 'ANONYMOUS'}</span>
        </div>

        {/* Content Stages */}
        <div className="p-6 space-y-6">
          {step === 'AWAKENING' && (
            <div className="space-y-5 text-center">
              <div className="w-16 h-16 mx-auto rounded-full bg-cyan-950/60 border-2 border-cyan-400 flex items-center justify-center shadow-[0_0_30px_rgba(56,189,248,0.4)]">
                <Shield className="w-8 h-8 text-cyan-300" />
              </div>

              <div className="space-y-2">
                <div className="text-[11px] text-cyan-400 tracking-widest uppercase">
                  [SYSTEM DIRECTIVE: RE-AWAKENING DETECTED]
                </div>
                <h2 className="text-xl font-sans font-black text-white tracking-wide">
                  ยินดีต้อนรับสู่ THE SYSTEM
                </h2>
                <p className="text-xs text-slate-300 leading-relaxed font-sans max-w-md mx-auto">
                  คุณได้รับคัดเลือกให้เป็น <strong>ผู้เล่น (Player)</strong> ภายใต้ระบบฝึกฝนการยกระดับสมรรถภาพร่างกาย
                  โปรดเชื่อมต่อบัญชี LINE เพื่อรับการแจ้งเตือนเควสต์ประจำวัน และลงทะเบียนโปรไฟล์ฮันเตอร์
                </p>
              </div>

              <div className="p-4 bg-slate-950/90 border border-cyan-950 rounded-sm text-left space-y-2">
                <div className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider">
                  ทำไมต้องเชื่อมต่อ LINE และแอด OFFICIAL ACCOUNT?
                </div>
                <ul className="text-xs text-slate-300 space-y-1.5 font-sans">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>07:00 น.</strong> ระบบส่ง Daily Quest ตรงเข้าแชท LINE ส่วนตัว</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>08:00 น.</strong> รายงานความพร้อมและสุขภาพร่างกายประจำวัน (Health Briefing)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>20:00 น.</strong> ระบบแจ้งเตือนเส้นตายก่อนถูกปรับเข้า Penalty Zone</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>สามารถพิมพ์คำสั่งใน LINE เพื่ออัปเดตหรือสำเร็จภารกิจได้ทันที</span>
                  </li>
                </ul>
              </div>

              <button
                onClick={() => {
                  playUiClick();
                  setStep('LINE_CONNECT');
                }}
                className="w-full py-3.5 rounded bg-cyan-500 hover:bg-cyan-400 text-black font-black text-xs tracking-wider flex items-center justify-center gap-2 shadow-[0_0_25px_rgba(56,189,248,0.4)] transition-all active:scale-98"
              >
                <span>เริ่มการเชื่อมต่อระบบ (INITIATE CONNECTION)</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {step === 'LINE_CONNECT' && (
            <div className="space-y-5">
              <div className="text-center space-y-1">
                <div className="text-[10px] text-emerald-400 tracking-wider uppercase">
                  STEP 1 // LINE INTEGRATION LINK
                </div>
                <h3 className="text-lg font-sans font-bold text-white">
                  เชื่อมต่อ LINE Official Account
                </h3>
                <p className="text-xs text-slate-400 font-sans">
                  ล็อกอินด้วย LINE และเพิ่มบอทเป็นเพื่อนเพื่อเปิดใช้งานระบบการแจ้งเตือน
                </p>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                {/* Official LINE Login Button */}
                <button
                  type="button"
                  onClick={handleStartLineLogin}
                  disabled={isLoadingAuth}
                  className="w-full py-3.5 px-4 rounded bg-[#06C755] hover:bg-[#05b34c] text-white font-bold text-xs tracking-wider flex items-center justify-center gap-2.5 transition-all shadow-[0_0_20px_rgba(6,199,85,0.3)] disabled:opacity-50"
                >
                  <MessageSquare className="w-4 h-4 fill-white" />
                  <span>
                    {isLoadingAuth ? 'กำลังเชื่อมต่อ LINE...' : 'เข้าสู่ระบบด้วย LINE (LINE LOGIN)'}
                  </span>
                </button>

                {/* Add Friend Official Account Button */}
                <a
                  href={lineOaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => playUiClick()}
                  className="w-full py-3 px-4 rounded bg-slate-900 hover:bg-slate-800 border border-emerald-500/40 text-emerald-300 font-bold text-xs flex items-center justify-center gap-2 transition-all"
                >
                  <QrCode className="w-4 h-4 text-emerald-400" />
                  <span>เพิ่ม THE SYSTEM Official Account เป็นเพื่อน</span>
                  <ExternalLink className="w-3 h-3 ml-1 text-slate-500" />
                </a>
              </div>

              {/* Status or Manual Bypass for development/testing */}
              <div className="p-3 bg-slate-950/80 border border-slate-800 rounded text-center space-y-2">
                <div className="text-[11px] text-slate-400 font-sans">
                  หรือต้องการลงทะเบียนฮันเตอร์โดยตรงก่อนเชื่อมต่อ LINE ภายหลัง?
                </div>
                <button
                  type="button"
                  onClick={() => {
                    playUiClick();
                    setStep('REGISTRATION');
                  }}
                  className="text-xs text-cyan-400 hover:text-cyan-300 underline font-bold"
                >
                  ดำเนินการสร้างโปรไฟล์ฮันเตอร์ทันที &gt;&gt;
                </button>
              </div>
            </div>
          )}

          {step === 'REGISTRATION' && (
            <form onSubmit={handleSubmitProfile} className="space-y-4">
              <div className="text-center space-y-1 mb-2">
                <div className="text-[10px] text-cyan-400 tracking-wider uppercase">
                  STEP 2 // HUNTER REGISTRATION
                </div>
                <h3 className="text-lg font-sans font-bold text-white">
                  สร้างโปรไฟล์ฮันเตอร์ (HUNTER PROFILE)
                </h3>
                <p className="text-xs text-slate-400 font-sans">
                  กำหนดข้อมูลชีวภาพเพื่อการคำนวณภารกิจและเป้าหมายที่แม่นยำ
                </p>
              </div>

              {/* Line Status Tag */}
              <div className="p-2.5 bg-slate-950 border border-cyan-950 rounded flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${lineConnected ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
                  <span className="text-slate-300">
                    LINE STATUS: {lineConnected ? (lineDisplayName || 'CONNECTED') : 'NOT LINKED'}
                  </span>
                </div>
                {lineConnected ? (
                  <span className="text-[10px] text-emerald-400 font-bold">[SYNCED]</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setStep('LINE_CONNECT')}
                    className="text-[10px] text-cyan-400 hover:underline"
                  >
                    เชื่อมต่อ LINE
                  </button>
                )}
              </div>

              {/* Codename */}
              <div className="space-y-1">
                <label className="text-[11px] text-slate-300 font-bold flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-cyan-400" />
                  <span>ชื่อฮันเตอร์ (CODENAME) *</span>
                </label>
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="เช่น SUNG JIN-WOO / HUNTER 01"
                  className="w-full px-3 py-2 bg-slate-950 border border-cyan-950 focus:border-cyan-400 text-cyan-200 text-sm rounded outline-none font-bold tracking-wide"
                />
              </div>

              {/* Fitness Goal */}
              <div className="space-y-1">
                <label className="text-[11px] text-slate-300 font-bold flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5 text-cyan-400" />
                  <span>เป้าหมายการฝึกฝนหลัก (TRAINING PROTOCOL)</span>
                </label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {[
                    { id: 'SOLO_LEVELING', label: 'สมดุลรอบด้าน (SOLO LEVELING)', desc: 'STR + AGI + VIT' },
                    { id: 'FAT_LOSS', label: 'เผาผลาญไขมัน (FAT LOSS)', desc: 'เน้น AGI & คาร์ดิโอ' },
                    { id: 'MUSCLE_GAIN', label: 'สร้างกล้ามเนื้อ (HYPERTROPHY)', desc: 'เน้น STR & บอดี้เวท' },
                    { id: 'ENDURANCE', label: 'ความอึดทนทาน (ENDURANCE)', desc: 'เน้น VIT & สเตมินา' }
                  ].map((goal) => (
                    <button
                      key={goal.id}
                      type="button"
                      onClick={() => {
                        playUiClick();
                        setFitnessGoal(goal.id as any);
                      }}
                      className={`p-2 rounded border text-left transition-all ${
                        fitnessGoal === goal.id
                          ? 'bg-cyan-950/90 border-cyan-400 text-cyan-300 shadow-[0_0_10px_rgba(56,189,248,0.2)]'
                          : 'bg-slate-950 border-slate-900 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <div className="font-bold text-[11px]">{goal.label}</div>
                      <div className="text-[9px] text-slate-500 mt-0.5">{goal.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Physical Metrics */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400">น้ำหนัก (KG)</label>
                  <input
                    type="number"
                    min="30"
                    max="250"
                    value={weightKg}
                    onChange={(e) => setWeightKg(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 text-slate-200 text-sm rounded outline-none focus:border-cyan-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400">ส่วนสูง (CM)</label>
                  <input
                    type="number"
                    min="100"
                    max="250"
                    value={heightCm}
                    onChange={(e) => setHeightCm(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 text-slate-200 text-sm rounded outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                className="w-full py-3.5 bg-cyan-500 hover:bg-cyan-400 text-black font-black text-xs tracking-wider rounded flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(56,189,248,0.4)] transition-all active:scale-98"
              >
                <span>ยืนยันการลงทะเบียน // AWAKEN AS RANK E HUNTER</span>
                <CheckCircle2 className="w-4 h-4" />
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
