
import React, { useState, useEffect } from 'react';
import { LayoutDashboard, ShoppingBag, Database, ShieldCheck, ArrowRight, CheckCircle2, Wifi, Globe, Smartphone, Star, Zap, CreditCard, Loader2 } from 'lucide-react';
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
            console.error("Erreur lors de la récupération des plans.");
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
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
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
            <Wifi size={14} /> Solution SaaS Professionnelle
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-7xl font-black tracking-tight leading-[1.1] text-gray-900 dark:text-white">
            Gérez vos tickets WiFi <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-600 to-blue-400">en toute simplicité.</span>
          </h1>
          <p className="text-base md:text-lg text-gray-500 dark:text-gray-400 font-medium max-w-2xl mx-auto leading-relaxed px-4">
            La solution tout-en-un pour les gestionnaires de réseaux WiFi. Importez vos tickets, vendez via le terminal intégré et suivez vos performances en temps réel.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4 w-full max-w-sm mx-auto sm:max-w-none">
            <button 
              onClick={onLoginClick}
              className="w-full sm:w-auto px-8 py-4 bg-primary-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-primary-700 shadow-xl shadow-primary-500/30 transition-all hover:-translate-y-1"
            >
              Démarrer l'essai gratuit
            </button>
            <button 
              onClick={() => {
                  const el = document.getElementById('pricing');
                  el?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="w-full sm:w-auto px-8 py-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
            >
              Voir les tarifs
            </button>
          </div>
        </div>
      </section>

      {/* FEATURES SECTION */}
      <section id="features" className="py-20 md:py-24 bg-gray-50 dark:bg-gray-900/50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12 md:mb-16 space-y-4">
            <h2 className="text-2xl md:text-3xl font-black tracking-tight dark:text-white">Tout ce dont vous avez besoin</h2>
            <p className="text-gray-500 max-w-xl mx-auto text-sm md:text-base">Une suite d'outils puissants conçus pour maximiser votre productivité et simplifier la gestion de votre parc.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            <FeatureCard 
              icon={<Database className="w-6 h-6 text-white" />}
              title="Gestion de Stock"
              desc="Importez vos tickets Mikhmon via CSV. Détection automatique des doublons et gestion centralisée de l'inventaire."
              color="bg-amber-500"
            />
            <FeatureCard 
              icon={<ShoppingBag className="w-6 h-6 text-white" />}
              title="Terminal de Vente"
              desc="Interface de vente ultra-rapide optimisée pour mobile. Génération de reçus et partage WhatsApp en un clic."
              color="bg-primary-500"
            />
            <FeatureCard 
              icon={<LayoutDashboard className="w-6 h-6 text-white" />}
              title="Tableau de Bord"
              desc="Suivez votre chiffre d'affaires, vos ventes et l'état de votre stock en temps réel avec des graphiques clairs."
              color="bg-green-500"
            />
          </div>
        </div>
      </section>

      {/* PRICING SECTION */}
      <section id="pricing" className="py-20 md:py-24 px-6 overflow-hidden relative">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12 md:mb-16 space-y-4">
             <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full text-[10px] font-black uppercase tracking-widest border border-indigo-100 dark:border-indigo-800 mb-2">
                <Zap size={12} /> Tarification Flexible
             </div>
             <h2 className="text-3xl md:text-4xl font-black tracking-tight dark:text-white leading-tight">Des forfaits adaptés à votre croissance</h2>
             <p className="text-gray-500 dark:text-gray-400 max-w-2xl mx-auto font-medium text-sm md:text-base">
                Commencez avec notre essai gratuit de 14 jours. Choisissez ensuite le plan qui correspond à la durée de votre exploitation.
             </p>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
                <Loader2 className="animate-spin text-primary-600" size={40} />
                <p className="text-xs font-black uppercase tracking-widest opacity-40 text-gray-400">Récupération des offres...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 max-w-6xl mx-auto">
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

      {/* BENEFITS SECTION */}
      <section className="py-20 md:py-24 px-6 bg-gray-50 dark:bg-gray-900/30">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center gap-12 lg:gap-16">
          <div className="flex-1 space-y-8">
            <h2 className="text-3xl md:text-4xl font-black tracking-tight leading-tight dark:text-white text-center lg:text-left">
              Conçu pour la performance et la sécurité.
            </h2>
            <div className="space-y-6">
              <BenefitItem 
                title="Synchronisation Cloud" 
                desc="Vos données sont sauvegardées en temps réel et accessibles depuis n'importe quel appareil." 
              />
              <BenefitItem 
                title="Sécurité Avancée" 
                desc="Authentification sécurisée, logs d'activités détaillés et gestion fine des permissions utilisateurs." 
              />
              <BenefitItem 
                title="Multi-Agences" 
                desc="Gerez plusieurs points de vente et équipes depuis une interface unique et centralisée." 
              />
            </div>
          </div>
          <div className="flex-1 w-full max-w-lg">
            <div className="aspect-square bg-gradient-to-br from-gray-100 to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-[3rem] border border-gray-100 dark:border-gray-800 p-8 flex items-center justify-center relative overflow-hidden shadow-2xl">
               <div className="absolute inset-0 bg-[radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:16px_16px] opacity-[0.15]"></div>
               <div className="text-center space-y-4 relative z-10">
                  <div className="w-24 h-24 bg-white dark:bg-gray-800 rounded-3xl shadow-xl flex items-center justify-center mx-auto mb-6 text-primary-600">
                    <ShieldCheck size={48} />
                  </div>
                  <h3 className="text-2xl font-black dark:text-white">Audit & Contrôle</h3>
                  <p className="text-gray-400 text-sm font-medium">Chaque action est enregistrée.<br/>Gardez le contrôle total.</p>
               </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA SECTION */}
      <section className="py-16 md:py-20 px-6">
        <div className="max-w-5xl mx-auto bg-primary-600 rounded-[3rem] p-10 md:p-20 text-center text-white relative overflow-hidden shadow-2xl shadow-primary-600/30">
          <div className="absolute top-0 right-0 p-12 opacity-10 transform translate-x-1/3 -translate-y-1/3 pointer-events-none">
             <Globe size={300} />
          </div>
          
          <div className="relative z-10 space-y-8">
            <h2 className="text-3xl lg:text-5xl font-black tracking-tight leading-tight">Prêt à optimiser votre business ?</h2>
            <p className="text-primary-100 text-base md:text-lg font-medium max-w-2xl mx-auto">
              Rejoignez les professionnels qui utilisent Gesta Wifi pour gérer leur distribution de tickets.
            </p>
            <button 
              onClick={onLoginClick}
              className="w-full sm:w-auto px-10 py-5 bg-white text-primary-600 rounded-2xl font-black text-sm uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl"
            >
              Commencer maintenant
            </button>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-12 bg-white dark:bg-gray-950 border-t border-gray-100 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6 text-sm font-medium text-gray-500">
          <div className="flex items-center gap-2">
             <div className="w-6 h-6 bg-gray-200 dark:bg-gray-800 rounded-lg flex items-center justify-center text-xs font-black">G</div>
             <span>© 2025 Gesta Wifi SaaS.</span>
          </div>
          <div className="flex gap-6 md:gap-8 text-xs md:text-sm">
            <span className="text-gray-300 dark:text-gray-700 cursor-not-allowed select-none">Support</span>
            <span className="text-gray-300 dark:text-gray-700 cursor-not-allowed select-none">Confidentialité</span>
            <span className="text-gray-300 dark:text-gray-700 cursor-not-allowed select-none">CGU</span>
          </div>
        </div>
      </footer>

    </div>
  );
};

const FeatureCard = ({ icon, title, desc, color }: any) => (
  <div className="p-8 rounded-[2rem] bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 hover:border-primary-100 dark:hover:border-primary-900 transition-all hover:shadow-xl hover:shadow-gray-100/50 dark:hover:shadow-none group">
    <div className={`w-14 h-14 ${color} rounded-2xl flex items-center justify-center mb-6 shadow-lg transform group-hover:scale-110 transition-transform duration-300`}>
      {icon}
    </div>
    <h3 className="text-xl font-black mb-3 dark:text-white">{title}</h3>
    <p className="text-gray-500 text-sm leading-relaxed font-medium">{desc}</p>
  </div>
);

const PricingCard = ({ title, price, currency, duration, features, onAction, isPopular, icon }: any) => (
  <div className={`p-8 md:p-10 rounded-[3rem] flex flex-col justify-between border-2 transition-all duration-500 hover:translate-y-[-8px] relative ${isPopular ? 'bg-primary-600 text-white border-primary-500 shadow-2xl shadow-primary-600/20' : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 hover:border-primary-200 dark:hover:border-primary-800'}`}>
    {isPopular && (
        <div className="absolute top-0 right-10 -translate-y-1/2 px-4 py-1.5 bg-indigo-500 text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-xl">
            Populaire
        </div>
    )}
    
    <div>
        <div className="flex items-center gap-3 mb-6">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner ${isPopular ? 'bg-white/10' : 'bg-gray-50 dark:bg-gray-900'}`}>
                {icon}
            </div>
            <h3 className="text-xl font-black tracking-tight">{title}</h3>
        </div>
        
        <div className="mb-8">
            <div className="flex items-baseline gap-1">
                <span className="text-3xl md:text-4xl font-black tracking-tighter">{price}</span>
                <span className="text-sm font-bold opacity-60 uppercase">{currency}</span>
            </div>
            <p className={`text-[10px] font-black uppercase tracking-widest mt-1 opacity-70`}>Valide {duration}</p>
        </div>
        
        <ul className="space-y-4 mb-10">
            {features.map((f: string, i: number) => (
                <li key={i} className="flex items-center gap-3 text-sm font-medium">
                    <CheckCircle2 size={18} className={isPopular ? 'text-white' : 'text-primary-500'} />
                    <span className={isPopular ? 'opacity-90' : 'text-gray-500 dark:text-gray-400'}>{f}</span>
                </li>
            ))}
        </ul>
    </div>
    
    <button 
        onClick={onAction}
        className={`w-full py-5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 shadow-lg ${isPopular ? 'bg-white text-primary-600 hover:bg-gray-50' : 'bg-primary-600 text-white hover:bg-primary-700 shadow-primary-500/20'}`}
    >
        Choisir ce forfait
    </button>
  </div>
);

const BenefitItem = ({ title, desc }: any) => (
  <div className="flex gap-4">
    <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 flex items-center justify-center shrink-0 mt-1">
      <CheckCircle2 size={16} strokeWidth={3} />
    </div>
    <div>
      <h4 className="text-lg font-black dark:text-white mb-1">{title}</h4>
      <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
    </div>
  </div>
);

export default LandingPage;
