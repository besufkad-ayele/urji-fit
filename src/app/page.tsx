'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Dumbbell,
  Flame,
  Timer,
  Moon,
  Droplets,
  TrendingUp,
  ShieldCheck,
  CheckCircle2,
  ChevronDown,
  ArrowRight,
  Sparkles,
  Zap,
  Target,
  Award,
  Clock,
  HeartHandshake,
  Smartphone,
  Star,
  X,
  Send,
  Sliders,
  Calendar,
  Lock,
  Play,
  Check,
} from 'lucide-react';

export default function LandingPage() {
  // Interactive state
  const [activeAudience, setActiveAudience] = useState<'hypertrophy' | 'fatloss' | 'busy'>('hypertrophy');
  const [activeFeature, setActiveFeature] = useState<'overload' | 'nutrition' | 'fasting' | 'sleep'>('overload');
  const [activeDay, setActiveDay] = useState<number>(0);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [leadEmail, setLeadEmail] = useState('');
  const [leadSubmitted, setLeadSubmitted] = useState(false);

  // Auto-scrollable promotion buttons state
  const [activePromoIndex, setActivePromoIndex] = useState(0);

  // Multi-image hero athlete showcase state
  const [activeAthleteIndex, setActiveAthleteIndex] = useState(0);

  const heroAthletes = [
    {
      id: 'montage',
      title: 'Anatoly Power System',
      category: 'Power & Strength Montage',
      src: '/images/hero_montage.jpg',
      stat: '4–8 Wk Results',
      tag: 'Full Overload System',
    },
    {
      id: 'deadlift',
      title: 'Heavy Deadlift Elite',
      category: 'Female Power Athlete',
      src: '/images/female_athlete.jpg',
      stat: '+22.5 kg Max Bump',
      tag: 'Chalk & Iron Compound Focus',
    },
    {
      id: 'press',
      title: 'Overhead Power Press',
      category: 'Hypertrophy Specialist',
      src: '/images/male_athlete_press.jpg',
      stat: '5×5 Conquered',
      tag: 'Upper Hypertrophy Split',
    },
    {
      id: 'barbell',
      title: 'Olympic Barbell Overload',
      category: 'Raw Power & Core',
      src: '/images/hero_athlete.jpg',
      stat: '+2.5% Auto-Progression',
      tag: 'Strict Biomechanics',
    },
  ];

  const promoOffers = [
    {
      badge: 'LIMITED RELEASE • 60% OFF',
      headline: 'GET 60% OFF — CHOOSE VIP PLAN ⚡',
      subtext: 'Save $120 on Annual VIP • Less than $0.30/day',
      target: '#pricing',
    },
    {
      badge: '100% RISK-FREE TRIAL',
      headline: 'CLAIM 30-DAY MONEY-BACK GUARANTEE 🛡️',
      subtext: 'Full 100% refund if you do not gain strength in 30 days',
      target: '#guarantee',
    },
    {
      badge: 'ALGORITHMIC ENGINE',
      headline: 'START ADAPTIVE OVERLOAD — $8/MO 🔥',
      subtext: 'Auto-calculates weight bumps & rep ceilings for your split',
      target: '#pricing',
    },
    {
      badge: '90,000+ LIFTERS',
      headline: 'JOIN 90,000+ ATHLETES TODAY ⭐',
      subtext: 'Ethiopian & Global Nutrition Engine Included',
      target: '#audiences',
    },
  ];

  const promoChips = [
    { label: '⚡ 60% OFF ANNUAL VIP', target: '#pricing', badge: 'SAVE $120' },
    { label: '🛡️ 30-DAY MONEY-BACK GUARANTEE', target: '#guarantee', badge: 'ZERO RISK' },
    { label: '🏋️ ADAPTIVE OVERLOAD ENGINE', target: '#system', badge: 'AUTO BUMP' },
    { label: '🥗 ETHIOPIAN & GLOBAL MACROS', target: '#system', badge: 'INJERA & TEFF' },
    { label: '⏱️ SMART FASTING SYNC', target: '#system', badge: 'AUTOPHAGY' },
    { label: '📱 SINGLE-DEVICE LOCKING', target: '#comparison', badge: 'SECURITY' },
    { label: '📅 7-DAY SPLIT BLUEPRINT', target: '#routine', badge: 'PEAK RECOVERY' },
    { label: '⭐ JOIN 90,000+ LIFTERS', target: '#pricing', badge: '4.9/5 RATING' },
  ];

  useEffect(() => {
    const promoTimer = setInterval(() => {
      setActivePromoIndex((prev) => (prev + 1) % promoOffers.length);
    }, 3500);

    const athleteTimer = setInterval(() => {
      setActiveAthleteIndex((prev) => (prev + 1) % heroAthletes.length);
    }, 5500);

    return () => {
      clearInterval(promoTimer);
      clearInterval(athleteTimer);
    };
  }, [promoOffers.length, heroAthletes.length]);

  const scrollToTarget = (selector: string) => {
    const el = document.querySelector(selector);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const daysSchedule = [
    {
      day: 'Monday',
      title: 'Upper Body Heavy Overload',
      focus: 'Chest, Shoulders & Triceps',
      duration: '50 mins',
      exercises: [
        { name: 'Barbell Bench Press', sets: '4 sets × 8–10 reps', load: '82.5 kg', note: '+2.5kg overload triggered!' },
        { name: 'Incline Dumbbell Press', sets: '3 sets × 10–12 reps', load: '28 kg', note: 'Target hit 2 sessions in a row' },
        { name: 'Weighted Dips', sets: '3 sets × 10 reps', load: '+15 kg', note: 'Bodyweight + chain' },
        { name: 'Overhead Rope Extension', sets: '3 sets × 12–15 reps', load: '32 kg', note: 'Peak contraction' },
      ],
      fastingMode: '16:8 Fasting Window (Fasting until 12:00 PM)',
      nutritionHighlight: 'Post-workout: Tibs + 1.5 Injera (165g Protein target)',
    },
    {
      day: 'Tuesday',
      title: 'Lower Body Quad & Core Bias',
      focus: 'Quads, Calves & Abdominals',
      duration: '55 mins',
      exercises: [
        { name: 'Barbell Back Squat', sets: '4 sets × 6–8 reps', load: '120 kg', note: 'Heavy compound baseline' },
        { name: 'Romanian Deadlift', sets: '3 sets × 8–10 reps', load: '105 kg', note: 'Hamstring stretch focus' },
        { name: 'Bulgarian Split Squat', sets: '3 sets × 10 reps/leg', load: '24 kg DBs', note: 'Unilateral stability' },
        { name: 'Hanging Leg Raises', sets: '3 sets × 15 reps', load: 'BW', note: 'Core bracing' },
      ],
      fastingMode: '16:8 Window (Eating: 1:00 PM – 9:00 PM)',
      nutritionHighlight: 'Heavy carb day: Rice bowl + Lentils (240g Carbs)',
    },
    {
      day: 'Wednesday',
      title: 'Active Recovery & Circadian Flush',
      focus: 'Zone 2 Mobility, 3.5L Hydration',
      duration: '35 mins',
      exercises: [
        { name: 'Incline Treadmill Walk', sets: '25 mins @ 110-120 bpm', load: 'Zone 2', note: 'Cardio endurance' },
        { name: 'Thoracic Spine Mobility', sets: '10 mins', load: 'BW', note: 'Posture restoration' },
      ],
      fastingMode: '18:6 Deep Autophagy Fast',
      nutritionHighlight: 'Maintenance calories: High micronutrient veggie bowl',
    },
    {
      day: 'Thursday',
      title: 'Pull Power & Posterior Chain',
      focus: 'Lats, Upper Back & Biceps',
      duration: '48 mins',
      exercises: [
        { name: 'Barbell Deadlift', sets: '3 sets × 5 reps', load: '150 kg', note: 'Top set progression' },
        { name: 'Neutral Grip Pull-ups', sets: '4 sets × 8–10 reps', load: '+10 kg', note: 'Overload badge active' },
        { name: 'Chest-Supported Row', sets: '3 sets × 10–12 reps', load: '70 kg', note: 'Strict form pause' },
        { name: 'Incline Dumbbell Curl', sets: '3 sets × 12 reps', load: '16 kg', note: 'Long head emphasis' },
      ],
      fastingMode: '16:8 Window (Pre-workout caffeine only)',
      nutritionHighlight: 'Doro Wat with boiled eggs (52g Protein)',
    },
    {
      day: 'Friday',
      title: 'Shoulders, Arms & Weak Point Hypertrophy',
      focus: 'Delts, Arms & Forearms',
      duration: '45 mins',
      exercises: [
        { name: 'Standing Overhead Press', sets: '4 sets × 6–8 reps', load: '55 kg', note: 'Core tight, zero arch' },
        { name: 'Lateral Raise Dropset', sets: '4 sets × 15 reps', load: '14 kg → 10 kg', note: 'Side delt burn' },
        { name: 'Barbell Skull Crushers', sets: '3 sets × 10–12 reps', load: '37.5 kg', note: 'Tricep stretch' },
      ],
      fastingMode: '16:8 Flexible Window',
      nutritionHighlight: 'High protein re-feed: Grilled Salmon + Sweet Potato',
    },
    {
      day: 'Saturday',
      title: 'Lower Body Posterior & Hamstrings',
      focus: 'Glutes, Hamstrings & Calves',
      duration: '50 mins',
      exercises: [
        { name: 'Barbell Hip Thrust', sets: '4 sets × 10–12 reps', load: '140 kg', note: 'Lockout squeeze' },
        { name: 'Leg Curl Machine', sets: '3 sets × 12–15 reps', load: '55 kg', note: 'Controlled negative' },
        { name: 'Standing Calf Raises', sets: '4 sets × 15–20 reps', load: '85 kg', note: 'Full ankle stretch' },
      ],
      fastingMode: '14:10 Weekend Social Buffer',
      nutritionHighlight: 'Family dinner / cultural meal tracked with ease',
    },
    {
      day: 'Sunday',
      title: 'Rest, Sleep Recharge & Weekly Audit',
      focus: 'Body Trajectory Audit & Weekly Plan Re-calculation',
      duration: '15 mins check-in',
      exercises: [
        { name: 'Morning Weight & Waist Log', sets: 'Mandatory monthly audit', load: 'Logged', note: 'Trajectory updated' },
        { name: 'Next Week Overload Calculated', sets: 'Automated', load: '+2.5% applied', note: 'Split ready' },
      ],
      fastingMode: 'Extended Restorative Fast (20:4 Option)',
      nutritionHighlight: 'Target 9 hours of uninterrupted restorative sleep',
    },
  ];

  const faqs = [
    {
      q: 'How does Urji Fit’s Progressive Overload Engine actually work?',
      a: 'Unlike static workout apps that give you a PDF template, Urji Fit evaluates your logged weights and reps set-by-set. If you hit your target repetition ceiling across two consecutive training sessions on a movement (e.g., 3 sets of 10 reps at 80kg), the system automatically prompts you to advance weight by +2.5% to +5% on your next workout. If performance drops across two sessions, it recommends an active deload to safeguard your joints and CNS.',
    },
    {
      q: 'Does the nutrition tracker support Ethiopian and cultural staple foods?',
      a: 'Yes, 100%. While traditional calorie apps force you to guess what Injera, Shiro, Tibs, or Misir Wat weigh, Urji Fit has native Ethiopian staple calculators with pre-calibrated macro profiles, combined with a comprehensive global food database and 1-tap quick logs.',
    },
    {
      q: 'How does the fasting clock integrate with food logging?',
      a: 'If your fasting timer is actively running and you log a meal in the Fuel module, Urji Fit automatically detects that you have broken your fast. It prompts you to conclude the window, records your total fast duration and autophagy metrics, and starts the feeding phase countdown without any manual clock adjusting.',
    },
    {
      q: 'What is Single-Device Locking and why does it matter?',
      a: 'To guarantee data integrity, privacy, and prevent account sharing or unauthorized credential duplication, your Urji Fit account is bound to one hardware device via a cryptographic UUID. If you log in on a new device, your prior session is safely invalidated. Administrators can also revoke devices instantly from the management console.',
    },
    {
      q: 'Can I use Urji Fit if I train at home with basic dumbbells or bands?',
      a: 'Absolutely. Urji Fit includes both gym commercial equipment splits and minimal home setups. You can swap exercises using our 34-movement verified video library and build your own custom split in the Split Builder module.',
    },
    {
      q: 'What is the 30-Day Money-Back Guarantee policy?',
      a: 'We want zero friction and total peace of mind. If you use Urji Fit for 30 days and don’t find yourself significantly stronger, more consistent, and more disciplined with your nutrition and habits, email support for a 100% full refund. No awkward proofs or complicated barriers.',
    },
  ];

  return (
    <div className="min-h-screen bg-[#071913] text-[#EDEAE3] antialiased selection:bg-[#0B3D2E] selection:text-[#F2F7D9]">
      {/* -------------------------------------------------------------
          1. TOP TICKER & ANNOUNCEMENT BAR (DEEP PINE ACCENT)
      ------------------------------------------------------------- */}
      <div className="bg-[#07241B] text-[#F2F7D9] py-2 px-4 text-xs font-semibold tracking-wider uppercase text-center border-b border-[#F2F7D9]/15 relative z-30">
        <div className="max-w-7xl mx-auto flex items-center justify-center gap-2 overflow-hidden whitespace-nowrap">
          <span className="inline-block w-2 h-2 rounded-full bg-[#C1502E] animate-pulse" />
          <span>⚡ LIMITED RELEASE: 60% OFF ANNUAL VIP • ADAPTIVE PROGRESSIVE OVERLOAD SYSTEM • ZERO SUBSCRIPTION LOCK-IN</span>
          <span className="hidden md:inline-block text-[#F2F7D9]/40">•</span>
          <span className="hidden md:inline-block text-emerald-300">12,400+ ATHLETES ACTIVE TODAY</span>
        </div>
      </div>

      {/* -------------------------------------------------------------
          HEADER & NAVIGATION (OBSIDIAN PINE GLASS)
      ------------------------------------------------------------- */}
      <header className="sticky top-0 z-40 bg-[#071913]/90 backdrop-blur-md border-b border-white/10 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          {/* Brand */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-[#0B3D2E] border border-white/10 flex items-center justify-center text-[#F2F7D9] shadow-sm group-hover:bg-[#135440] transition-colors">
              <span className="font-serif text-2xl font-bold">U</span>
            </div>
            <div>
              <span className="font-serif text-2xl tracking-tight font-medium text-[#EDEAE3] block leading-none">
                Urji Fit
              </span>
              <span className="text-[10px] uppercase font-bold tracking-widest text-[#8FA69B] block mt-0.5">
                Adaptive System
              </span>
            </div>
          </Link>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-7 text-xs font-semibold uppercase tracking-wider text-[#A4B5AC]">
            <a href="#system" className="hover:text-[#F2F7D9] transition-colors">The System</a>
            <a href="#audiences" className="hover:text-[#F2F7D9] transition-colors">Programs</a>
            <a href="#routine" className="hover:text-[#F2F7D9] transition-colors">Weekly Blueprint</a>
            <a href="#comparison" className="hover:text-[#F2F7D9] transition-colors">Why It Wins</a>
            <a href="#pricing" className="hover:text-[#F2F7D9] transition-colors">Pricing</a>
            <a href="#faq" className="hover:text-[#F2F7D9] transition-colors">FAQ</a>
          </nav>

          {/* Right Header Actions */}
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-xs font-semibold uppercase tracking-wider text-[#EDEAE3] hover:text-[#F2F7D9] px-3 py-2 rounded-lg hover:bg-white/5 transition-colors hidden sm:block"
            >
              Sign In
            </Link>
            <a
              href="#pricing"
              className="px-4 py-2.5 bg-[#C1502E] hover:bg-[#D45E3A] text-white rounded-xl text-xs font-semibold tracking-wide transition-all shadow-sm flex items-center gap-1.5"
            >
              <span>Get 60% Off</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </header>

      {/* -------------------------------------------------------------
          2. HERO SECTION (ANATOLY-STYLE REALISTIC MONTAGE STAGE)
      ------------------------------------------------------------- */}
      <section className="relative pt-16 pb-24 md:pt-24 md:pb-36 overflow-hidden bg-[#07110C] text-[#EDEAE3]">
        {/* Realistic Generated Montage Image as High-Impact Background on Right */}
        <div className="absolute inset-0 z-0">
          <img
            src="/images/hero_montage.jpg"
            alt="Urji Fit Athletes in Heavy Training"
            className="w-full h-full object-cover object-right md:object-center opacity-65 md:opacity-75 scale-105 transform hover:scale-100 transition-transform duration-1000"
          />
          {/* Dual Gradient Overlays: Dark fade on left for extreme text legibility */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#07110C] via-[#07110C]/90 sm:via-[#07110C]/75 to-transparent z-10" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#07110C] via-transparent to-black/50 z-10" />
        </div>

        {/* Floating Right Edge 60% OFF Vertical Ribbon (Anatoly Signature) */}
        <a
          href="#pricing"
          className="fixed right-0 top-1/2 -translate-y-1/2 z-50 bg-[#FFE600] text-black font-black text-[11px] uppercase tracking-widest px-2.5 py-6 rounded-l-2xl shadow-2xl flex flex-col items-center gap-1 cursor-pointer hover:bg-white hover:scale-105 transition-all [writing-mode:vertical-lr] border-l-2 border-y-2 border-black/20"
        >
          <span>⚡ GRAB 60% OFF</span>
        </a>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
            
            {/* Left Column: Bold Power Typography & Anatoly-style Conversion Funnel */}
            <div className="lg:col-span-7 space-y-6 text-left">
              
              {/* Main Headline - Bold Condensed Uppercase (Exact Anatoly Impact) */}
              <h1
                style={{ fontFamily: "var(--font-oswald), sans-serif" }}
                className="text-5xl sm:text-6xl md:text-7xl lg:text-[76px] font-black uppercase tracking-tight text-white leading-[0.93] drop-shadow-2xl"
              >
                PROGRESS STARTS <br />
                WITH <span className="text-[#FFE600] drop-shadow-md">URJI&apos;S OVERLOAD</span> <br />
                <span className="text-[#FFE600] drop-shadow-md">SYSTEM</span>
              </h1>

              {/* Subheadline */}
              <p className="text-sm sm:text-base text-gray-300 max-w-xl font-medium leading-relaxed drop-shadow">
                The exact progressive overload &amp; habit system Urji trains with — personalized to your level, schedule, and goal. From day one.
              </p>

              {/* 4 Quick-Hit Bullets with Yellow Badge Checkmarks */}
              <div className="space-y-2.5 pt-1 text-xs sm:text-sm font-semibold text-gray-200">
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-[#FFE600] text-black flex items-center justify-center font-black text-xs shrink-0 shadow-sm">
                    ✓
                  </div>
                  <span>Created by Urji — for you</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-[#FFE600] text-black flex items-center justify-center font-black text-xs shrink-0 shadow-sm">
                    ✓
                  </div>
                  <span>Results in just 4–8 weeks</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-[#FFE600] text-black flex items-center justify-center font-black text-xs shrink-0 shadow-sm">
                    ✓
                  </div>
                  <span>From $8/mo — less than $0.30/day</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-[#FFE600] text-black flex items-center justify-center font-black text-xs shrink-0 shadow-sm">
                    ✓
                  </div>
                  <span>Home or gym — Flexible plans</span>
                </div>
              </div>

              {/* CTAs: Yellow High-Contrast Button + Showreel Button */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 pt-2">
                <a
                  href="#pricing"
                  className="px-8 py-4 bg-[#FFE600] hover:bg-[#E5CF00] text-black font-extrabold text-sm uppercase tracking-wider rounded-xl shadow-xl hover:shadow-2xl hover:scale-102 transition-all flex items-center justify-center gap-2.5 cursor-pointer group"
                >
                  <span>GET 60% OFF — CHOOSE PLAN</span>
                  <Zap className="w-4 h-4 fill-black text-black group-hover:scale-110 transition-transform" />
                </a>
                <a
                  href="#system"
                  className="px-6 py-4 bg-black/50 hover:bg-black/70 border border-white/25 text-xs font-bold uppercase tracking-wider text-white rounded-xl backdrop-blur-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-white text-white" />
                  <span>WATCH SHOWREEL</span>
                </a>
              </div>

              {/* Social Proof Avatar Cluster with Real Photos */}
              <div className="pt-2 flex items-center gap-3.5">
                <div className="flex -space-x-2.5 overflow-hidden">
                  <img
                    src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=96&h=96&fit=crop&crop=face"
                    alt="Member avatar"
                    className="inline-block h-9 w-9 rounded-full ring-2 ring-[#07110C] object-cover"
                  />
                  <img
                    src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=96&h=96&fit=crop&crop=face"
                    alt="Member avatar"
                    className="inline-block h-9 w-9 rounded-full ring-2 ring-[#07110C] object-cover"
                  />
                  <img
                    src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=96&h=96&fit=crop&crop=face"
                    alt="Member avatar"
                    className="inline-block h-9 w-9 rounded-full ring-2 ring-[#07110C] object-cover"
                  />
                  <img
                    src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=96&h=96&fit=crop&crop=face"
                    alt="Member avatar"
                    className="inline-block h-9 w-9 rounded-full ring-2 ring-[#07110C] object-cover"
                  />
                  <img
                    src="https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=96&h=96&fit=crop&crop=face"
                    alt="Member avatar"
                    className="inline-block h-9 w-9 rounded-full ring-2 ring-[#07110C] object-cover"
                  />
                </div>
                <div>
                  <p className="text-xs text-gray-300 font-medium">
                    Joined by <strong className="text-white font-bold text-sm">90,000+ people</strong>
                  </p>
                </div>
              </div>
            </div>

            {/* Right Column: Discrete Corner Overload Status Badge (Unobtrusive so athletes remain visible) */}
            <div className="lg:col-span-5 relative hidden lg:flex flex-col justify-end items-end h-full pt-48">
              <div className="p-4 bg-[#0B1E16]/85 backdrop-blur-md border border-emerald-400/30 rounded-2xl shadow-2xl flex items-start gap-3 max-w-xs transform hover:-translate-y-1 transition-transform">
                <Flame className="w-5 h-5 text-[#FFE600] shrink-0 mt-0.5 animate-pulse" />
                <div>
                  <div className="text-[11px] font-bold text-[#FFE600] uppercase tracking-wide">Progressive Overload Active</div>
                  <p className="text-[11px] text-gray-200 mt-0.5 leading-tight">
                    Rep target hit 2 sessions in a row: <span className="font-mono font-bold text-white bg-black/40 px-1 py-0.5 rounded border border-white/10">+2.5 kg auto-applied</span>
                  </p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* -------------------------------------------------------------
          BRIGHT YELLOW TICKER STRIP (EXACT ANATOLY STYLE)
      ------------------------------------------------------------- */}
      <section className="bg-[#FFE600] text-black py-3 px-4 text-xs font-black tracking-wider uppercase border-y border-black/10 overflow-hidden whitespace-nowrap relative z-20 shadow-md">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-6 overflow-hidden">
          <span>FULL MONEY-BACK GUARANTEE</span>
          <span className="text-black/30">•</span>
          <span>HOME OR GYM</span>
          <span className="text-black/30">•</span>
          <span>PROGRESS TRACKING INSIDE APP</span>
          <span className="text-black/30">•</span>
          <span>90,000+ MEMBERS</span>
          <span className="text-black/30">•</span>
          <span>4-8 WEEKS TO RESULTS</span>
          <span className="text-black/30">•</span>
          <span>FROM $8/MO</span>
          <span className="hidden md:inline text-black/30">•</span>
          <span className="hidden md:inline">FULL MONEY-BACK GUARANTEE</span>
          <span className="hidden md:inline text-black/30">•</span>
          <span className="hidden md:inline">PROGRESS TRACKING INSIDE APP</span>
        </div>
      </section>

      {/* -------------------------------------------------------------
          3. AUDIENCE SEGMENTATION (WARM LINEN CANVAS)
      ------------------------------------------------------------- */}
      <section id="audiences" className="py-20 md:py-28 bg-[#F7F4EC] text-[#14201A]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <span className="text-xs font-semibold uppercase tracking-widest text-[#0B3D2E]">
              Engineered For Your Specific Goals
            </span>
            <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl text-[#0B3D2E]">
              Whether Building Raw Strength or Cutting Body Fat, the System Adapts.
            </h2>
            <p className="text-sm sm:text-base text-[#5A6660]">
              Select your primary goal to see how Urji Fit tailors your progressive overload, meal calculations, and recovery protocols.
            </p>
          </div>

          {/* Interactive Audience Tabs */}
          <div className="flex justify-center">
            <div className="inline-flex p-1.5 bg-[#0B3D2E]/10 border border-[#0B3D2E]/15 rounded-2xl gap-1">
              <button
                onClick={() => setActiveAudience('hypertrophy')}
                className={`px-5 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                  activeAudience === 'hypertrophy'
                    ? 'bg-[#0B3D2E] text-[#F2F7D9] shadow-sm'
                    : 'bg-white text-[#5A6660] hover:text-[#0B3D2E]'
                }`}
              >
                Muscle Growth & Heavy Overload
              </button>
              <button
                onClick={() => setActiveAudience('fatloss')}
                className={`px-5 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                  activeAudience === 'fatloss'
                    ? 'bg-[#0B3D2E] text-[#F2F7D9] shadow-sm'
                    : 'bg-white text-[#5A6660] hover:text-[#0B3D2E]'
                }`}
              >
                Fat Loss & Fasting Precision
              </button>
              <button
                onClick={() => setActiveAudience('busy')}
                className={`px-5 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                  activeAudience === 'busy'
                    ? 'bg-[#0B3D2E] text-[#F2F7D9] shadow-sm'
                    : 'bg-white text-[#5A6660] hover:text-[#0B3D2E]'
                }`}
              >
                Busy High-Performers
              </button>
            </div>
          </div>

          {/* Dynamic Audience Detail Panel */}
          <div className="bg-white border border-[#0B3D2E]/15 rounded-3xl p-8 md:p-12 shadow-sm">
            {activeAudience === 'hypertrophy' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center animate-fadeIn">
                <div className="space-y-4">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-[#C1502E]/10 text-[#C1502E] text-xs font-bold">
                    <Flame className="w-4 h-4" /> Maximum Muscle Overload
                  </div>
                  <h3 className="font-serif text-3xl text-[#0B3D2E]">
                    Break Through Strength Plateaus with Mathematical Precision
                  </h3>
                  <p className="text-sm text-[#5A6660] leading-relaxed">
                    Stop guessing if you should lift 75kg or 80kg today. When you hit the top rep bracket for 2 consecutive sessions, the engine prompts an exact +2.5% to +5% weight progression so your muscles never adapt to stagnation.
                  </p>
                  <ul className="space-y-2.5 pt-2 text-xs font-medium text-[#14201A]">
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-[#0B3D2E]" /> Automatic +2.5% to +5% load recalculation</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-[#0B3D2E]" /> 6 curated split templates with 34 verified movement guides</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-[#0B3D2E]" /> High-protein daily targets calibrated to your lean mass</li>
                  </ul>
                </div>
                <div className="p-6 bg-[#F3EFE5] rounded-2xl border border-[#0B3D2E]/10 space-y-3">
                  <div className="text-xs uppercase font-bold text-[#5A6660]">Hypertrophy Blueprint Preview</div>
                  <div className="font-serif text-xl text-[#0B3D2E]">Push / Pull / Legs Hypertrophy Split</div>
                  <p className="text-xs text-[#5A6660]">
                    Compound focus with automated deload fatigue alerts when CNS fatigue is detected across 2 sessions.
                  </p>
                  <div className="pt-2 flex items-center justify-between text-xs font-mono font-bold text-[#14201A]">
                    <span>Target Calories: 2,850 kcal</span>
                    <span>Daily Protein: 175g</span>
                  </div>
                </div>
              </div>
            )}

            {activeAudience === 'fatloss' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center animate-fadeIn">
                <div className="space-y-4">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-emerald-100 text-emerald-800 text-xs font-bold">
                    <Timer className="w-4 h-4" /> Synchronized Fasting & Deficit
                  </div>
                  <h3 className="font-serif text-3xl text-[#0B3D2E]">
                    Shed Stubborn Fat Without Banning Real Cultural Foods
                  </h3>
                  <p className="text-sm text-[#5A6660] leading-relaxed">
                    Say goodbye to restrictive crash diets. Urji Fit seamlessly synchronizes a live circular fasting clock (16:8, 18:6, 20:4) with our Ethiopian and global nutrition database so you can eat Injera, lentils, and lean meat within your macros.
                  </p>
                  <ul className="space-y-2.5 pt-2 text-xs font-medium text-[#14201A]">
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-[#0B3D2E]" /> Fast breaks automatically the instant you log food</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-[#0B3D2E]" /> Waist-to-weight trajectory charts with mandatory 30-day checks</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-[#0B3D2E]" /> Native Ethiopian staple macros (Injera, Shiro, Tibs)</li>
                  </ul>
                </div>
                <div className="p-6 bg-[#F3EFE5] rounded-2xl border border-[#0B3D2E]/10 space-y-3">
                  <div className="text-xs uppercase font-bold text-[#5A6660]">Fasting & Calorie Protocol</div>
                  <div className="font-serif text-xl text-[#0B3D2E]">16:8 Lean Definition Protocol</div>
                  <p className="text-xs text-[#5A6660]">
                    Eating window opens at 12:00 PM and closes at 8:00 PM. Fasting clock runs live with circular hour trackers.
                  </p>
                  <div className="pt-2 flex items-center justify-between text-xs font-mono font-bold text-[#14201A]">
                    <span>Target Calories: 1,950 kcal</span>
                    <span>Water: 3,000 ml</span>
                  </div>
                </div>
              </div>
            )}

            {activeAudience === 'busy' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center animate-fadeIn">
                <div className="space-y-4">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-indigo-100 text-indigo-800 text-xs font-bold">
                    <Clock className="w-4 h-4" /> Time-Optimized Discipline
                  </div>
                  <h3 className="font-serif text-3xl text-[#0B3D2E]">
                    Maximum Impact in Under 50 Minutes a Day
                  </h3>
                  <p className="text-sm text-[#5A6660] leading-relaxed">
                    Designed for founders, engineers, and busy operators who don’t have 2 hours to waste in the gym. Tight 45-minute density workouts, automated sleep wind-down reminders 60 minutes before target bedtime, and 1-tap logging.
                  </p>
                  <ul className="space-y-2.5 pt-2 text-xs font-medium text-[#14201A]">
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-[#0B3D2E]" /> 60-minute pre-bed wind-down notifications to beat sleep debt</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-[#0B3D2E]" /> Single-tap +250ml / +500ml water buttons</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-[#0B3D2E]" /> Zero mental fatigue: open the app, follow the sets, close it</li>
                  </ul>
                </div>
                <div className="p-6 bg-[#F3EFE5] rounded-2xl border border-[#0B3D2E]/10 space-y-3">
                  <div className="text-xs uppercase font-bold text-[#5A6660]">Executive Habit Rhythm</div>
                  <div className="font-serif text-xl text-[#0B3D2E]">Upper/Lower 4-Day Efficiency Split</div>
                  <p className="text-xs text-[#5A6660]">
                    Target bedtime: 11:00 PM. Wind-down notification triggers at 10:00 PM. Hydration alert at 3:00 PM.
                  </p>
                  <div className="pt-2 flex items-center justify-between text-xs font-mono font-bold text-[#14201A]">
                    <span>Workouts: 4 × 45 mins</span>
                    <span>Sleep Debt: 0m</span>
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>
      </section>

      {/* -------------------------------------------------------------
          4. PROBLEM-AGITATION-SOLUTION (PAS) CONTRAST TABLE (WARM PARCHMENT DUAL TONE)
      ------------------------------------------------------------- */}
      <section className="py-20 bg-[#EFE9DD] border-y border-[#14201A]/10 text-[#14201A]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <span className="text-xs font-semibold uppercase tracking-widest text-[#C1502E]">
              Sound Familiar?
            </span>
            <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl text-[#0B3D2E]">
              Why Most Fitness Efforts Fizzle Out in 30 Days
            </h2>
            <p className="text-sm sm:text-base text-[#5A6660]">
              When your habits live in separate silos, consistency is nearly impossible. See how the Urji Fit system fixes the root breakdown points.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* The Broken Old Way */}
            <div className="bg-[#FDF2F0] border border-red-200/80 rounded-3xl p-8 space-y-6 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-red-100 text-red-700 flex items-center justify-center font-bold">
                  ✕
                </div>
                <h3 className="font-serif text-2xl text-red-900">The Fragmented Old Way</h3>
              </div>

              <ul className="space-y-4 text-xs sm:text-sm text-[#5F2C24]">
                <li className="flex items-start gap-3">
                  <span className="text-red-600 font-bold shrink-0 mt-0.5">•</span>
                  <span><strong>Juggling 5 Separate Apps:</strong> One for workouts, one for calories, one for fasting, one for sleep, and random notes in your phone.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-red-600 font-bold shrink-0 mt-0.5">•</span>
                  <span><strong>Lifting the Exact Same Weight:</strong> No progressive overload algorithm means you lift the same 20kg dumbbells for 8 months with zero muscle growth.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-red-600 font-bold shrink-0 mt-0.5">•</span>
                  <span><strong>Punishing Cookie-Cutter Diets:</strong> Generic meal plans that ban your favorite cultural dishes, leading to inevitable binge cycles.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-red-600 font-bold shrink-0 mt-0.5">•</span>
                  <span><strong>Sleep & Recovery Blindness:</strong> Destroying your progress by training heavy on 5 hours of sleep with massive unmonitored sleep debt.</span>
                </li>
              </ul>
            </div>

            {/* The Urji Fit System - Commanding Deep Forest Pine */}
            <div className="bg-[#0B3D2E] text-[#F3EFE5] border border-emerald-400/30 rounded-3xl p-8 space-y-6 shadow-xl">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#C1502E] text-white flex items-center justify-center font-bold">
                  ✓
                </div>
                <h3 className="font-serif text-2xl text-[#F2F7D9]">The Urji Fit System</h3>
              </div>

              <ul className="space-y-4 text-xs sm:text-sm text-[#F3EFE5]">
                <li className="flex items-start gap-3">
                  <span className="text-[#F2F7D9] font-bold shrink-0 mt-0.5">✓</span>
                  <span><strong>One Unified Dashboard:</strong> Workout plates, fasting timers, macros, hydration, and sleep debt live in a single unified command center.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-[#F2F7D9] font-bold shrink-0 mt-0.5">✓</span>
                  <span><strong>Algorithmic Progressive Overload:</strong> Automatically tells you exactly when to add +2.5% to +5% weight or when to deload to avoid injury.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-[#F2F7D9] font-bold shrink-0 mt-0.5">✓</span>
                  <span><strong>Cultural & Global Macro Freedom:</strong> Built-in Ethiopian staple math (Injera, Shiro, Tibs) and transparent macro budgeting.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-[#F2F7D9] font-bold shrink-0 mt-0.5">✓</span>
                  <span><strong>Circadian Sleep & Wind-Down Shield:</strong> Automated 60-minute wind-down alerts so you hit your target bedtime and recover fully.</span>
                </li>
              </ul>
            </div>
          </div>

        </div>
      </section>

      {/* -------------------------------------------------------------
          5. PRODUCT FEATURE WALKTHROUGH (SLEEK OBSIDIAN COMMAND DECK)
      ------------------------------------------------------------- */}
      <section id="system" className="py-20 md:py-28 bg-[#0A1411] text-[#EDEAE3]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <span className="text-xs font-semibold uppercase tracking-widest text-[#F2F7D9]">
              Inside The Platform
            </span>
            <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl text-[#F4EFE6]">
              Engineered For Results, Not Gimmicks.
            </h2>
            <p className="text-sm sm:text-base text-[#A4B5AC]">
              Explore the 4 core pillars that make Urji Fit the most comprehensive habit and fitness system built.
            </p>
          </div>

          {/* Feature Tabs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { id: 'overload', label: '1. Overload Engine', icon: Dumbbell },
              { id: 'nutrition', label: '2. Nutrition & Staples', icon: Flame },
              { id: 'fasting', label: '3. Fasting Sync', icon: Timer },
              { id: 'sleep', label: '4. Sleep & Recovery', icon: Moon },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeFeature === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveFeature(tab.id as any)}
                  className={`p-4 rounded-2xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#0B3D2E] text-white border-emerald-500/40 shadow-md'
                      : 'bg-white/5 border-white/10 text-[#A4B5AC] hover:border-white/20 hover:text-white'
                  }`}
                >
                  <Icon className={`w-5 h-5 ${isActive ? 'text-[#F2F7D9]' : 'text-emerald-400'}`} />
                  <span className="text-xs font-bold tracking-wide">{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Active Feature Showcase Box */}
          <div className="bg-[#111F19] border border-white/10 rounded-3xl p-8 md:p-12 shadow-xl">
            {activeFeature === 'overload' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                <div className="lg:col-span-6 space-y-4">
                  <h3 className="font-serif text-3xl text-white">
                    The Rule-Based Progressive Overload Engine
                  </h3>
                  <p className="text-sm text-[#A4B5AC] leading-relaxed">
                    Most lifters fail because they don’t record or scale their volume systematically. Urji Fit checks your historical set-by-set logs. When you conquer the rep-cap across consecutive sessions, your next workout automatically displays the target load increase.
                  </p>
                  <div className="space-y-2 text-xs text-gray-300">
                    <p className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Auto-suggests +2.5% to +5% weight progression</p>
                    <p className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Flags performance drop-offs and recommends strategic deloads</p>
                    <p className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Embedded video form guides for all 34 foundation movements</p>
                  </div>
                </div>
                <div className="lg:col-span-6 p-6 bg-[#091510] rounded-2xl border border-white/10 space-y-3 font-mono text-xs">
                  <div className="text-[11px] text-[#F7A68E] font-bold uppercase">Algorithm In Action</div>
                  <div className="p-3 bg-white/5 rounded-xl border border-white/5 flex justify-between text-gray-200">
                    <span>Session 1: Barbell Squat</span>
                    <span className="font-bold text-white">100 kg × 8, 8, 8 reps ✓</span>
                  </div>
                  <div className="p-3 bg-white/5 rounded-xl border border-white/5 flex justify-between text-gray-200">
                    <span>Session 2: Barbell Squat</span>
                    <span className="font-bold text-white">100 kg × 8, 8, 8 reps ✓</span>
                  </div>
                  <div className="p-3 bg-[#0B3D2E] text-white rounded-xl flex justify-between items-center shadow-xs border border-emerald-400/30">
                    <span>Session 3 Suggested:</span>
                    <span className="font-bold text-[#F2F7D9]">+5% → 105 kg × 6–8 reps 🔥</span>
                  </div>
                </div>
              </div>
            )}

            {activeFeature === 'nutrition' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                <div className="lg:col-span-6 space-y-4">
                  <h3 className="font-serif text-3xl text-white">
                    Nutritional Clarity With Cultural Staples
                  </h3>
                  <p className="text-sm text-[#A4B5AC] leading-relaxed">
                    Track calories, protein, carbs, and fats without giving up your traditional meals. Our calibrated Ethiopian staple guide allows 1-tap logging of Injera rolls, Shiro, Beef/Lamb Tibs, and Misir Wat alongside global fitness foods.
                  </p>
                  <div className="space-y-2 text-xs text-gray-300">
                    <p className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Calibrated Injera & traditional meal profiles</p>
                    <p className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> 1-tap quick log buttons for daily meals</p>
                    <p className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Automatic macro distribution meters</p>
                  </div>
                </div>
                <div className="lg:col-span-6 p-6 bg-[#091510] rounded-2xl border border-white/10 space-y-3 text-xs">
                  <div className="text-[11px] font-bold text-[#F2F7D9] uppercase">Native Staple Guide</div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                      <div className="font-bold text-white">Injera (1 Roll)</div>
                      <div className="text-[11px] text-[#A4B5AC]">380 kcal • 12g P • 78g C</div>
                    </div>
                    <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                      <div className="font-bold text-white">Beef Tibs (250g)</div>
                      <div className="text-[11px] text-[#A4B5AC]">520 kcal • 48g P • 6g C</div>
                    </div>
                    <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                      <div className="font-bold text-white">Shiro Wat (1 Cup)</div>
                      <div className="text-[11px] text-[#A4B5AC]">290 kcal • 14g P • 32g C</div>
                    </div>
                    <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                      <div className="font-bold text-white">Misir Wat (1 Cup)</div>
                      <div className="text-[11px] text-[#A4B5AC]">240 kcal • 16g P • 38g C</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeFeature === 'fasting' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                <div className="lg:col-span-6 space-y-4">
                  <h3 className="font-serif text-3xl text-white">
                    Live Circular Fasting Clocks & Nutrition Sync
                  </h3>
                  <p className="text-sm text-[#A4B5AC] leading-relaxed">
                    Fasting timers shouldn't live on an isolated island. In Urji Fit, your fasting clock interacts directly with your food logs. When you break your fast by logging lunch, your timer wraps up and archives your fasting streak automatically.
                  </p>
                  <div className="space-y-2 text-xs text-gray-300">
                    <p className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Presets for 16:8, 18:6, 20:4, and 24h fasts</p>
                    <p className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Automatic fast completion when food is logged</p>
                    <p className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Streak tracking & metabolic milestone triggers</p>
                  </div>
                </div>
                <div className="lg:col-span-6 p-6 bg-[#091510] rounded-2xl border border-white/10 text-center space-y-4">
                  <div className="w-32 h-32 rounded-full border-4 border-[#0B3D2E] border-t-emerald-400 mx-auto flex flex-col items-center justify-center">
                    <span className="font-mono font-bold text-lg text-white">16:42:10</span>
                    <span className="text-[10px] text-[#A4B5AC] uppercase font-semibold">Autophagy Active</span>
                  </div>
                  <p className="text-xs text-[#A4B5AC]">
                    Target: 16 Hours • Eating window starts in 0h 18m
                  </p>
                </div>
              </div>
            )}

            {activeFeature === 'sleep' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                <div className="lg:col-span-6 space-y-4">
                  <h3 className="font-serif text-3xl text-white">
                    Sleep Debt Tracking & 60-Minute Wind-Down Protection
                  </h3>
                  <p className="text-sm text-[#A4B5AC] leading-relaxed">
                    You can’t out-train chronic sleep deprivation. Urji Fit monitors your weekly sleep debt and sends an automated wind-down notification 60 minutes before target bedtime, helping you disconnect screens and preserve sleep quality.
                  </p>
                  <div className="space-y-2 text-xs text-gray-300">
                    <p className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Non-intrusive 60-minute pre-bed reminder</p>
                    <p className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Sleep debt ledger that adjusts rest day recommendations</p>
                    <p className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Morning quality ratings & duration analysis</p>
                  </div>
                </div>
                <div className="lg:col-span-6 p-6 bg-[#091510] rounded-2xl border border-white/10 space-y-3 font-mono text-xs">
                  <div className="text-[11px] font-bold text-indigo-400 uppercase">Circadian Ledger</div>
                  <div className="p-3 bg-white/5 rounded-xl flex justify-between text-gray-200">
                    <span>Target Bedtime / Wake:</span>
                    <span className="font-bold text-white">11:00 PM – 07:00 AM (8h)</span>
                  </div>
                  <div className="p-3 bg-white/5 rounded-xl flex justify-between text-gray-200">
                    <span>Wind-Down Notification:</span>
                    <span className="font-bold text-indigo-400">10:00 PM (Active)</span>
                  </div>
                  <div className="p-3 bg-emerald-950/40 border border-emerald-500/20 text-emerald-300 rounded-xl flex justify-between">
                    <span>Accumulated Sleep Debt:</span>
                    <span className="font-bold">0 mins (Fully Recovered)</span>
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>
      </section>

      {/* -------------------------------------------------------------
          6. INTERACTIVE WEEKLY BLUEPRINT PREVIEW (WARM LINEN CANVAS)
      ------------------------------------------------------------- */}
      <section id="routine" className="py-20 bg-[#F7F4EC] text-[#14201A] border-y border-[#14201A]/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <span className="text-xs font-semibold uppercase tracking-widest text-[#0B3D2E]">
              Your Weekly Blueprint
            </span>
            <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl text-[#0B3D2E]">
              Peek Inside a Sample 7-Day Performance Week
            </h2>
            <p className="text-sm sm:text-base text-[#5A6660]">
              Click any day of the week to see how training volume, fasting windows, and nutrition harmonize day-by-day.
            </p>
          </div>

          {/* 7-Day Pill Selector */}
          <div className="flex items-center justify-start sm:justify-center gap-2 overflow-x-auto pb-2">
            {daysSchedule.map((item, idx) => (
              <button
                key={idx}
                onClick={() => setActiveDay(idx)}
                className={`px-4 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all shrink-0 cursor-pointer ${
                  activeDay === idx
                    ? 'bg-[#0B3D2E] text-[#F2F7D9] shadow-sm'
                    : 'bg-white text-[#5A6660] border border-[#14201A]/10 hover:text-[#0B3D2E]'
                }`}
              >
                {item.day.slice(0, 3)}
              </button>
            ))}
          </div>

          {/* Selected Day Routine Card */}
          <div className="bg-white border border-[#14201A]/10 rounded-3xl p-6 sm:p-10 space-y-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#14201A]/10">
              <div>
                <span className="text-xs font-bold uppercase tracking-widest text-[#C1502E]">
                  {daysSchedule[activeDay].day} Schedule
                </span>
                <h3 className="font-serif text-2xl sm:text-3xl text-[#0B3D2E] mt-1">
                  {daysSchedule[activeDay].title}
                </h3>
                <p className="text-xs text-[#5A6660] mt-1">
                  Focus: {daysSchedule[activeDay].focus} • Duration: {daysSchedule[activeDay].duration}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="px-3 py-1.5 rounded-xl bg-[#F3EFE5] text-xs font-semibold text-[#0B3D2E] border border-[#14201A]/5">
                  ⏱️ {daysSchedule[activeDay].fastingMode}
                </span>
              </div>
            </div>

            {/* Exercise Movements Table */}
            <div className="space-y-3">
              <div className="text-xs font-bold uppercase text-[#5A6660]">Prescribed Exercise Sets</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {daysSchedule[activeDay].exercises.map((ex, i) => (
                  <div key={i} className="p-4 bg-[#FAF7F2] rounded-2xl border border-[#14201A]/5 space-y-1">
                    <div className="flex justify-between items-start">
                      <span className="font-semibold text-sm text-[#14201A]">{ex.name}</span>
                      <span className="font-mono text-xs font-bold text-[#0B3D2E]">{ex.load}</span>
                    </div>
                    <div className="text-xs text-[#5A6660]">{ex.sets}</div>
                    <div className="text-[11px] text-emerald-700 font-medium">💡 {ex.note}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Nutrition Highlight */}
            <div className="pt-4 border-t border-[#14201A]/10 flex items-center gap-3 text-xs">
              <span className="font-bold text-[#0B3D2E] uppercase tracking-wider">Fuel Target:</span>
              <span className="text-[#5A6660]">{daysSchedule[activeDay].nutritionHighlight}</span>
            </div>
          </div>

        </div>
      </section>

      {/* -------------------------------------------------------------
          7. COMPETITIVE COMPARISON MATRIX (CLEAN WARM LINEN TABLE)
      ------------------------------------------------------------- */}
      <section id="comparison" className="py-20 md:py-28 bg-[#F7F4EC] text-[#14201A]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <span className="text-xs font-semibold uppercase tracking-widest text-[#0B3D2E]">
              Head-to-Head Comparison
            </span>
            <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl text-[#0B3D2E]">
              Why Urji Fit Leaves Fragmented Apps in the Dust
            </h2>
            <p className="text-sm sm:text-base text-[#5A6660]">
              See how our integrated architecture compares to expensive trainers, generic fitness trackers, and static PDF routines.
            </p>
          </div>

          <div className="overflow-x-auto bg-white rounded-3xl border border-[#14201A]/10 p-4 sm:p-6 shadow-sm">
            <table className="w-full text-left border-collapse min-w-[640px]">
              <thead>
                <tr className="border-b border-[#14201A]/15 text-xs uppercase font-bold tracking-wider text-[#5A6660]">
                  <th className="py-4 px-4">Core Feature</th>
                  <th className="py-4 px-4 bg-[#0B3D2E] text-[#F2F7D9] rounded-t-xl text-center">Urji Fit</th>
                  <th className="py-4 px-4 text-center">Generic App (e.g. MyFitnessPal)</th>
                  <th className="py-4 px-4 text-center">Personal Trainer ($200+/mo)</th>
                  <th className="py-4 px-4 text-center">Static PDF Guides</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#14201A]/10 text-xs sm:text-sm">
                <tr>
                  <td className="py-4 px-4 font-semibold text-[#14201A]">Algorithmic Progressive Overload (+2.5% to +5%)</td>
                  <td className="py-4 px-4 text-center bg-[#0B3D2E]/10 font-bold text-[#0B3D2E]">✓ Automated</td>
                  <td className="py-4 px-4 text-center text-[#5A6660]">✕ Manual notes only</td>
                  <td className="py-4 px-4 text-center text-[#5A6660]">Manual memory</td>
                  <td className="py-4 px-4 text-center text-[#5A6660]">✕ Fixed static text</td>
                </tr>
                <tr>
                  <td className="py-4 px-4 font-semibold text-[#14201A]">Fasting-to-Meal Synchronization</td>
                  <td className="py-4 px-4 text-center bg-[#0B3D2E]/10 font-bold text-[#0B3D2E]">✓ Instant sync</td>
                  <td className="py-4 px-4 text-center text-[#5A6660]">✕ Separate app required</td>
                  <td className="py-4 px-4 text-center text-[#5A6660]">✕ Not monitored</td>
                  <td className="py-4 px-4 text-center text-[#5A6660]">✕ None</td>
                </tr>
                <tr>
                  <td className="py-4 px-4 font-semibold text-[#14201A]">Native Ethiopian & Cultural Staple Macros</td>
                  <td className="py-4 px-4 text-center bg-[#0B3D2E]/10 font-bold text-[#0B3D2E]">✓ Built-in</td>
                  <td className="py-4 px-4 text-center text-[#5A6660]">✕ Inaccurate user estimates</td>
                  <td className="py-4 px-4 text-center text-[#5A6660]">Varies wildly</td>
                  <td className="py-4 px-4 text-center text-[#5A6660]">✕ Western diets only</td>
                </tr>
                <tr>
                  <td className="py-4 px-4 font-semibold text-[#14201A]">Sleep Debt & 60-Min Wind-Down Alerts</td>
                  <td className="py-4 px-4 text-center bg-[#0B3D2E]/10 font-bold text-[#0B3D2E]">✓ Automated</td>
                  <td className="py-4 px-4 text-center text-[#5A6660]">✕ Separate app required</td>
                  <td className="py-4 px-4 text-center text-[#5A6660]">✕ Not monitored</td>
                  <td className="py-4 px-4 text-center text-[#5A6660]">✕ None</td>
                </tr>
                <tr>
                  <td className="py-4 px-4 font-semibold text-[#14201A]">Hardware Single-Device Security Lock</td>
                  <td className="py-4 px-4 text-center bg-[#0B3D2E]/10 font-bold text-[#0B3D2E]">✓ Guaranteed</td>
                  <td className="py-4 px-4 text-center text-[#5A6660]">✕ Vulnerable password</td>
                  <td className="py-4 px-4 text-center text-[#5A6660]">N/A</td>
                  <td className="py-4 px-4 text-center text-[#5A6660]">✕ Pirated PDFs</td>
                </tr>
                <tr>
                  <td className="py-4 px-4 font-semibold text-[#14201A]">Monthly Cost</td>
                  <td className="py-4 px-4 text-center bg-[#0B3D2E]/10 font-bold text-[#0B3D2E]">$7.99 / mo</td>
                  <td className="py-4 px-4 text-center text-[#5A6660]">$19.99 / mo</td>
                  <td className="py-4 px-4 text-center text-red-600 font-bold">$200 – $400 / mo</td>
                  <td className="py-4 px-4 text-center text-[#5A6660]">$49 one-time (stale)</td>
                </tr>
              </tbody>
            </table>
          </div>

        </div>
      </section>

      {/* -------------------------------------------------------------
          8. 3-STEP KICKOFF PROCESS (WARM PARCHMENT DUAL TONE)
      ------------------------------------------------------------- */}
      <section className="py-20 bg-[#EFE9DD] border-y border-[#14201A]/10 text-[#14201A]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <span className="text-xs font-semibold uppercase tracking-widest text-[#0B3D2E]">
              Simple & Frictionless
            </span>
            <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl text-[#0B3D2E]">
              Up and Running in 3 Minutes
            </h2>
            <p className="text-sm sm:text-base text-[#5A6660]">
              No bloated onboarding forms or 50-step surveys. Start logging immediately.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center sm:text-left">
            <div className="p-8 bg-white border border-[#14201A]/10 rounded-3xl space-y-4 relative shadow-sm">
              <div className="w-12 h-12 rounded-2xl bg-[#0B3D2E] text-[#F2F7D9] flex items-center justify-center font-serif text-2xl font-bold mx-auto sm:mx-0">
                1
              </div>
              <h3 className="font-serif text-2xl text-[#0B3D2E]">Input Baseline & Split</h3>
              <p className="text-xs sm:text-sm text-[#5A6660] leading-relaxed">
                Choose one of our 6 global workout splits (Push/Pull/Legs, Upper/Lower, Full Body) or build your custom split in 60 seconds.
              </p>
            </div>

            <div className="p-8 bg-white border border-[#14201A]/10 rounded-3xl space-y-4 relative shadow-sm">
              <div className="w-12 h-12 rounded-2xl bg-[#C1502E] text-white flex items-center justify-center font-serif text-2xl font-bold mx-auto sm:mx-0">
                2
              </div>
              <h3 className="font-serif text-2xl text-[#0B3D2E]">Execute & Log Sets</h3>
              <p className="text-xs sm:text-sm text-[#5A6660] leading-relaxed">
                Log your sets as you lift. Tap complete, record your RPE, and watch the overload engine detect your progress in real time.
              </p>
            </div>

            <div className="p-8 bg-white border border-[#14201A]/10 rounded-3xl space-y-4 relative shadow-sm">
              <div className="w-12 h-12 rounded-2xl bg-emerald-800 text-white flex items-center justify-center font-serif text-2xl font-bold mx-auto sm:mx-0">
                3
              </div>
              <h3 className="font-serif text-2xl text-[#0B3D2E]">Sync Habits & Transform</h3>
              <p className="text-xs sm:text-sm text-[#5A6660] leading-relaxed">
                Fast, fuel with high-protein staples, hit your hydration ring, and wind down on schedule to wake up fully recovered.
              </p>
            </div>
          </div>

        </div>
      </section>

      {/* -------------------------------------------------------------
          9. 30-DAY MONEY-BACK GUARANTEE SEAL (DEEP PINE INSIGNIA)
      ------------------------------------------------------------- */}
      <section className="py-16 bg-[#F7F4EC]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="p-8 sm:p-12 rounded-3xl bg-[#0B3D2E] text-[#F3EFE5] border border-[#F2F7D9]/20 shadow-xl flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left">
            <div className="w-20 h-20 rounded-full bg-[#F2F7D9] text-[#0B3D2E] flex items-center justify-center shrink-0 shadow-md">
              <ShieldCheck className="w-10 h-10" />
            </div>
            <div className="space-y-2">
              <h3 className="font-serif text-2xl sm:text-3xl text-[#F2F7D9] font-medium">
                100% Risk-Free 30-Day Money-Back Guarantee
              </h3>
              <p className="text-xs sm:text-sm text-[#E0EBE4] leading-relaxed">
                Test the progressive overload engine and full habit suite for a full month. If you don’t feel stronger, leaner, and noticeably more disciplined, email support for a full 100% refund. No awkward interrogations or hidden traps.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------------
          10. PRICING & SUBSCRIPTION TIERS (DRAMATIC OBSIDIAN VIP STAGE)
      ------------------------------------------------------------- */}
      <section id="pricing" className="py-20 md:py-28 bg-[#08120E] text-[#EDEAE3] border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <span className="text-xs font-semibold uppercase tracking-widest text-[#F2F7D9]">
              Simple, Transparent Pricing
            </span>
            <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl text-[#F4EFE6]">
              Choose Your Transformation Plan
            </h2>
            <p className="text-sm sm:text-base text-[#A4B5AC]">
              Lock in our early-access 60% promotional discount today. All plans include full access to both Web and Mobile apps.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto items-stretch">
            
            {/* Tier 1: Monthly */}
            <div className="bg-[#112019] border border-white/10 rounded-3xl p-8 flex flex-col justify-between space-y-6 shadow-sm">
              <div className="space-y-4">
                <span className="text-xs uppercase font-bold text-[#A4B5AC] tracking-wider">Month-To-Month</span>
                <div className="flex items-baseline gap-1">
                  <span className="font-serif text-4xl text-white">$19.99</span>
                  <span className="text-xs text-[#A4B5AC]">/ month</span>
                </div>
                <p className="text-xs text-[#A4B5AC]">
                  Full access with monthly flexibility. Cancel anytime with one tap.
                </p>

                <ul className="space-y-3 text-xs pt-4 border-t border-white/10 text-gray-300">
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> Full Web + Mobile Parity</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> Progressive Overload Engine</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> Ethiopian & Global Food Database</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> Fasting Clock + Meal Sync</li>
                </ul>
              </div>

              <Link
                href="/login"
                className="w-full py-3.5 bg-white/10 border border-white/15 hover:bg-white/20 text-white text-xs font-semibold uppercase tracking-wider rounded-2xl text-center transition-colors"
              >
                Start Monthly Plan
              </Link>
            </div>

            {/* Tier 2: Annual VIP (Best Value Anchor - Highlighted) */}
            <div className="bg-gradient-to-b from-[#0F3528] to-[#0A241B] text-[#F2F7D9] rounded-3xl p-8 sm:p-10 flex flex-col justify-between space-y-6 shadow-2xl relative scale-105 border-2 border-[#F2F7D9]/80">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 bg-[#C1502E] text-white text-[10px] uppercase font-bold tracking-widest rounded-full shadow-sm">
                🔥 MOST POPULAR • SAVE 60%
              </div>

              <div className="space-y-4 pt-2">
                <span className="text-xs uppercase font-bold text-emerald-300 tracking-wider">Annual VIP Membership</span>
                <div className="flex items-baseline gap-1">
                  <span className="font-serif text-5xl font-bold text-white">$7.99</span>
                  <span className="text-xs text-[#F2F7D9]/80">/ month</span>
                </div>
                <div className="text-[11px] font-mono text-emerald-300">
                  Billed $95.90 annually (Less than $0.27 / day)
                </div>
                <p className="text-xs text-[#F2F7D9]/80 leading-relaxed">
                  The complete transformation commitment. Includes all future feature releases, advanced analytics, and priority VIP device allocation.
                </p>

                <ul className="space-y-3 text-xs pt-4 border-t border-white/20 text-[#F2F7D9]">
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" /> Everything in Monthly Plan</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" /> 60-Minute Circadian Sleep Notifications</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" /> Mandatory Monthly Check-in Trajectories</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" /> Custom Workout Split Builder</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" /> 30-Day 100% Money-Back Guarantee</li>
                </ul>
              </div>

              <Link
                href="/login"
                className="w-full py-4 bg-[#F2F7D9] text-[#0B3D2E] hover:bg-white text-xs font-bold uppercase tracking-wider rounded-2xl text-center transition-all shadow-md hover:shadow-lg"
              >
                CLAIM 60% OFF — START VIP
              </Link>
            </div>

            {/* Tier 3: 6-Month */}
            <div className="bg-[#112019] border border-white/10 rounded-3xl p-8 flex flex-col justify-between space-y-6 shadow-sm">
              <div className="space-y-4">
                <span className="text-xs uppercase font-bold text-[#A4B5AC] tracking-wider">6-Month Transformation</span>
                <div className="flex items-baseline gap-1">
                  <span className="font-serif text-4xl text-white">$11.99</span>
                  <span className="text-xs text-[#A4B5AC]">/ month</span>
                </div>
                <div className="text-[11px] font-mono text-gray-400">
                  Billed $71.90 every 6 months (Save 40%)
                </div>
                <p className="text-xs text-[#A4B5AC]">
                  The ideal midway commitment for building lasting, automatic habits.
                </p>

                <ul className="space-y-3 text-xs pt-4 border-t border-white/10 text-gray-300">
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> Full Web + Mobile Parity</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> Progressive Overload Engine</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> Fasting & Hydration Tracking</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> 30-Day Money-Back Guarantee</li>
                </ul>
              </div>

              <Link
                href="/login"
                className="w-full py-3.5 bg-white/10 border border-white/15 hover:bg-white/20 text-white text-xs font-semibold uppercase tracking-wider rounded-2xl text-center transition-colors"
              >
                Choose 6-Month Plan
              </Link>
            </div>

          </div>

        </div>
      </section>

      {/* -------------------------------------------------------------
          11. FREQUENTLY ASKED QUESTIONS (WARM LINEN ACCORDION)
      ------------------------------------------------------------- */}
      <section id="faq" className="py-20 md:py-28 bg-[#F7F4EC] text-[#14201A] border-t border-[#14201A]/10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          
          <div className="text-center space-y-3">
            <span className="text-xs font-semibold uppercase tracking-widest text-[#0B3D2E]">
              Got Questions?
            </span>
            <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl text-[#0B3D2E]">
              Frequently Asked Questions
            </h2>
            <p className="text-sm text-[#5A6660]">
              Everything you need to know about Urji Fit, subscriptions, and our progressive overload engine.
            </p>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div
                  key={idx}
                  className="bg-white border border-[#14201A]/10 rounded-2xl overflow-hidden transition-all shadow-xs"
                >
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="w-full p-5 text-left flex items-center justify-between gap-4 font-semibold text-sm sm:text-base text-[#14201A] cursor-pointer hover:text-[#0B3D2E] transition-colors"
                  >
                    <span>{faq.q}</span>
                    <ChevronDown className={`w-4 h-4 text-[#5A6660] shrink-0 transition-transform ${isOpen ? 'rotate-180 text-[#0B3D2E]' : ''}`} />
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-5 text-xs sm:text-sm text-[#5A6660] leading-relaxed border-t border-[#14201A]/5 pt-3 animate-fadeIn">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

        </div>
      </section>

      {/* -------------------------------------------------------------
          12. EXIT-INTENT / LEAD MAGNET BOX (PALE LIME SHIELD)
      ------------------------------------------------------------- */}
      <section className="py-16 bg-[#EFE9DD] border-t border-[#14201A]/10 text-[#14201A]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-[#F2F7D9] border border-[#0B3D2E]/20 rounded-3xl p-8 md:p-12 text-center space-y-6 shadow-md">
            <div className="w-12 h-12 rounded-2xl bg-[#0B3D2E] text-[#F2F7D9] flex items-center justify-center mx-auto shadow-sm">
              <Award className="w-6 h-6" />
            </div>

            <div className="space-y-2 max-w-xl mx-auto">
              <h3 className="font-serif text-3xl text-[#0B3D2E]">
                Download the 7-Day Overload & Macro Cheat Sheet (Free)
              </h3>
              <p className="text-xs sm:text-sm text-[#234B3D]">
                Want to test the methodology first? Get our complete 7-day workout breakdown with rep thresholds and Ethiopian staple macro guides sent to your inbox.
              </p>
            </div>

            {leadSubmitted ? (
              <div className="p-4 bg-white text-[#0B3D2E] rounded-2xl text-xs font-semibold flex items-center justify-center gap-2 max-w-md mx-auto shadow-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Guide sent! Check your inbox in the next 2 minutes.</span>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (leadEmail.trim()) {
                    setLeadSubmitted(true);
                  }
                }}
                className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto"
              >
                <input
                  type="email"
                  required
                  value={leadEmail}
                  onChange={(e) => setLeadEmail(e.target.value)}
                  placeholder="Enter your email address..."
                  className="flex-1 px-4 py-3 bg-white border border-[#0B3D2E]/20 rounded-xl text-xs text-[#14201A] placeholder-[#5A6660] focus:outline-none focus:border-[#0B3D2E] shadow-2xs"
                />
                <button
                  type="submit"
                  className="px-6 py-3 bg-[#0B3D2E] hover:bg-[#135440] text-[#F2F7D9] rounded-xl text-xs font-semibold tracking-wide transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <span>Get Free Guide</span>
                  <Send className="w-3 h-3" />
                </button>
              </form>
            )}

            <div className="text-[11px] text-[#234B3D]">
              🔒 Zero spam. Unsubscribe anytime with one click.
            </div>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------------
          13. FOOTER (DEEP OBSIDIAN PINE)
      ------------------------------------------------------------- */}
      <footer className="bg-[#06150F] text-[#EDEAE3] py-16 border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="space-y-3 md:col-span-2">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#0B3D2E] text-[#F2F7D9] border border-white/10 flex items-center justify-center font-serif text-xl font-bold">
                  U
                </div>
                <span className="font-serif text-2xl text-white font-medium">Urji Fit</span>
              </div>
              <p className="text-xs text-gray-400 max-w-sm leading-relaxed">
                The integrated personal fitness, nutrition, fasting, hydration, and sleep planner designed to eliminate guesswork through algorithmic progressive overload and holistic habit tracking.
              </p>
              <div className="text-xs text-gray-500 pt-2 font-mono">
                System Status: <span className="text-emerald-400 font-bold">All Cloud Engines Operational</span>
              </div>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="font-bold text-white uppercase tracking-wider text-[11px]">System Modules</div>
              <ul className="space-y-2 text-gray-400">
                <li><Link href="/train" className="hover:text-[#F2F7D9] transition-colors">Overload Training Logger</Link></li>
                <li><Link href="/fuel" className="hover:text-[#F2F7D9] transition-colors">Ethiopian & Global Nutrition</Link></li>
                <li><Link href="/fasting" className="hover:text-[#F2F7D9] transition-colors">Circular Fasting Clock</Link></li>
                <li><Link href="/sleep" className="hover:text-[#F2F7D9] transition-colors">Circadian Sleep Recovery</Link></li>
                <li><Link href="/track" className="hover:text-[#F2F7D9] transition-colors">Body Trajectory Audits</Link></li>
              </ul>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="font-bold text-white uppercase tracking-wider text-[11px]">Portal & Security</div>
              <ul className="space-y-2 text-gray-400">
                <li><Link href="/login" className="hover:text-[#F2F7D9] transition-colors">Member Sign In</Link></li>
                <li><Link href="/admin" className="hover:text-[#F2F7D9] transition-colors">Administrator Console</Link></li>
                <li><span className="text-gray-500">Single-Device UUID Enforced</span></li>
                <li><span className="text-gray-500">Supabase 256-Bit TLS Protected</span></li>
                <li><span className="text-gray-500">30-Day Money-Back Guarantee</span></li>
              </ul>
            </div>
          </div>

          <div className="pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between text-xs text-gray-500 gap-4">
            <p>© {new Date().getFullYear()} Urji Fit. All rights reserved.</p>
            <div className="flex items-center gap-6">
              <span className="hover:text-gray-300 transition-colors cursor-pointer">Privacy Policy</span>
              <span className="hover:text-gray-300 transition-colors cursor-pointer">Terms of Service</span>
              <span className="hover:text-gray-300 transition-colors cursor-pointer">Health Disclaimer</span>
            </div>
          </div>

        </div>
      </footer>
    </div>
  );
}
