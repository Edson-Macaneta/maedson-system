import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  History, 
  Plus, 
  Minus, 
  Square, 
  X as CloseIcon, 
  Search,
  Filter,
  FileText,
  Printer,
  Calendar,
  LogOut,
  User as UserIcon,
  Cloud
} from 'lucide-react';
import { Transaction, AIAnalysisResult, ReportFilters, PGC_CATEGORIES } from './types';
import SummaryCard from './components/SummaryCard';
import TransactionModal from './components/TransactionModal';
import Charts from './components/Charts';
import AnalysisPanel from './components/AnalysisPanel';
import { analyzeTransactions } from './services/geminiService';

// Firebase imports
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginScreen from './components/LoginScreen';
import { db } from './firebaseConfig';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  deleteDoc, 
  doc, 
  orderBy 
} from 'firebase/firestore';

const AuthenticatedApp: React.FC = () => {
  const { user, logout } = useAuth();
  
  // State
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'history' | 'reports'>('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Report Filters
  const [reportFilters, setReportFilters] = useState<ReportFilters>({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0], 
    endDate: new Date().toISOString().split('T')[0],
    type: 'all',
    category: 'all'
  });

  const [aiState, setAiState] = useState<AIAnalysisResult>({
    analysis: '',
    loading: false,
    error: null,
  });

  // Firestore Subscription
  useEffect(() => {
    if (!user || !db) return;

    const q = query(
      collection(db, "transactions"),
      where("userId", "==", user.uid),
      orderBy("date", "desc")
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const txs: Transaction[] = [];
      querySnapshot.forEach((doc) => {
        txs.push({ id: doc.id, ...doc.data() } as Transaction);
      });
      setTransactions(txs);
      setLoadingTransactions(false);
    }, (error) => {
      console.error("Erro ao buscar transações:", error);
      setLoadingTransactions(false);
    });

    return () => unsubscribe();
  }, [user]);

  // Derived State
  const summary = React.useMemo(() => {
    const income = transactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
    const expense = transactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
    return {
      totalIncome: income,
      totalExpense: expense,
      balance: income - expense
    };
  }, [transactions]);

  const filteredTransactions = transactions
    .filter(t => t.description.toLowerCase().includes(searchQuery.toLowerCase()) || t.category.toLowerCase().includes(searchQuery.toLowerCase()));

  // Logic for Reports Tab
  const reportData = React.useMemo(() => {
    return transactions.filter(t => {
      const tDate = new Date(t.date).getTime();
      const sDate = new Date(reportFilters.startDate).getTime();
      const eDateObj = new Date(reportFilters.endDate);
      eDateObj.setHours(23, 59, 59, 999);
      const eDate = eDateObj.getTime();

      const dateMatch = tDate >= sDate && tDate <= eDate;
      const typeMatch = reportFilters.type === 'all' || t.type === reportFilters.type;
      const catMatch = reportFilters.category === 'all' || t.category === reportFilters.category;

      return dateMatch && typeMatch && catMatch;
    }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [transactions, reportFilters]);

  // Handlers
  const handleAddTransaction = async (newTx: Omit<Transaction, 'id'>) => {
    if (!user || !db) return;
    try {
      await addDoc(collection(db, "transactions"), {
        ...newTx,
        userId: user.uid, // Associate with user
        createdAt: new Date().toISOString()
      });
    } catch (error) {
      console.error("Erro ao adicionar transação", error);
      alert("Erro ao salvar na nuvem.");
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    if(window.confirm("Tem a certeza que deseja eliminar esta transação permanentemente da nuvem?")) {
      if (!db) return;
      try {
        await deleteDoc(doc(db, "transactions", id));
      } catch (error) {
        console.error("Erro ao deletar", error);
        alert("Erro ao apagar registro.");
      }
    }
  };

  const handleAIAnalysis = async () => {
    if (transactions.length === 0) {
      setAiState({ analysis: '', loading: false, error: 'Adicione transações primeiro para gerar uma análise.' });
      return;
    }

    setAiState({ analysis: '', loading: true, error: null });
    try {
      const result = await analyzeTransactions(transactions);
      setAiState({ analysis: result, loading: false, error: null });
    } catch (err) {
      setAiState({ analysis: '', loading: false, error: 'Erro ao comunicar com o serviço de IA.' });
    }
  };

  const exportToCSV = () => {
    const headers = ["Data", "Descrição", "Categoria", "Tipo", "Valor (MZN)"];
    const rows = reportData.map(t => [
      new Date(t.date).toLocaleDateString('pt-MZ'),
      `"${t.description.replace(/"/g, '""')}"`,
      `"${t.category}"`,
      t.type === 'income' ? 'Receita' : 'Despesa',
      t.amount.toFixed(2).replace('.', ',')
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(";") + "\n" 
      + rows.map(e => e.join(";")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `relatorio_fluxo_${reportFilters.startDate}_${reportFilters.endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  const formatMZN = (val: number) => {
    return new Intl.NumberFormat('pt-MZ', { style: 'currency', currency: 'MZN' }).format(val);
  };

  return (
    <div className="flex h-screen w-full bg-[#f0f3f9] text-slate-800 overflow-hidden font-sans select-none">
      
      {/* Sidebar */}
      <aside className="w-64 bg-slate-50 border-r border-slate-200 flex flex-col shadow-sm z-10 print:hidden">
        <div className="p-6 flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-md flex items-center justify-center shadow-lg shadow-blue-500/30">
            <span className="text-white font-bold text-lg">F</span>
          </div>
          <span className="font-semibold text-xl tracking-tight text-slate-800">FluxoWin</span>
        </div>

        {/* User Profile Info */}
        <div className="px-6 pb-6 border-b border-slate-200 mb-2">
            <div className="flex items-center gap-3 bg-white p-2 rounded-lg border border-slate-200 shadow-sm">
                {user?.photoURL ? (
                    <img src={user.photoURL} alt="User" className="w-8 h-8 rounded-full" />
                ) : (
                    <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center">
                        <UserIcon size={16} className="text-slate-500" />
                    </div>
                )}
                <div className="overflow-hidden">
                    <p className="text-xs font-bold text-slate-700 truncate">{user?.displayName || 'Utilizador'}</p>
                    <p className="text-[10px] text-emerald-600 flex items-center gap-1">
                        <Cloud size={8} /> Online
                    </p>
                </div>
            </div>
        </div>

        <nav className="flex-1 px-3 py-2 space-y-1">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all ${
              activeTab === 'dashboard' 
                ? 'bg-white text-blue-600 shadow-sm ring-1 ring-slate-200' 
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <LayoutDashboard size={18} />
            Visão Geral
          </button>
          <button 
             onClick={() => setActiveTab('history')}
             className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all ${
              activeTab === 'history' 
                ? 'bg-white text-blue-600 shadow-sm ring-1 ring-slate-200' 
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <History size={18} />
            Histórico
          </button>
          <button 
             onClick={() => setActiveTab('reports')}
             className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all ${
              activeTab === 'reports' 
                ? 'bg-white text-blue-600 shadow-sm ring-1 ring-slate-200' 
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <FileText size={18} />
            Relatórios
          </button>
        </nav>

        <div className="p-4 border-t border-slate-200">
           <button 
             onClick={logout}
             className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-rose-600 hover:bg-rose-50 transition-colors"
           >
               <LogOut size={16} />
               Sair da Conta
           </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#f0f3f9] print:bg-white print:h-auto print:overflow-visible">
        
        {/* Windows Title Bar Simulation */}
        <header className="h-10 bg-slate-50 border-b border-slate-200 flex items-center justify-between px-4 drag-handle shrink-0 print:hidden">
          <div className="text-xs text-slate-500 flex items-center gap-2">
            <span>Fluxo de Caixa Online - {activeTab === 'dashboard' ? 'Visão Geral' : activeTab === 'history' ? 'Histórico' : 'Relatórios Detalhados'}</span>
          </div>
          <div className="flex items-center gap-4">
             <div className="flex gap-4 text-slate-400">
                <Minus size={14} className="hover:text-slate-600 cursor-pointer"/>
                <Square size={12} className="hover:text-slate-600 cursor-pointer"/>
                <CloseIcon size={14} className="hover:text-red-500 cursor-pointer"/>
             </div>
          </div>
        </header>

        {/* Workspace */}
        <div className="flex-1 overflow-y-auto p-6 scroll-smooth print:p-0 print:overflow-visible">
          
          {loadingTransactions ? (
             <div className="h-full flex flex-col items-center justify-center text-slate-400">
                 <div className="w-8 h-8 border-4 border-blue-600/30 border-t-blue-600 rounded-full animate-spin mb-4"></div>
                 <p className="text-sm">Sincronizando dados...</p>
             </div>
          ) : (
            <>
                <div className="mb-8 flex items-center justify-between print:mb-4">
                    <div>
                    <h1 className="text-2xl font-bold text-slate-800">
                        {activeTab === 'dashboard' ? 'Painel Financeiro' : activeTab === 'history' ? 'Histórico de Transações' : 'Relatórios Gerenciais'}
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">
                        {new Date().toLocaleDateString('pt-MZ', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                    </div>
                    {activeTab !== 'reports' && (
                    <button 
                        onClick={() => setIsModalOpen(true)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg shadow-md shadow-blue-500/20 flex items-center gap-2 text-sm font-medium transition-all active:scale-95 print:hidden"
                    >
                        <Plus size={18} />
                        Nova Transação
                    </button>
                    )}
                </div>

                {activeTab === 'dashboard' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <SummaryCard title="Entradas" amount={summary.totalIncome} type="income" />
                        <SummaryCard title="Saídas" amount={summary.totalExpense} type="expense" />
                        <SummaryCard title="Saldo Atual" amount={summary.balance} type="balance" />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[400px]">
                        <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow-sm border border-slate-200 flex flex-col">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="font-semibold text-slate-800">Fluxo de Saldo</h3>
                        </div>
                        <div className="flex-1">
                            <Charts transactions={transactions} />
                        </div>
                        </div>
                        
                        <div className="lg:col-span-1 h-full">
                        <AnalysisPanel 
                            analysis={aiState.analysis} 
                            loading={aiState.loading} 
                            error={aiState.error}
                            onAnalyze={handleAIAnalysis}
                        />
                        </div>
                    </div>

                    <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                        <h3 className="font-semibold text-slate-800">Últimas Movimentações</h3>
                        <button onClick={() => setActiveTab('history')} className="text-xs text-blue-600 hover:underline font-medium">Ver tudo</button>
                        </div>
                        <div className="divide-y divide-slate-100">
                        {transactions.slice(0, 5).map((t) => (
                            <div key={t.id} className="px-6 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors">
                            <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${t.type === 'income' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                                {t.type === 'income' ? <Plus size={14} /> : <Minus size={14} />}
                                </div>
                                <div>
                                <p className="text-sm font-medium text-slate-800">{t.description}</p>
                                <p className="text-xs text-slate-500">{t.category} • {new Date(t.date).toLocaleDateString('pt-MZ')}</p>
                                </div>
                            </div>
                            <span className={`text-sm font-semibold ${t.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {t.type === 'income' ? '+' : '-'} {formatMZN(t.amount)}
                            </span>
                            </div>
                        ))}
                        {transactions.length === 0 && (
                            <div className="px-6 py-8 text-center text-sm text-slate-400">Nenhuma transação registrada.</div>
                        )}
                        </div>
                    </div>
                    </div>
                )}

                {activeTab === 'history' && (
                    <div className="bg-white rounded-lg shadow-sm border border-slate-200 flex flex-col h-full min-h-[500px] animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="p-4 border-b border-slate-200 flex gap-4 items-center bg-slate-50/50">
                        <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                        <input 
                            type="text" 
                            placeholder="Buscar transações..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        />
                        </div>
                    </div>

                    <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        <div className="col-span-2">Data</div>
                        <div className="col-span-4">Descrição</div>
                        <div className="col-span-3">Categoria (PGC-NIRF)</div>
                        <div className="col-span-2 text-right">Valor</div>
                        <div className="col-span-1 text-right">Ações</div>
                    </div>

                    <div className="flex-1 overflow-auto divide-y divide-slate-100">
                        {filteredTransactions.length > 0 ? (
                        filteredTransactions.map(t => (
                            <div key={t.id} className="grid grid-cols-12 gap-4 px-6 py-3 items-center hover:bg-slate-50 transition-colors text-sm group">
                            <div className="col-span-2 text-slate-600">{new Date(t.date).toLocaleDateString('pt-MZ')}</div>
                            <div className="col-span-4 font-medium text-slate-800">{t.description}</div>
                            <div className="col-span-3">
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200 truncate max-w-full">
                                {t.category}
                                </span>
                            </div>
                            <div className={`col-span-2 text-right font-semibold ${t.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {t.type === 'income' ? '+' : '-'} {formatMZN(t.amount)}
                            </div>
                            <div className="col-span-1 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                                <button 
                                onClick={() => handleDeleteTransaction(t.id)}
                                className="text-red-500 hover:text-red-700 text-xs underline"
                                >
                                Excluir
                                </button>
                            </div>
                            </div>
                        ))
                        ) : (
                        <div className="p-12 text-center text-slate-400">
                            <History className="w-12 h-12 mx-auto mb-3 opacity-20" />
                            <p>Nenhuma transação encontrada.</p>
                        </div>
                        )}
                    </div>
                    </div>
                )}

                {activeTab === 'reports' && (
                    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200 print:hidden">
                        <div className="flex items-center gap-2 mb-4 text-slate-800 font-semibold border-b border-slate-100 pb-2">
                        <Filter size={16} />
                        <h2>Configuração do Relatório</h2>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">Data Início</label>
                            <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                            <input 
                                type="date"
                                value={reportFilters.startDate}
                                onChange={(e) => setReportFilters(prev => ({ ...prev, startDate: e.target.value }))}
                                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                            />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">Data Fim</label>
                            <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                            <input 
                                type="date"
                                value={reportFilters.endDate}
                                onChange={(e) => setReportFilters(prev => ({ ...prev, endDate: e.target.value }))}
                                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                            />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">Tipo de Operação</label>
                            <select 
                            value={reportFilters.type}
                            onChange={(e) => setReportFilters(prev => ({ ...prev, type: e.target.value as any }))}
                            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white"
                            >
                            <option value="all">Todas</option>
                            <option value="income">Receitas (Classe 7)</option>
                            <option value="expense">Despesas (Classe 6)</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">Categoria PGC-NIRF</label>
                            <select 
                            value={reportFilters.category}
                            onChange={(e) => setReportFilters(prev => ({ ...prev, category: e.target.value }))}
                            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white"
                            >
                            <option value="all">Todas as Categorias</option>
                            {PGC_CATEGORIES.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                            </select>
                        </div>
                        </div>

                        <div className="mt-4 pt-4 border-t border-slate-100 flex gap-3 justify-end">
                        <button 
                            onClick={exportToCSV}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 active:bg-slate-100 transition-colors"
                        >
                            <FileText size={16} />
                            Exportar CSV
                        </button>
                        <button 
                            onClick={handlePrint}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-slate-800 border border-slate-800 rounded-md hover:bg-slate-900 shadow-sm transition-colors"
                        >
                            <Printer size={16} />
                            Imprimir / Salvar PDF
                        </button>
                        </div>
                    </div>

                    <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden min-h-[400px]">
                        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center print:bg-white print:border-b-2 print:border-black">
                        <h3 className="font-bold text-slate-800">
                            Relatório de Movimentos
                            <span className="block text-xs font-normal text-slate-500 mt-1">
                            {new Date(reportFilters.startDate).toLocaleDateString('pt-MZ')} até {new Date(reportFilters.endDate).toLocaleDateString('pt-MZ')}
                            </span>
                        </h3>
                        <div className="text-right text-xs text-slate-500 hidden print:block">
                            Gerado por: {user?.displayName} em {new Date().toLocaleString('pt-MZ')}
                        </div>
                        </div>

                        <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200 print:bg-white print:text-black">
                            <tr>
                                <th className="px-6 py-3 font-semibold">Data</th>
                                <th className="px-6 py-3 font-semibold">Descrição</th>
                                <th className="px-6 py-3 font-semibold">Categoria (PGC)</th>
                                <th className="px-6 py-3 font-semibold text-right">Entrada</th>
                                <th className="px-6 py-3 font-semibold text-right">Saída</th>
                            </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                            {reportData.map((t) => (
                                <tr key={t.id} className="hover:bg-slate-50 transition-colors print:hover:bg-transparent">
                                <td className="px-6 py-3 text-slate-600">{new Date(t.date).toLocaleDateString('pt-MZ')}</td>
                                <td className="px-6 py-3 font-medium text-slate-800">{t.description}</td>
                                <td className="px-6 py-3 text-slate-600">{t.category}</td>
                                <td className="px-6 py-3 text-right text-emerald-600 font-medium">
                                    {t.type === 'income' ? formatMZN(t.amount) : '-'}
                                </td>
                                <td className="px-6 py-3 text-right text-rose-600 font-medium">
                                    {t.type === 'expense' ? formatMZN(t.amount) : '-'}
                                </td>
                                </tr>
                            ))}
                            {reportData.length === 0 && (
                                <tr>
                                <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                                    Nenhum dado encontrado com os filtros selecionados.
                                </td>
                                </tr>
                            )}
                            </tbody>
                            <tfoot className="bg-slate-50 border-t border-slate-200 font-bold text-slate-800 print:bg-slate-100">
                            <tr>
                                <td colSpan={3} className="px-6 py-3 text-right uppercase text-xs tracking-wider">Totais do Período</td>
                                <td className="px-6 py-3 text-right text-emerald-600">
                                {formatMZN(reportData.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0))}
                                </td>
                                <td className="px-6 py-3 text-right text-rose-600">
                                {formatMZN(reportData.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0))}
                                </td>
                            </tr>
                            </tfoot>
                        </table>
                        </div>
                    </div>
                    </div>
                )}
            </>
          )}

        </div>
      </main>

      <TransactionModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSave={handleAddTransaction} 
      />
      
      {/* Print Styles */}
      <style>{`
        @media print {
          @page { margin: 20mm; }
          body { background: white; -webkit-print-color-adjust: exact; }
          aside, header, button, .print\\:hidden { display: none !important; }
          main { margin: 0; padding: 0; overflow: visible; height: auto; }
          .overflow-y-auto { overflow: visible !important; height: auto !important; }
        }
      `}</style>
    </div>
  );
};

// Root wrapper to handle Auth state
const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

const AppContent: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-[#f0f3f9]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  return <AuthenticatedApp />;
};

export default App;