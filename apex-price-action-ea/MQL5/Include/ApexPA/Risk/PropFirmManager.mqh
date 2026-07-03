//+------------------------------------------------------------------+
//|                                              PropFirmManager.mqh |
//| Prop-firm rule presets and challenge compliance monitoring.      |
//|                                                                  |
//| IMPORTANT: preset values encode commonly published rules for     |
//| each firm's standard 2-step evaluation as of the time of coding. |
//| Firms change rules; ALWAYS verify against your account's actual  |
//| rules and override via PROP_CUSTOM if anything differs. The EA   |
//| additionally applies a safety buffer so it halts BEFORE the firm |
//| limit is touched.                                                |
//+------------------------------------------------------------------+
#include <ApexPA/Core/Definitions.mqh>
#include <ApexPA/Core/Logger.mqh>

class CPropFirmManager
  {
private:
   ApexPropRules     m_rules;
   ENUM_APEX_PROP_FIRM m_firm;
   double            m_initial_balance;    // challenge starting balance
   double            m_high_water_mark;    // equity HWM for trailing DD
   double            m_day_anchor;         // balance/equity anchor at day start
   datetime          m_day_start;
   int               m_trading_days;       // days with at least one trade
   datetime          m_last_trade_day;
   double            m_best_day_profit;    // for consistency rule
   double            m_total_profit;

   void              LoadPreset(const ENUM_APEX_PROP_FIRM firm)
     {
      // Defaults common to 2-step evaluations
      m_rules.name                     = "Custom";
      m_rules.max_daily_dd_pct         = 5.0;
      m_rules.max_overall_dd_pct       = 10.0;
      m_rules.overall_dd_trailing      = false;
      m_rules.daily_dd_from_equity     = true;
      m_rules.profit_target_pct        = 8.0;
      m_rules.min_trading_days         = 4;
      m_rules.max_risk_per_trade_pct   = 1.0;
      m_rules.consistency_max_day_pct  = 0.0;
      m_rules.soft_daily_dd_buffer_pct    = 0.8;
      m_rules.soft_overall_dd_buffer_pct  = 1.5;

      switch(firm)
        {
         case PROP_FTMO:
            m_rules.name = "FTMO";
            m_rules.max_daily_dd_pct   = 5.0;
            m_rules.max_overall_dd_pct = 10.0;
            m_rules.profit_target_pct  = 10.0;
            m_rules.min_trading_days   = 4;
            break;
         case PROP_FUNDEDNEXT:
            m_rules.name = "FundedNext";
            m_rules.max_daily_dd_pct   = 5.0;
            m_rules.max_overall_dd_pct = 10.0;
            m_rules.profit_target_pct  = 8.0;
            m_rules.min_trading_days   = 5;
            break;
         case PROP_FUNDINGPIPS:
            m_rules.name = "FundingPips";
            m_rules.max_daily_dd_pct   = 5.0;
            m_rules.max_overall_dd_pct = 10.0;
            m_rules.profit_target_pct  = 8.0;
            m_rules.min_trading_days   = 3;
            break;
         case PROP_BLUE_GUARDIAN:
            m_rules.name = "Blue Guardian";
            m_rules.max_daily_dd_pct   = 4.0;
            m_rules.max_overall_dd_pct = 8.0;
            m_rules.profit_target_pct  = 8.0;
            m_rules.min_trading_days   = 5;
            m_rules.consistency_max_day_pct = 30.0;
            break;
         case PROP_HOLA_PRIME:
            m_rules.name = "Hola Prime";
            m_rules.max_daily_dd_pct   = 5.0;
            m_rules.max_overall_dd_pct = 10.0;
            m_rules.profit_target_pct  = 8.0;
            m_rules.min_trading_days   = 5;
            break;
         case PROP_CK_CAPITAL:
            m_rules.name = "CK Capital";
            m_rules.max_daily_dd_pct   = 5.0;
            m_rules.max_overall_dd_pct = 10.0;
            m_rules.profit_target_pct  = 8.0;
            m_rules.min_trading_days   = 5;
            break;
         case PROP_BLUEBERRY:
            m_rules.name = "Blueberry Funded";
            m_rules.max_daily_dd_pct   = 5.0;
            m_rules.max_overall_dd_pct = 10.0;
            m_rules.profit_target_pct  = 8.0;
            m_rules.min_trading_days   = 3;
            break;
         case PROP_EIGHTCAP:
            m_rules.name = "Eightcap Funded";
            m_rules.max_daily_dd_pct   = 5.0;
            m_rules.max_overall_dd_pct = 10.0;
            m_rules.profit_target_pct  = 8.0;
            m_rules.min_trading_days   = 3;
            break;
         case PROP_NONE:
            m_rules.name = "Live (no challenge)";
            m_rules.profit_target_pct  = 0;
            m_rules.min_trading_days   = 0;
            break;
         default:
            break; // PROP_CUSTOM keeps defaults; overridden by ApplyCustom
        }
     }

public:
                     CPropFirmManager() : m_firm(PROP_NONE), m_initial_balance(0),
                                          m_high_water_mark(0), m_day_anchor(0),
                                          m_day_start(0), m_trading_days(0),
                                          m_last_trade_day(0), m_best_day_profit(0),
                                          m_total_profit(0) {}

   void              Init(const ENUM_APEX_PROP_FIRM firm, const double initial_balance)
     {
      m_firm = firm;
      LoadPreset(firm);
      m_initial_balance = (initial_balance > 0) ? initial_balance
                                                : AccountInfoDouble(ACCOUNT_BALANCE);
      m_high_water_mark = MathMax(AccountInfoDouble(ACCOUNT_EQUITY),
                                  AccountInfoDouble(ACCOUNT_BALANCE));
      OnNewDay();
      ApexLog.Info(StringFormat("PropFirm preset '%s': dailyDD=%.1f%%, overallDD=%.1f%% (%s), target=%.1f%%, minDays=%d",
                   m_rules.name, m_rules.max_daily_dd_pct, m_rules.max_overall_dd_pct,
                   m_rules.overall_dd_trailing ? "trailing" : "static",
                   m_rules.profit_target_pct, m_rules.min_trading_days));
     }

   //--- override any preset field (used for PROP_CUSTOM / rule changes)
   void              ApplyCustom(const double daily_dd, const double overall_dd,
                                 const bool trailing, const double target_pct,
                                 const int min_days, const double consistency_pct,
                                 const double soft_daily_buf, const double soft_overall_buf)
     {
      if(daily_dd > 0)   m_rules.max_daily_dd_pct   = daily_dd;
      if(overall_dd > 0) m_rules.max_overall_dd_pct = overall_dd;
      m_rules.overall_dd_trailing = trailing;
      if(target_pct >= 0) m_rules.profit_target_pct = target_pct;
      if(min_days >= 0)   m_rules.min_trading_days  = min_days;
      if(consistency_pct >= 0) m_rules.consistency_max_day_pct = consistency_pct;
      if(soft_daily_buf >= 0)  m_rules.soft_daily_dd_buffer_pct = soft_daily_buf;
      if(soft_overall_buf >= 0) m_rules.soft_overall_dd_buffer_pct = soft_overall_buf;
     }

   ApexPropRules     Rules() const { return m_rules; }
   string            FirmName() const { return m_rules.name; }

   //--- call at the start of each broker day
   void              OnNewDay()
     {
      double bal = AccountInfoDouble(ACCOUNT_BALANCE);
      double eq  = AccountInfoDouble(ACCOUNT_EQUITY);
      m_day_anchor = m_rules.daily_dd_from_equity ? MathMax(bal, eq) : bal;
      m_day_start  = TimeCurrent();
     }

   //--- call on every equity change
   void              OnTickUpdate()
     {
      double eq = AccountInfoDouble(ACCOUNT_EQUITY);
      if(eq > m_high_water_mark) m_high_water_mark = eq;
     }

   //--- register a closed trade (for trading-day + consistency tracking)
   void              OnTradeClosed(const double profit)
     {
      MqlDateTime dt;
      TimeToStruct(TimeCurrent(), dt);
      datetime day = TimeCurrent() - (TimeCurrent() % 86400);
      if(day != m_last_trade_day)
        {
         m_trading_days++;
         m_last_trade_day = day;
        }
      m_total_profit += profit;
     }

   void              SetBestDayProfit(const double day_profit)
     {
      if(day_profit > m_best_day_profit) m_best_day_profit = day_profit;
     }

   //--- remaining room before the SOFT daily limit (money)
   double            RemainingDailyLoss() const
     {
      double soft_pct = m_rules.max_daily_dd_pct - m_rules.soft_daily_dd_buffer_pct;
      double limit = m_day_anchor * soft_pct / 100.0;
      double drawdown = m_day_anchor - AccountInfoDouble(ACCOUNT_EQUITY);
      return limit - drawdown;
     }

   //--- remaining room before the SOFT overall limit (money)
   double            RemainingOverallLoss() const
     {
      double soft_pct = m_rules.max_overall_dd_pct - m_rules.soft_overall_dd_buffer_pct;
      double anchor = m_rules.overall_dd_trailing ? m_high_water_mark : m_initial_balance;
      double floor_eq = anchor * (1.0 - soft_pct / 100.0);
      return AccountInfoDouble(ACCOUNT_EQUITY) - floor_eq;
     }

   double            DailyDDUsedPct() const
     {
      if(m_day_anchor <= 0) return 0;
      return MathMax(0.0, (m_day_anchor - AccountInfoDouble(ACCOUNT_EQUITY)) / m_day_anchor * 100.0);
     }

   double            OverallDDUsedPct() const
     {
      double anchor = m_rules.overall_dd_trailing ? m_high_water_mark : m_initial_balance;
      if(anchor <= 0) return 0;
      return MathMax(0.0, (anchor - AccountInfoDouble(ACCOUNT_EQUITY)) / anchor * 100.0);
     }

   bool              DailyLimitBreached() const   { return RemainingDailyLoss() <= 0; }
   bool              OverallLimitBreached() const { return RemainingOverallLoss() <= 0; }

   bool              TargetReached() const
     {
      if(m_rules.profit_target_pct <= 0) return false;
      double eq = AccountInfoDouble(ACCOUNT_EQUITY);
      return eq >= m_initial_balance * (1.0 + m_rules.profit_target_pct / 100.0);
     }

   double            TargetProgressPct() const
     {
      if(m_rules.profit_target_pct <= 0 || m_initial_balance <= 0) return 0;
      double gain = (AccountInfoDouble(ACCOUNT_EQUITY) - m_initial_balance) / m_initial_balance * 100.0;
      return MathMin(100.0, MathMax(0.0, gain / m_rules.profit_target_pct * 100.0));
     }

   int               TradingDays() const { return m_trading_days; }
   bool              MinDaysMet() const  { return m_trading_days >= m_rules.min_trading_days; }

   //--- consistency guard: would adding `potential_profit` today make today
   //--- exceed the max share of total profit allowed from a single day?
   bool              ConsistencyAllows(const double today_profit, const double potential_profit) const
     {
      if(m_rules.consistency_max_day_pct <= 0) return true;
      double new_today = today_profit + potential_profit;
      double new_total = MathMax(m_total_profit + potential_profit, 0.0001);
      return (new_today / new_total * 100.0) <= m_rules.consistency_max_day_pct;
     }

   double            InitialBalance() const { return m_initial_balance; }
   double            HighWaterMark() const  { return m_high_water_mark; }
   double            DayAnchor() const      { return m_day_anchor; }
  };
//+------------------------------------------------------------------+
