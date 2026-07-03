//+------------------------------------------------------------------+
//|                                                  RiskManager.mqh |
//| Institutional risk engine.                                       |
//|                                                                  |
//| Responsibilities:                                                |
//|  - dynamic position sizing (fixed-fractional, DD-throttled)      |
//|  - daily / weekly / overall drawdown circuit breakers            |
//|  - max open trades, exposure and currency-correlation limits     |
//|  - consecutive-loss cool-down, daily profit lock                 |
//|  - floating drawdown (equity guard) protection                   |
//|  - news / weekend / holiday time windows                         |
//| The risk manager can only VETO trades and reduce size - it never |
//| generates entries.                                               |
//+------------------------------------------------------------------+
#include <ApexPA/Core/Definitions.mqh>
#include <ApexPA/Core/SymbolAdapter.mqh>
#include <ApexPA/Core/Logger.mqh>
#include <ApexPA/Risk/PropFirmManager.mqh>

struct ApexRiskConfig
  {
   double            risk_per_trade_pct;      // base risk %, e.g. 0.5
   double            max_weekly_dd_pct;       // 0 = disabled
   int               max_open_trades;
   int               max_trades_per_day;
   int               max_consecutive_losses;  // cool-down trigger
   int               cooldown_hours;          // pause after loss streak
   double            daily_profit_lock_pct;   // stop trading for the day after +X%
   double            equity_guard_floating_dd_pct; // flatten all if floating DD exceeds
   bool              use_correlation_filter;
   double            max_total_risk_pct;      // sum of open-risk cap
   bool              block_weekend;
   int               friday_close_hour;       // broker time; 0 = disabled
   bool              news_filter;
   int               news_block_before_min;
   int               news_block_after_min;
   bool              reduce_risk_in_dd;       // half size while in drawdown
  };

class CRiskManager
  {
private:
   ApexRiskConfig    m_cfg;
   CSymbolAdapter   *m_adapter;
   CPropFirmManager *m_prop;
   long              m_magic;

   int               m_consecutive_losses;
   datetime          m_cooldown_until;
   int               m_trades_today;
   double            m_day_realized;          // realized P/L today
   datetime          m_current_day;
   double            m_week_anchor;           // equity at week start
   datetime          m_current_week;
   ENUM_APEX_TRADE_STATE m_state;

   //--- currency exposure from open positions with our magic
   bool              CorrelatedExposure(const string symbol, const ENUM_APEX_DIRECTION dir) const
     {
      if(!m_cfg.use_correlation_filter) return false;
      string base  = StringSubstr(symbol, 0, 3);
      string quote = (StringLen(symbol) >= 6) ? StringSubstr(symbol, 3, 3) : "";

      for(int i = PositionsTotal() - 1; i >= 0; i--)
        {
         ulong ticket = PositionGetTicket(i);
         if(ticket == 0) continue;
         if(PositionGetInteger(POSITION_MAGIC) != m_magic) continue;
         string psym = PositionGetString(POSITION_SYMBOL);
         if(psym == symbol) continue;
         long ptype = PositionGetInteger(POSITION_TYPE);
         ENUM_APEX_DIRECTION pdir = (ptype == POSITION_TYPE_BUY) ? DIR_LONG : DIR_SHORT;

         string pbase  = StringSubstr(psym, 0, 3);
         string pquote = (StringLen(psym) >= 6) ? StringSubstr(psym, 3, 3) : "";
         // same-direction exposure to a shared currency = correlated risk
         bool shares = (base == pbase || base == pquote || quote == pbase || quote == pquote);
         if(shares && pdir == dir)
            return true;
        }
      return false;
     }

   double            OpenRiskMoney() const
     {
      double total = 0;
      for(int i = PositionsTotal() - 1; i >= 0; i--)
        {
         ulong ticket = PositionGetTicket(i);
         if(ticket == 0) continue;
         if(PositionGetInteger(POSITION_MAGIC) != m_magic) continue;
         double sl    = PositionGetDouble(POSITION_SL);
         double open  = PositionGetDouble(POSITION_PRICE_OPEN);
         double lots  = PositionGetDouble(POSITION_VOLUME);
         if(sl <= 0) { total += AccountInfoDouble(ACCOUNT_EQUITY) * 0.02; continue; } // no SL: assume 2%
         string psym  = PositionGetString(POSITION_SYMBOL);
         double tick_size  = SymbolInfoDouble(psym, SYMBOL_TRADE_TICK_SIZE);
         double tick_value = SymbolInfoDouble(psym, SYMBOL_TRADE_TICK_VALUE);
         if(tick_size > 0)
            total += MathAbs(open - sl) / tick_size * tick_value * lots;
        }
      return total;
     }

public:
                     CRiskManager() : m_adapter(NULL), m_prop(NULL), m_magic(0),
                                      m_consecutive_losses(0), m_cooldown_until(0),
                                      m_trades_today(0), m_day_realized(0),
                                      m_current_day(0), m_week_anchor(0),
                                      m_current_week(0), m_state(STATE_TRADING) {}

   void              Init(const ApexRiskConfig &cfg, CSymbolAdapter *adapter,
                          CPropFirmManager *prop, const long magic)
     {
      m_cfg     = cfg;
      m_adapter = adapter;
      m_prop    = prop;
      m_magic   = magic;
      m_week_anchor = AccountInfoDouble(ACCOUNT_EQUITY);
      RollDay();
     }

   void              RollDay()
     {
      datetime day = TimeCurrent() - (TimeCurrent() % 86400);
      if(day != m_current_day)
        {
         m_current_day  = day;
         m_trades_today = 0;
         m_day_realized = 0;
         m_prop.OnNewDay();
         // week rollover (Monday)
         MqlDateTime dt;
         TimeToStruct(TimeCurrent(), dt);
         datetime week = day - (dt.day_of_week - 1) * 86400;
         if(week != m_current_week)
           {
            m_current_week = week;
            m_week_anchor  = AccountInfoDouble(ACCOUNT_EQUITY);
           }
        }
     }

   //--- register closed trade result
   void              OnTradeClosed(const double profit)
     {
      m_day_realized += profit;
      m_prop.OnTradeClosed(profit);
      m_prop.SetBestDayProfit(m_day_realized);
      if(profit < 0)
        {
         m_consecutive_losses++;
         if(m_cfg.max_consecutive_losses > 0 &&
            m_consecutive_losses >= m_cfg.max_consecutive_losses)
           {
            m_cooldown_until = TimeCurrent() + m_cfg.cooldown_hours * 3600;
            ApexLog.Warn(StringFormat("Loss streak %d reached - cooling down until %s",
                         m_consecutive_losses, TimeToString(m_cooldown_until)));
           }
        }
      else if(profit > 0)
         m_consecutive_losses = 0;
     }

   void              OnTradeOpened() { m_trades_today++; }

   int               OpenTradesCount() const
     {
      int n = 0;
      for(int i = PositionsTotal() - 1; i >= 0; i--)
        {
         ulong ticket = PositionGetTicket(i);
         if(ticket != 0 && PositionGetInteger(POSITION_MAGIC) == m_magic) n++;
        }
      return n;
     }

   //--- master gate: is new-trade entry allowed right now?
   ENUM_APEX_TRADE_STATE CanTrade(const string symbol, const ENUM_APEX_DIRECTION dir)
     {
      RollDay();
      m_prop.OnTickUpdate();

      // hard prop-firm circuit breakers first
      if(m_prop.OverallLimitBreached()) { m_state = STATE_BLOCKED_OVERALL_DD; return m_state; }
      if(m_prop.DailyLimitBreached())   { m_state = STATE_BLOCKED_DAILY_DD;   return m_state; }
      if(m_prop.TargetReached() && m_prop.MinDaysMet())
                                        { m_state = STATE_BLOCKED_TARGET_REACHED; return m_state; }

      // weekly drawdown
      if(m_cfg.max_weekly_dd_pct > 0 && m_week_anchor > 0)
        {
         double wk_dd = (m_week_anchor - AccountInfoDouble(ACCOUNT_EQUITY)) / m_week_anchor * 100.0;
         if(wk_dd >= m_cfg.max_weekly_dd_pct) { m_state = STATE_BLOCKED_WEEKLY_DD; return m_state; }
        }

      // profit lock: protect a good day
      if(m_cfg.daily_profit_lock_pct > 0 && m_prop.DayAnchor() > 0)
        {
         double day_gain_pct = m_day_realized / m_prop.DayAnchor() * 100.0;
         if(day_gain_pct >= m_cfg.daily_profit_lock_pct)
           { m_state = STATE_BLOCKED_PROFIT_LOCK; return m_state; }
        }

      // cool-down after loss streak
      if(m_cooldown_until > TimeCurrent()) { m_state = STATE_BLOCKED_CONSEC_LOSS; return m_state; }

      // trade count limits
      if(m_cfg.max_open_trades > 0 && OpenTradesCount() >= m_cfg.max_open_trades)
        { m_state = STATE_BLOCKED_MAX_TRADES; return m_state; }
      if(m_cfg.max_trades_per_day > 0 && m_trades_today >= m_cfg.max_trades_per_day)
        { m_state = STATE_BLOCKED_MAX_TRADES; return m_state; }

      // weekend protection
      if(m_cfg.block_weekend)
        {
         MqlDateTime dt;
         TimeToStruct(TimeCurrent(), dt);
         if(dt.day_of_week == 5 && m_cfg.friday_close_hour > 0 && dt.hour >= m_cfg.friday_close_hour)
           { m_state = STATE_BLOCKED_WEEKEND; return m_state; }
         if(dt.day_of_week == 0 || dt.day_of_week == 6)
           { m_state = STATE_BLOCKED_WEEKEND; return m_state; }
        }

      // correlation / exposure
      if(dir != DIR_NONE && CorrelatedExposure(symbol, dir))
        { m_state = STATE_BLOCKED_MAX_TRADES; return m_state; }

      // total open risk cap
      if(m_cfg.max_total_risk_pct > 0)
        {
         double open_risk_pct = OpenRiskMoney() / AccountInfoDouble(ACCOUNT_EQUITY) * 100.0;
         if(open_risk_pct >= m_cfg.max_total_risk_pct)
           { m_state = STATE_BLOCKED_MAX_TRADES; return m_state; }
        }

      m_state = STATE_TRADING;
      return m_state;
     }

   //--- equity guard: flatten everything if floating DD is extreme
   bool              EquityGuardTriggered() const
     {
      if(m_cfg.equity_guard_floating_dd_pct <= 0) return false;
      double bal = AccountInfoDouble(ACCOUNT_BALANCE);
      double eq  = AccountInfoDouble(ACCOUNT_EQUITY);
      if(bal <= 0) return false;
      return (bal - eq) / bal * 100.0 >= m_cfg.equity_guard_floating_dd_pct;
     }

   //--- position size for a signal. Caps risk so a full loss can never
   //--- breach the remaining daily/overall allowance.
   double            ComputeLots(const double entry, const double stop_loss, string &note)
     {
      double eq = AccountInfoDouble(ACCOUNT_EQUITY);
      double risk_pct = m_cfg.risk_per_trade_pct;
      note = "";

      // prop-firm risk ceiling
      ApexPropRules rules = m_prop.Rules();
      if(rules.max_risk_per_trade_pct > 0)
         risk_pct = MathMin(risk_pct, rules.max_risk_per_trade_pct);

      // throttle while in drawdown
      if(m_cfg.reduce_risk_in_dd && m_prop.OverallDDUsedPct() > rules.max_overall_dd_pct * 0.4)
        {
         risk_pct *= 0.5;
         note = "risk halved (drawdown throttle); ";
        }

      double risk_money = eq * risk_pct / 100.0;

      // never risk more than remaining daily / overall allowance
      double daily_room   = m_prop.RemainingDailyLoss();
      double overall_room = m_prop.RemainingOverallLoss();
      double room = MathMin(daily_room, overall_room) * 0.9;  // 10% margin on the room itself
      if(room <= 0) return 0;
      if(risk_money > room)
        {
         risk_money = room;
         note += "risk capped to remaining DD room; ";
        }

      double sl_dist = MathAbs(entry - stop_loss);
      if(sl_dist <= 0) return 0;
      double lots = m_adapter.LotsForRisk(risk_money, sl_dist);
      if(lots < m_adapter.LotMin())
        {
         note += "below min lot - skipped; ";
         return 0;
        }
      return lots;
     }

   double            EffectiveRiskPct(const double entry, const double sl, const double lots) const
     {
      double eq = AccountInfoDouble(ACCOUNT_EQUITY);
      if(eq <= 0) return 0;
      return m_adapter.MoneyAtRisk(lots, MathAbs(entry - sl)) / eq * 100.0;
     }

   ENUM_APEX_TRADE_STATE State() const { return m_state; }
   double            DayRealized() const { return m_day_realized; }
   int               ConsecutiveLosses() const { return m_consecutive_losses; }
   double            OpenRiskPct() const
     {
      double eq = AccountInfoDouble(ACCOUNT_EQUITY);
      return (eq > 0) ? OpenRiskMoney() / eq * 100.0 : 0;
     }
   ApexRiskConfig    Config() const { return m_cfg; }
  };
//+------------------------------------------------------------------+
