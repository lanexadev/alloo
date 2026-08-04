"use client";

import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useRouter } from "next/navigation";
import { useState, useCallback } from "react";
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useTransform,
} from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  MessageSquare,
  Users,
  Sparkles,
  ArrowRight,
  Send,
  Link2,
  QrCode,
  Zap,
  Heart,
  Shield,
} from "lucide-react";

const slides = [
  {
    title: "Juste discuter.",
    subtitle: "Rien d'autre.",
    description:
      "Messages privés et groupes dans ton navigateur. Pas de bots, pas de channels, pas de bruit. Une seule chose, faite parfaitement.",
    gradient: "from-violet-500/20 via-transparent to-transparent",
    darkGradient: "dark:from-violet-500/10",
    accentColor: "text-violet-600 dark:text-violet-400",
    illustration: ChatIllustration,
  },
  {
    title: "Invite tes amis.",
    subtitle: "En 10 secondes.",
    description:
      "Partage un lien ou scanne un QR code. Tes potes s'inscrivent et rejoignent le groupe instantanément. Zéro friction.",
    gradient: "from-pink-500/20 via-transparent to-transparent",
    darkGradient: "dark:from-pink-500/10",
    accentColor: "text-pink-600 dark:text-pink-400",
    illustration: InviteIllustration,
  },
  {
    title: "Simple.",
    subtitle: "Rapide. Privé.",
    description:
      "Pas de tracking, pas de pubs, pas de features inutiles. Ton espace de conversation, sans compromis. Bienvenue sur Alloo.",
    gradient: "from-blue-500/20 via-transparent to-transparent",
    darkGradient: "dark:from-blue-500/10",
    accentColor: "text-blue-600 dark:text-blue-400",
    illustration: PrivacyIllustration,
  },
];

const SWIPE_THRESHOLD = 50;

export default function OnboardingPage() {
  const { user, isLoading } = useCurrentUser();
  const completeOnboarding = useMutation(api.users.completeOnboarding);
  const router = useRouter();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [direction, setDirection] = useState(0);
  const dragX = useMotionValue(0);

  if (!isLoading && user?.onboardingCompleted) {
    router.replace("/chat");
    return null;
  }
  if (!isLoading && user && !user.username) {
    router.replace("/setup-profile");
    return null;
  }

  const goTo = useCallback(
    (index: number) => {
      setDirection(index > currentSlide ? 1 : -1);
      setCurrentSlide(index);
    },
    [currentSlide]
  );

  const handleNext = async () => {
    if (currentSlide < slides.length - 1) {
      goTo(currentSlide + 1);
    } else {
      await completeOnboarding();
      router.replace("/chat");
    }
  };

  const handleSkip = async () => {
    await completeOnboarding();
    router.replace("/chat");
  };

  const handleDragEnd = (_: any, info: { offset: { x: number } }) => {
    if (info.offset.x < -SWIPE_THRESHOLD && currentSlide < slides.length - 1) {
      goTo(currentSlide + 1);
    } else if (info.offset.x > SWIPE_THRESHOLD && currentSlide > 0) {
      goTo(currentSlide - 1);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const slide = slides[currentSlide];
  const Illustration = slide.illustration;
  const isLast = currentSlide === slides.length - 1;
  const progress = ((currentSlide + 1) / slides.length) * 100;

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-background">
      {/* Background gradient */}
      <div
        className={`pointer-events-none absolute inset-0 bg-gradient-to-b ${slide.gradient} ${slide.darkGradient} transition-all duration-700`}
      />

      {/* Top bar */}
      <div className="relative z-10 flex items-center justify-between px-6 pt-6 md:px-12 md:pt-10">
        {/* Progress bar */}
        <div className="h-1 w-24 overflow-hidden rounded-full bg-muted md:w-32">
          <motion.div
            className="h-full rounded-full bg-foreground"
            animate={{ width: `${progress}%` }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          />
        </div>
        <button
          onClick={handleSkip}
          className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Passer
        </button>
      </div>

      {/* Main content — swipable */}
      <div className="relative z-10 flex flex-1 items-center justify-center px-6 md:px-12">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentSlide}
            custom={direction}
            initial={{ opacity: 0, x: direction * 200, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: direction * -200, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.2}
            onDragEnd={handleDragEnd}
            style={{ x: dragX }}
            className="flex w-full max-w-lg flex-col items-center gap-10 md:max-w-2xl md:flex-row md:gap-16"
          >
            {/* Illustration */}
            <div className="flex w-full items-center justify-center md:w-1/2">
              <Illustration />
            </div>

            {/* Text */}
            <div className="w-full text-center md:w-1/2 md:text-left">
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="text-4xl font-bold tracking-tight md:text-5xl"
              >
                {slide.title}
                <br />
                <span className={slide.accentColor}>{slide.subtitle}</span>
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="mt-4 text-sm leading-relaxed text-muted-foreground md:text-base"
              >
                {slide.description}
              </motion.p>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom controls */}
      <div className="relative z-10 flex flex-col items-center gap-5 px-6 pb-10 md:px-12 md:pb-12">
        {/* Dots */}
        <div className="flex items-center gap-2">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className="relative p-1"
            >
              <motion.div
                className="rounded-full"
                animate={{
                  width: i === currentSlide ? 24 : 8,
                  height: 8,
                  backgroundColor:
                    i === currentSlide
                      ? "var(--foreground)"
                      : "color-mix(in oklch, var(--foreground) 20%, transparent)",
                }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
              />
            </button>
          ))}
        </div>

        {/* CTA */}
        <motion.div
          className="w-full max-w-sm"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Button onClick={handleNext} className="w-full" size="lg">
            {isLast ? (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Commencer à discuter
              </>
            ) : (
              <>
                Suivant
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </motion.div>
      </div>
    </div>
  );
}

/* ─── Illustrations ─── */

function ChatIllustration() {
  return (
    <div className="relative h-56 w-56 md:h-64 md:w-64">
      {/* Phone frame */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, type: "spring" }}
        className="absolute inset-2 rounded-3xl border border-border bg-card shadow-2xl shadow-violet-500/10"
      >
        {/* Header */}
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <div className="h-6 w-6 rounded-full bg-violet-500/20" />
          <div className="h-2.5 w-16 rounded-full bg-muted" />
        </div>
        {/* Messages */}
        <div className="space-y-2.5 p-4">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="flex justify-start"
          >
            <div className="rounded-2xl rounded-bl-md bg-muted px-3.5 py-2">
              <div className="h-2 w-20 rounded-full bg-muted-foreground/30" />
            </div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6 }}
            className="flex justify-end"
          >
            <div className="rounded-2xl rounded-br-md bg-violet-600 px-3.5 py-2">
              <div className="h-2 w-24 rounded-full bg-white/40" />
            </div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.8 }}
            className="flex justify-start"
          >
            <div className="rounded-2xl rounded-bl-md bg-muted px-3.5 py-2">
              <div className="h-2 w-14 rounded-full bg-muted-foreground/30" />
            </div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 1 }}
            className="flex justify-end"
          >
            <div className="rounded-2xl rounded-br-md bg-violet-600 px-3.5 py-2">
              <div className="h-2 w-16 rounded-full bg-white/40" />
            </div>
          </motion.div>
        </div>
      </motion.div>
      {/* Floating icons */}
      <motion.div
        animate={{ y: [-4, 4, -4] }}
        transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
        className="absolute -right-2 top-4 rounded-xl bg-violet-100 p-2.5 shadow-lg dark:bg-violet-900/50"
      >
        <MessageSquare className="h-5 w-5 text-violet-600 dark:text-violet-400" />
      </motion.div>
      <motion.div
        animate={{ y: [3, -3, 3] }}
        transition={{
          repeat: Infinity,
          duration: 2.5,
          ease: "easeInOut",
          delay: 0.5,
        }}
        className="absolute -left-2 bottom-12 rounded-xl bg-violet-100 p-2 shadow-lg dark:bg-violet-900/50"
      >
        <Send className="h-4 w-4 text-violet-600 dark:text-violet-400" />
      </motion.div>
    </div>
  );
}

function InviteIllustration() {
  return (
    <div className="relative h-56 w-56 md:h-64 md:w-64">
      {/* Central card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1, type: "spring" }}
        className="absolute inset-4 flex flex-col items-center justify-center rounded-3xl border border-border bg-card shadow-2xl shadow-pink-500/10"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
          className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-pink-100 dark:bg-pink-900/40"
        >
          <Link2 className="h-7 w-7 text-pink-600 dark:text-pink-400" />
        </motion.div>
        <div className="h-2 w-20 rounded-full bg-muted" />
        <div className="mt-2 h-1.5 w-28 rounded-full bg-muted-foreground/15" />
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="mt-4 rounded-lg bg-pink-600 px-4 py-1.5"
        >
          <div className="h-2 w-12 rounded-full bg-white/50" />
        </motion.div>
      </motion.div>
      {/* Orbiting avatars */}
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5 + i * 0.15, type: "spring" }}
          className="absolute"
          style={{
            top: `${20 + Math.sin((i * Math.PI * 2) / 3) * 35}%`,
            left: `${50 + Math.cos((i * Math.PI * 2) / 3) * 45}%`,
            transform: "translate(-50%, -50%)",
          }}
        >
          <motion.div
            animate={{ y: [-3, 3, -3] }}
            transition={{
              repeat: Infinity,
              duration: 2 + i * 0.3,
              delay: i * 0.4,
            }}
            className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-card bg-pink-100 shadow-md dark:bg-pink-900/50"
          >
            <Users className="h-4 w-4 text-pink-600 dark:text-pink-400" />
          </motion.div>
        </motion.div>
      ))}
      <motion.div
        animate={{ y: [4, -4, 4] }}
        transition={{ repeat: Infinity, duration: 2.8 }}
        className="absolute -left-1 top-6 rounded-xl bg-pink-100 p-2 shadow-lg dark:bg-pink-900/50"
      >
        <QrCode className="h-4 w-4 text-pink-600 dark:text-pink-400" />
      </motion.div>
    </div>
  );
}

function PrivacyIllustration() {
  return (
    <div className="relative h-56 w-56 md:h-64 md:w-64">
      {/* Shield */}
      <motion.div
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
        className="absolute inset-6 flex items-center justify-center rounded-3xl border border-border bg-card shadow-2xl shadow-blue-500/10"
      >
        <motion.div
          initial={{ scale: 0, rotate: -30 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: 0.3, type: "spring" }}
        >
          <Shield className="h-16 w-16 text-blue-600/20 dark:text-blue-400/20" />
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.6, type: "spring" }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <Zap className="h-8 w-8 text-blue-600 dark:text-blue-400" />
          </motion.div>
        </motion.div>
      </motion.div>
      {/* Floating elements */}
      <motion.div
        animate={{ y: [-5, 5, -5], rotate: [0, 5, 0] }}
        transition={{ repeat: Infinity, duration: 3 }}
        className="absolute -right-1 top-8 rounded-xl bg-blue-100 p-2.5 shadow-lg dark:bg-blue-900/50"
      >
        <Zap className="h-4 w-4 text-blue-600 dark:text-blue-400" />
      </motion.div>
      <motion.div
        animate={{ y: [3, -3, 3] }}
        transition={{ repeat: Infinity, duration: 2.5, delay: 0.3 }}
        className="absolute -left-1 bottom-16 rounded-xl bg-blue-100 p-2 shadow-lg dark:bg-blue-900/50"
      >
        <Heart className="h-4 w-4 text-blue-600 dark:text-blue-400" />
      </motion.div>
      {/* Checkmarks */}
      {["Pas de tracking", "Pas de pubs", "Open source"].map((text, i) => (
        <motion.div
          key={text}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.7 + i * 0.15 }}
          className="absolute right-0 flex items-center gap-1.5"
          style={{ top: `${65 + i * 14}%` }}
        >
          <div className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-600">
            <svg
              className="h-2.5 w-2.5 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={3}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <span className="text-[10px] font-medium text-muted-foreground">
            {text}
          </span>
        </motion.div>
      ))}
    </div>
  );
}
