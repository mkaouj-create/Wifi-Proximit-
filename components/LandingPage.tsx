import React, { useState, useEffect } from 'react';
import { LayoutDashboard, ShoppingBag, Database, ShieldCheck, ArrowRight, CheckCircle2, Wifi, Globe, Smartphone, Star, Zap, CreditCard, Loader2, Users } from 'lucide-react';
import { supabase } from '../services/supabase';
import { SubscriptionPlan } from '../types';

interface LandingPageProps {
  onLoginClick: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onLoginClick }) => {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPlans = async () => {
        try {
            const data = await supabase.getSubscriptionPlans();
            setPlans(data);
        } catch (e) {
            console.error("Erreur de chargement des offres.");
        } finally {
            setLoading(false);
        }
    };
    fetchPlans();
  }, []);

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 font-inter text-gray-900 dark:text-gray-100 selection:bg-primary-100 selection:text-primary-700">
      
      {/* HEADER */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-gray-950/80 backdrop-blur-md border-b border-gray-100 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 md:px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-lg shadow-primary-500/20">G</div>
            <span className="font-black text-lg tracking-tight dark:text-white">Gesta <span className="text-primary-600">Wifi</span></span>
          </div>
          <button 
            onClick={onLoginClick}
            className="px-6 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-xl font-bold text-sm hover:scale-105 active:scale-95 transition-all shadow-xl"
          >
            Se connecter
          </button>
        </div>
      </header>

      {/* HERO SECTION */}
      <section className="pt-32 pb-16 lg:pt-52 lg:pb-32 px-4 md:px-6 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-primary-500/10 rounded-full blur-[120px] -z-10" />
        
        <div className="max-w-4xl mx-auto text-center space-y-6 md:space-y-8 animate-in slide-in-from-bottom-8 duration-700">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-full text-[10px] md:text-xs font-black uppercase tracking-widest border border-primary-100 dark:border-primary-800">
            <Wifi size={14} /> La référence pour la gestion WiFi
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-7xl font-black tracking-tight leading-[1.1] text-gray-900 dark:text-white">
            Optimisez la gestion <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-600 to-blue-400">de vos tickets.</span>
          </h1>
          <p className="text-base md:text-lg text-gray-500 dark:text-gray-400 font-medium max-w-2xl mx-auto leading-relaxed px-4">
            Importation Mikhmon instantanée, terminal de vente mobile et rapports financiers automatiques. Gérez votre parc WiFi avec une infrastructure cloud robuste.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4 w-full max-w-sm mx-auto sm:max-w-none px-4">
            <button 
              onClick={onLoginClick}
              className="w-full sm:w-auto px-10 py-5 bg-primary-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-primary-700 shadow-2xl shadow-primary-500/40 transition-all hover:-translate-y-1 active:scale-95"
            >
              Démarrer maintenant
            </button>
            <button 
              onClick={() => {
                  const el = document.getElementById('features');
                  el?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="w-full sm:w-auto px-10 py-5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-gray-50 dark:hover:bg-gray-700 transition-all shadow-sm"
            >
              En savoir plus
            </button>
          </div>
        </div>
      </section>

      {/* FEATURES SECTION */}
      <section id="features" className="py-20 md:py-32 bg-gray-50 dark:bg-gray-900/50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-3xl md:text-4xl font-black tracking-tight dark:text-white uppercase leading-none">Puissance & Performance</h2>
            <p className="text-gray-500 max-w-xl mx-auto text-sm md:text-base font-medium">Une suite d'outils professionnels pour maximiser vos revenus WiFi.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-10">
            <FeatureCard 
              icon={<Database className="w-6 h-6 text-white" />}
              title="Inventaire Cloud"
              desc="Synchronisation temps-réel de votre stock. Importation intelligente des exports Mikhmon en moins de 2 secondes."
              color="bg-amber-500"
            />
            <FeatureCard 
              icon={<ShoppingBag className="w-6 h-6 text-white" />}
              title="Vente Nomade"
              desc="Interface de vente ultra-légère conçue pour le mobile. Génération de reçus PDF et partage WhatsApp direct."
              color="bg-primary-500"
            />
            <FeatureCard 
              icon={<ShieldCheck className="w-6 h-6 text-white" />}
              title="Traçabilité Totale"
              desc="Historique complet des ventes et logs d'audit système. Assurez une transparence comptable irréprochable."
              color="bg-green-500"
            />
          </div>
        </div>
      </section>

      {/* PRICING SECTION */}
      <section id="pricing" className="py-24 px-4 md:px-6 relative">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16 space-y-4">
             <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full text-[10px] font-black uppercase tracking-widest border border-indigo-100 dark:border-indigo-800 mb-2">
                <Zap size={12} /> Licences Professionnelles
             </div>
             <h2 className="text-3xl md:text-5xl font-black tracking-tight dark:text-white leading-tight uppercase">Des tarifs sans surprise</h2>
             <p className="text-gray-500 dark:text-gray-400 max-w-2xl mx-auto font-medium text-sm md:text-base px-2">
                Aucun abonnement caché. Choisissez votre pack et profitez de l'intégralité des fonctionnalités cloud Gesta Wifi.
             </p>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
                <Loader2 className="animate-spin text-primary-600" size={48} />
                <p className="text-xs font-black uppercase tracking-widest text-gray-400">Préparation des offres...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
                {plans.map(plan => (
                    <PricingCard 
                        key={plan.id}
                        title={plan.name}
                        price={plan.price.toLocaleString()}
                        currency={plan.currency}
                        duration={`${plan.months} Mois`}
                        features={plan.features}
                        onAction={onLoginClick}
                        isPopular={plan.is_popular}
                        icon={plan.name.toLowerCase().includes('starter') ? <Star className="text-amber-500" /> : plan.is_popular ? <Zap className="text-indigo-500" /> : <CreditCard className="text-green-500" />}
                    />
                ))}
            </div>
          )}
        </div>
      </section>

      {/* TRUST SECTION */}
      <section className="py-24 px-6 bg-gray-50 dark:bg-gray-900/40 overflow-hidden">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center gap-16 lg:gap-20">
          <div className="flex-1 space-y-10 text-center lg:text-left">
            <div className="space-y-4">
              <h2 className="text-3xl md:text-5xl font-black tracking-tight leading-none dark:text-white uppercase">
                Gérez votre agence <br className="hidden md:block"/> en toute autonomie.
              </h2>
              <p className="text-gray-500 dark:text-gray-400 font-medium">Conçu pour les entrepreneurs qui exigent stabilité et sécurité.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 text-left">
              <BenefitItem 
                title="Accès Vendeurs" 
                desc="Créez des accès restreints pour votre personnel de vente." 
                icon={<Users size={20} />}
              />
              <BenefitItem 
                title="Logs d'audit" 
                desc="Suivez chaque opération pour prévenir les erreurs et fraudes." 
                icon={<ShieldCheck size={20} />}
              />
              <BenefitItem 
                title="Optimisation Mobile" 
                desc="L'application est 100% responsive pour un usage fluide sur le terrain." 
                icon={<Zap size={20} />}
              />
              <BenefitItem 
                title="Backup automatique" 
                desc="Vos données sont sécurisées et sauvegardées quotidiennement." 
                icon={<Database size={20} />}
              />
            </div>
          </div>
          <div className="flex-1 w-full max-w-md hidden lg:block">
            <div className="relative aspect-square">
               <div className="absolute inset-0 bg-primary-600 rounded-[4rem] rotate-3 opacity-10 animate-pulse"></div>
               <div className="relative h-full bg-white dark:bg-gray-800 rounded-[4rem] border border-gray-100 dark:border-gray-700 p-12 flex flex-col items-center justify-center shadow-2xl space-y-6">
                  <div className="w-24 h-24 bg-primary-50 dark:bg-primary-900/30 text-primary-600 rounded-3xl flex items-center justify-center shadow-inner">
                    <Smartphone size={48} />
                  </div>
                  <div className="text-center">
                    <h3 className="text-2xl font-black dark:text-white uppercase">Multi-Plateforme</h3>
                    <p className="text-gray-500 dark:text-gray-400 text-sm font-medium leading-relaxed mt-2">Pilotez votre business depuis <br/> votre PC, tablette ou smartphone.</p>
                  </div>
               </div>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-16 bg-white dark:bg-gray-950 border-t border-gray-100 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-6 text-center space-y-8">
          <div className="flex items-center justify-center gap-3">
             <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-md">G</div>
             <span className="font-black text-xl uppercase tracking-tighter dark:text-white">Gesta Wifi</span>
          </div>
          <div className="flex flex-wrap justify-center gap-8 text-[11px] font-black uppercase tracking-widest text-gray-400">
            <a href="#" className="hover:text-primary-600 transition-colors">Accueil</a>
            <a href="#" className="hover:text-primary-600 transition-colors">Tarifs</a>
            <a href="#" className="hover:text-primary-600 transition-colors">Aide</a>
            <a href="#" className="hover:text-primary-600 transition-colors">Mentions légales</a>
          </div>
          <div className="pt-8 border-t border-gray-50 dark:border-gray-900">
             <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">© 2025 GESTA WIFI SAAS - SOLUTION DE GESTION PROFESSIONNELLE</p>
          </div>
        </div>
      </footer>

    </div>
  );
};

const FeatureCard = ({ icon, title, desc, color }: any) => (
  <div className="p-10 rounded-[2.5rem] bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 hover:border-primary-200 dark:hover:border-primary-900 transition-all hover:shadow-2xl hover:shadow-gray-200/50 dark:hover:shadow-none group flex flex-col items-center md:items-start text-center md:text-left">
    <div className={`w-16 h-16 ${color} rounded-2xl flex items-center justify-center mb-8 shadow-xl transform group-hover:scale-110 transition-transform duration-500`}>
      {icon}
    </div>
    <h3 className="text-2xl font-black mb-4 dark:text-white uppercase tracking-tight">{title}</h3>
    <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed font-medium">{desc}</p>
  </div>
);

const PricingCard = ({ title, price, currency, duration, features, onAction, isPopular, icon }: any) => (
  <div className={`p-10 rounded-[3rem] flex flex-col justify-between border-2 transition-all duration-500 hover:translate-y-[-10px] relative ${isPopular ? 'bg-primary-600 text-white border-primary-500 shadow-2xl shadow-primary-600/30' : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 hover:border-primary-200 dark:hover:border-primary-800'}`}>
    {isPopular && (
        <div className="absolute top-0 right-1/2 translate-x-1/2 -translate-y-1/2 px-5 py-2 bg-indigo-500 text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-2xl border-4 border-white dark:border-gray-800">
            Recommandé
        </div>
    )}
    
    <div>
        <div className="flex items-center gap-4 mb-10">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner ${isPopular ? 'bg-white/20' : 'bg-gray-50 dark:bg-gray-900'}`}>
                {icon}
            </div>
            <h3 className="text-2xl font-black uppercase tracking-tight">{title}</h3>
        </div>
        
        <div className="mb-10">
            <div className="flex items-baseline gap-2">
                <span className="text-4xl md:text-5xl font-black tracking-tighter">{price}</span>
                <span className="text-sm font-bold opacity-70 uppercase tracking-widest">{currency}</span>
            </div>
            <p className={`text-[11px] font-black uppercase tracking-widest mt-2 opacity-60`}>Validité: {duration}</p>
        </div>
        
        <ul className="space-y-5 mb-12">
            {features.map((f: string, i: number) => (
                <li key={i} className="flex items-start gap-3 text-sm font-medium leading-tight">
                    <div className={`mt-0.5 shrink-0 ${isPopular ? 'text-white' : 'text-primary-500'}`}><CheckCircle2 size={18} /></div>
                    <span className={isPopular ? 'opacity-90' : 'text-gray-500 dark:text-gray-400'}>{f}</span>
                </li>
            ))}
        </ul>
    </div>
    
    <button 
        onClick={onAction}
        className={`w-full py-5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 shadow-xl ${isPopular ? 'bg-white text-primary-600 hover:bg-gray-50' : 'bg-primary-600 text-white hover:bg-primary-700 shadow-primary-500/20'}`}
    >
        Choisir ce pack
    </button>
  </div>
);

const BenefitItem = ({ title, desc, icon }: any) => (
  <div className="flex gap-5 items-start">
    <div className="w-12 h-12 rounded-2xl bg-white dark:bg-gray-800 border dark:border-gray-700 text-primary-600 flex items-center justify-center shrink-0 shadow-sm">
      {icon}
    </div>
    <div>
      <h4 className="text-lg font-black dark:text-white mb-1 uppercase leading-none">{title}</h4>
      <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed font-medium">{desc}</p>
    </div>
  </div>
);

export default LandingPage;
