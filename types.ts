export type TransactionType = 'income' | 'expense';

export interface Transaction {
  id: string;
  date: string; // ISO string
  description: string;
  amount: number;
  type: TransactionType;
  category: string;
}

export interface FinancialSummary {
  totalIncome: number;
  totalExpense: number;
  balance: number;
}

export interface AIAnalysisResult {
  analysis: string;
  loading: boolean;
  error: string | null;
}

export interface ReportFilters {
  startDate: string;
  endDate: string;
  type: 'all' | 'income' | 'expense';
  category: string;
}

// Categorias baseadas no PGC-NIRF Moçambicano (Simplificado para Fluxo de Caixa)
export const PGC_CATEGORIES = [
  // Classe 7 - Proveitos
  "7.1 - Vendas",
  "7.2 - Prestações de Serviços",
  "7.5 - Subsídios à Exploração",
  "7.8 - Outros Proveitos e Ganhos",
  // Classe 6 - Gastos
  "6.1 - Custo dos Inventários",
  "6.2 - Gastos com o Pessoal",
  "6.3 - Fornecimentos e Serviços de Terceiros",
  "6.4 - Amortizações e Depreciações",
  "6.5 - Perdas por Imparidade",
  "6.9 - Gastos Financeiros",
  "Outros"
] as const;