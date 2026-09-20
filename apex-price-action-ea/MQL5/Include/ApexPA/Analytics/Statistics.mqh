//+------------------------------------------------------------------+
//|                                                   Statistics.mqh |
//| Rolling performance statistics for dashboard + reports.          |
//|                                                                  |
//| Maintains the full closed-trade series for this EA (by magic)    |
//| and computes: win rate, profit factor, expectancy, average R,    |
//| Sharpe / Sortino (per-trade returns), recovery factor, streaks,  |
//| average duration, and a challenge pass ESTIMATE derived from     |
//| bootstrap-style projection of the observed trade distribution.   |
//| The estimate is explicitly labelled as such - it is a function   |
//| of past results and cannot predict future performance.           |
//+------------------------------------------------------------------+
#include <ApexPA/Core/Definitions.mqh>

class CStatistics
  {
private:
   ApexTradeRecord   m_trades[];
   double            m_start_balance;
   double            m_peak_equity;
   double            m_max_dd_money;

public:
                     CStatistics() : m_start_balance(0), m_peak_equity(0), m_max_dd_money(0) {}

   void              Init(const double start_balance)
     {
      m_start_balance = start_balance;
      m_peak_equity   = start_balance;
     }

   void              AddTrade(const ApexTradeRecord &rec)
     {
      int n = ArraySize(m_trades);
      ArrayResize(m_trades, n + 1);
      m_trades[n] = rec;
     }

   void              OnEquityTick()
     {
      double eq = AccountInfoDouble(ACCOUNT_EQUITY);
      if(eq > m_peak_equity) m_peak_equity = eq;
      double dd = m_peak_equity - eq;
      if(dd > m_max_dd_money) m_max_dd_money = dd;
     }

   int               Total() const { return ArraySize(m_trades); }

   bool              Get(const int idx, ApexTradeRecord &out) const
     {
      if(idx < 0 || idx >= ArraySize(m_trades)) return false;
      out = m_trades[idx];
      return true;
     }

   int               Wins() const
     {
      int w = 0;
      for(int i = 0; i < ArraySize(m_trades); i++)
         if(m_trades[i].is_win) w++;
      return w;
     }

   double            WinRate() const
     {
      int n = ArraySize(m_trades);
      return (n > 0) ? (double)Wins() / n * 100.0 : 0;
     }

   double            ProfitFactor() const
     {
      double gross_win = 0, gross_loss = 0;
      for(int i = 0; i < ArraySize(m_trades); i++)
        {
         if(m_trades[i].profit >= 0) gross_win  += m_trades[i].profit;
         else                        gross_loss -= m_trades[i].profit;
        }
      if(gross_loss <= 0) return (gross_win > 0) ? 999.0 : 0;
      return gross_win / gross_loss;
     }

   double            Expectancy() const   // money per trade
     {
      int n = ArraySize(m_trades);
      if(n == 0) return 0;
      double sum = 0;
      for(int i = 0; i < n; i++) sum += m_trades[i].profit;
      return sum / n;
     }

   double            AverageR() const
     {
      int n = ArraySize(m_trades);
      if(n == 0) return 0;
      double sum = 0;
      for(int i = 0; i < n; i++) sum += m_trades[i].r_multiple;
      return sum / n;
     }

   double            AvgWinLossRatio() const
     {
      double win_sum = 0, loss_sum = 0;
      int wins = 0, losses = 0;
      for(int i = 0; i < ArraySize(m_trades); i++)
        {
         if(m_trades[i].is_win) { win_sum += m_trades[i].profit; wins++; }
         else                   { loss_sum -= m_trades[i].profit; losses++; }
        }
      if(wins == 0 || losses == 0 || loss_sum <= 0) return 0;
      return (win_sum / wins) / (loss_sum / losses);
     }

   //--- Sharpe/Sortino on per-trade R returns (rf = 0)
   double            Sharpe() const
     {
      int n = ArraySize(m_trades);
      if(n < 5) return 0;
      double mean = AverageR(), var = 0;
      for(int i = 0; i < n; i++)
         var += MathPow(m_trades[i].r_multiple - mean, 2);
      var /= (n - 1);
      double sd = MathSqrt(var);
      return (sd > 0) ? mean / sd * MathSqrt((double)n) : 0;
     }

   double            Sortino() const
     {
      int n = ArraySize(m_trades);
      if(n < 5) return 0;
      double mean = AverageR(), dvar = 0;
      int dcount = 0;
      for(int i = 0; i < n; i++)
         if(m_trades[i].r_multiple < 0)
           {
            dvar += MathPow(m_trades[i].r_multiple, 2);
            dcount++;
           }
      if(dcount == 0) return 999;
      double dsd = MathSqrt(dvar / dcount);
      return (dsd > 0) ? mean / dsd * MathSqrt((double)n) : 0;
     }

   double            RecoveryFactor() const
     {
      double net = AccountInfoDouble(ACCOUNT_BALANCE) - m_start_balance;
      return (m_max_dd_money > 0) ? net / m_max_dd_money : 0;
     }

   void              Streaks(int &max_wins, int &max_losses) const
     {
      max_wins = 0;
      max_losses = 0;
      int cw = 0, cl = 0;
      for(int i = 0; i < ArraySize(m_trades); i++)
        {
         if(m_trades[i].is_win) { cw++; cl = 0; }
         else                   { cl++; cw = 0; }
         if(cw > max_wins)   max_wins = cw;
         if(cl > max_losses) max_losses = cl;
        }
     }

   double            AvgDurationMinutes() const
     {
      int n = ArraySize(m_trades);
      if(n == 0) return 0;
      double sum = 0;
      for(int i = 0; i < n; i++)
         sum += (double)(m_trades[i].close_time - m_trades[i].open_time) / 60.0;
      return sum / n;
     }

   //--- profit over a window (money)
   double            ProfitSince(const datetime from) const
     {
      double sum = 0;
      for(int i = 0; i < ArraySize(m_trades); i++)
         if(m_trades[i].close_time >= from) sum += m_trades[i].profit;
      return sum;
     }

   //--- ESTIMATED probability of reaching `target_pct` before losing
   //--- `dd_pct`, projected from observed avg R and win rate using a
   //--- gambler's-ruin style approximation. Returns -1 if sample too
   //--- small to be meaningful (<20 trades). Clearly an estimate.
   double            ChallengePassEstimate(const double target_pct, const double dd_pct,
                                           const double risk_per_trade_pct) const
     {
      int n = ArraySize(m_trades);
      if(n < 20 || risk_per_trade_pct <= 0) return -1;

      double p = WinRate() / 100.0;
      double avg_win_r = 0, avg_loss_r = 0;
      int wins = 0, losses = 0;
      for(int i = 0; i < n; i++)
        {
         if(m_trades[i].is_win) { avg_win_r += m_trades[i].r_multiple; wins++; }
         else                   { avg_loss_r -= m_trades[i].r_multiple; losses++; }
        }
      if(wins == 0 || losses == 0) return -1;
      avg_win_r /= wins;
      avg_loss_r /= losses;
      if(avg_loss_r <= 0) return -1;

      // steps to target / to ruin in units of average loss
      double b = avg_win_r / avg_loss_r;                     // payoff ratio
      double q = 1.0 - p;
      double steps_up   = target_pct / (risk_per_trade_pct * avg_win_r);
      double steps_down = dd_pct / (risk_per_trade_pct * avg_loss_r);

      // asymmetric random walk absorption probability approximation
      if(MathAbs(p * b - q) < 1e-9) return 0.5;
      double ratio = q / (p * b);
      double num = 1.0 - MathPow(ratio, steps_down);
      double den = 1.0 - MathPow(ratio, steps_down + steps_up);
      if(den == 0) return -1;
      return MathMax(0.0, MathMin(1.0, num / den));
     }

   double            MaxDDMoney() const { return m_max_dd_money; }
  };
//+------------------------------------------------------------------+
