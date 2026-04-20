import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { CheckCircle2, Calendar, Star, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function HomePage() {
  return (
    <div className="flex flex-col">
      {/* Hero Section — увеличен на 30% */}
      <section className="relative overflow-hidden bg-slate-950 text-white pt-32 pb-44">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/40 to-slate-900/90" />
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1601362840469-51e4d8d58785?auto=format&fit=crop&q=80')] bg-cover bg-center opacity-30 mix-blend-overlay" />

        <div className="container relative z-10 mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="max-w-3xl mx-auto"
          >
            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-cyan-300">
              Премиальный уход за вашим автомобилем
            </h1>
            <p className="text-lg md:text-xl text-slate-300 mb-10 leading-relaxed">
              Запишитесь на мойку онлайн за пару кликов. Ручная мойка или робот — выбирайте то, что подходит именно вам.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button size="lg" className="w-full sm:w-auto h-14 px-8 text-lg rounded-full bg-blue-600 hover:bg-blue-500 transition-all shadow-[0_0_20px_rgba(37,99,235,0.4)]" asChild>
                <Link to="/booking">
                  Записаться сейчас <ChevronRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="w-full sm:w-auto h-14 px-8 text-lg rounded-full bg-white/10 text-white border-white/20 hover:bg-white/20 backdrop-blur-sm" asChild>
                <Link to="/booking">Наши услуги</Link>
              </Button>
            </div>
          </motion.div>
        </div>

        {/* Единая глубокая волна без разрыва */}
        <div className="absolute bottom-0 left-0 w-full overflow-hidden leading-none">
          <svg className="relative block w-full h-[80px] md:h-[150px]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 100" preserveAspectRatio="none">
            <path
              d="M0,0 C360,150 720,0 1080,80 C1260,110 1380,50 1440,20 L1440,100 L0,100 Z"
              className="fill-background"
            />
          </svg>
        </div>
      </section>

      {/* Features — быстрые анимации */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <FeatureCard
              icon={<Calendar className="h-10 w-10 text-blue-500" />}
              title="Онлайн запись 24/7"
              description="Выбирайте удобное время и бокс. Никаких звонков и ожиданий в очередях."
              delay={0}
            />
            <FeatureCard
              icon={<CheckCircle2 className="h-10 w-10 text-blue-500" />}
              title="Ручная мойка и Робот"
              description="Два формата на выбор: классическая ручная мойка с доп. услугами или быстрый робот за 15 минут."
              delay={0.05}
            />
            <FeatureCard
              icon={<Star className="h-10 w-10 text-blue-500" />}
              title="Бонусная система"
              description="Кэшбек с каждой мойки. Копите баллы и оплачивайте ими до 100% стоимости услуг."
              delay={0.1}
            />
          </div>
        </div>
      </section>
    </div>
  );
}

function FeatureCard({ icon, title, description, delay }: { icon: React.ReactNode; title: string; description: string; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      whileHover={{ y: -5, transition: { duration: 0.15 } }}
      className="p-8 rounded-2xl bg-white border border-slate-100 shadow-xl shadow-slate-200/50 flex flex-col items-center text-center"
    >
      <div className="h-20 w-20 rounded-full bg-blue-50 flex items-center justify-center mb-6">
        {icon}
      </div>
      <h3 className="text-xl font-bold text-slate-900 mb-3">{title}</h3>
      <p className="text-slate-600 leading-relaxed">{description}</p>
    </motion.div>
  );
}
