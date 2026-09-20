//+------------------------------------------------------------------+
//|                                                    Dashboard.mqh |
//| On-chart analytics panel.                                        |
//|                                                                  |
//| Lightweight OBJ_LABEL/OBJ_RECTANGLE_LABEL panel refreshed from   |
//| OnTimer (1s). Shows account state, risk state, performance       |
//| statistics, market context and prop-firm compliance at a glance. |
//+------------------------------------------------------------------+
#include <ApexPA/Core/Definitions.mqh>
#include <ApexPA/Analytics/Statistics.mqh>
#include <ApexPA/Risk/RiskManager.mqh>
#include <ApexPA/Risk/PropFirmManager.mqh>

class CDashboard
  {
private:
   string            m_prefix;
   long              m_chart;
   int               m_x, m_y, m_width, m_row_h;
   int               m_rows;
   bool              m_enabled;
   color             m_bg, m_head, m_text, m_good, m_bad, m_warn;

   void              EnsurePanel(const int rows)
     {
      string name = m_prefix + "bg";
      if(ObjectFind(m_chart, name) < 0)
        {
         ObjectCreate(m_chart, name, OBJ_RECTANGLE_LABEL, 0, 0, 0);
         ObjectSetInteger(m_chart, name, OBJPROP_CORNER, CORNER_LEFT_UPPER);
         ObjectSetInteger(m_chart, name, OBJPROP_XDISTANCE, m_x - 6);
         ObjectSetInteger(m_chart, name, OBJPROP_YDISTANCE, m_y - 6);
         ObjectSetInteger(m_chart, name, OBJPROP_XSIZE, m_width);
         ObjectSetInteger(m_chart, name, OBJPROP_BGCOLOR, m_bg);
         ObjectSetInteger(m_chart, name, OBJPROP_BORDER_TYPE, BORDER_FLAT);
         ObjectSetInteger(m_chart, name, OBJPROP_COLOR, clrDimGray);
         ObjectSetInteger(m_chart, name, OBJPROP_BACK, false);
         ObjectSetInteger(m_chart, name, OBJPROP_SELECTABLE, false);
         ObjectSetInteger(m_chart, name, OBJPROP_HIDDEN, true);
        }
      ObjectSetInteger(m_chart, name, OBJPROP_YSIZE, rows * m_row_h + 12);
     }

   void              Row(const int idx, const string key, const string value,
                         const color value_color)
     {
      string kname = m_prefix + "k" + IntegerToString(idx);
      string vname = m_prefix + "v" + IntegerToString(idx);
      int y = m_y + idx * m_row_h;

      if(ObjectFind(m_chart, kname) < 0)
        {
         ObjectCreate(m_chart, kname, OBJ_LABEL, 0, 0, 0);
         ObjectSetInteger(m_chart, kname, OBJPROP_CORNER, CORNER_LEFT_UPPER);
         ObjectSetInteger(m_chart, kname, OBJPROP_XDISTANCE, m_x);
         ObjectSetInteger(m_chart, kname, OBJPROP_FONTSIZE, 8);
         ObjectSetString(m_chart, kname, OBJPROP_FONT, "Consolas");
         ObjectSetInteger(m_chart, kname, OBJPROP_SELECTABLE, false);
         ObjectSetInteger(m_chart, kname, OBJPROP_HIDDEN, true);
        }
      ObjectSetInteger(m_chart, kname, OBJPROP_YDISTANCE, y);
      ObjectSetInteger(m_chart, kname, OBJPROP_COLOR, m_text);
      ObjectSetString(m_chart, kname, OBJPROP_TEXT, key);

      if(ObjectFind(m_chart, vname) < 0)
        {
         ObjectCreate(m_chart, vname, OBJ_LABEL, 0, 0, 0);
         ObjectSetInteger(m_chart, vname, OBJPROP_CORNER, CORNER_LEFT_UPPER);
         ObjectSetInteger(m_chart, vname, OBJPROP_XDISTANCE, m_x + 150);
         ObjectSetInteger(m_chart, vname, OBJPROP_FONTSIZE, 8);
         ObjectSetString(m_chart, vname, OBJPROP_FONT, "Consolas");
         ObjectSetInteger(m_chart, vname, OBJPROP_SELECTABLE, false);
         ObjectSetInteger(m_chart, vname, OBJPROP_HIDDEN, true);
        }
      ObjectSetInteger(m_chart, vname, OBJPROP_YDISTANCE, y);
      ObjectSetInteger(m_chart, vname, OBJPROP_COLOR, value_color);
      ObjectSetString(m_chart, vname, OBJPROP_TEXT, value);
     }

   color             Signed(const double v) const { return v >= 0 ? m_good : m_bad; }

public:
                     CDashboard() : m_prefix("APEXPA_"), m_chart(0), m_x(12), m_y(24),
                                    m_width(330), m_row_h(15), m_rows(0), m_enabled(true),
                                    m_bg((color)0x1A1A24), m_head(clrGold),
                                    m_text(clrSilver), m_good(clrLimeGreen),
                                    m_bad(clrTomato), m_warn(clrOrange) {}

   void              Init(const bool enabled, const int x = 12, const int y = 24)
     {
      m_enabled = enabled;
      m_x = x;
      m_y = y;
      m_chart = ChartID();
     }

   void              Destroy()
     {
      ObjectsDeleteAll(m_chart, m_prefix);
     }

   void              Update(CStatistics *stats, CRiskManager *risk, CPropFirmManager *prop,
                            const string regime, const string trend, const string bias,
                            const string strategy, const string news_status,
                            const double spread_pts, const double latency_ms,
                            const ENUM_APEX_TRADE_STATE state)
     {
      if(!m_enabled) return;

      double bal = AccountInfoDouble(ACCOUNT_BALANCE);
      double eq  = AccountInfoDouble(ACCOUNT_EQUITY);
      double floating = eq - bal;

      datetime now  = TimeCurrent();
      datetime day  = now - (now % 86400);
      MqlDateTime dt;
      TimeToStruct(now, dt);
      datetime week  = day - (dt.day_of_week == 0 ? 6 : dt.day_of_week - 1) * 86400;
      datetime month = day - (dt.day - 1) * 86400;

      int mw, ml;
      stats.Streaks(mw, ml);

      ApexPropRules rules = prop.Rules();
      double pass_est = stats.ChallengePassEstimate(
                           rules.profit_target_pct > 0 ? rules.profit_target_pct : 10.0,
                           rules.max_overall_dd_pct,
                           risk.Config().risk_per_trade_pct);

      int i = 0;
      Row(i++, "ApexPA v" + APEX_VERSION, prop.FirmName(), m_head);
      Row(i++, "Status", ApexTradeStateToString(state),
          state == STATE_TRADING ? m_good : m_warn);
      Row(i++, "Balance / Equity", StringFormat("%.2f / %.2f", bal, eq), m_text);
      Row(i++, "Floating P/L", StringFormat("%+.2f", floating), Signed(floating));
      Row(i++, "Daily P/L", StringFormat("%+.2f", stats.ProfitSince(day)), Signed(stats.ProfitSince(day)));
      Row(i++, "Weekly / Monthly", StringFormat("%+.2f / %+.2f",
          stats.ProfitSince(week), stats.ProfitSince(month)), m_text);
      Row(i++, "Open Risk", StringFormat("%.2f%%", risk.OpenRiskPct()),
          risk.OpenRiskPct() > 2 ? m_warn : m_text);
      Row(i++, "Daily DD used", StringFormat("%.2f%% / %.1f%%",
          prop.DailyDDUsedPct(), rules.max_daily_dd_pct),
          prop.DailyDDUsedPct() > rules.max_daily_dd_pct * 0.6 ? m_bad : m_text);
      Row(i++, "Overall DD used", StringFormat("%.2f%% / %.1f%%",
          prop.OverallDDUsedPct(), rules.max_overall_dd_pct),
          prop.OverallDDUsedPct() > rules.max_overall_dd_pct * 0.6 ? m_bad : m_text);
      Row(i++, "Remaining day room", StringFormat("%.2f", prop.RemainingDailyLoss()),
          prop.RemainingDailyLoss() < 0 ? m_bad : m_text);
      Row(i++, "Target progress", StringFormat("%.0f%%  (days %d/%d)",
          prop.TargetProgressPct(), prop.TradingDays(), rules.min_trading_days), m_text);
      Row(i++, "Trades / WinRate", StringFormat("%d / %.1f%%", stats.Total(), stats.WinRate()), m_text);
      Row(i++, "PF / Expectancy", StringFormat("%.2f / %+.2f", stats.ProfitFactor(), stats.Expectancy()), m_text);
      Row(i++, "Avg R / Sharpe / Sortino", StringFormat("%.2f / %.2f / %.2f",
          stats.AverageR(), stats.Sharpe(), stats.Sortino()), m_text);
      Row(i++, "Recovery / MaxDD", StringFormat("%.2f / %.2f", stats.RecoveryFactor(), stats.MaxDDMoney()), m_text);
      Row(i++, "Streak W/L", StringFormat("%d / %d", mw, ml), m_text);
      Row(i++, "Avg duration", StringFormat("%.0f min", stats.AvgDurationMinutes()), m_text);
      Row(i++, "Regime / Trend", regime + " / " + trend, m_head);
      Row(i++, "MTF Bias / Strategy", bias + " / " + strategy, m_text);
      Row(i++, "News", news_status, StringFind(news_status, "IN NEWS") >= 0 ? m_bad : m_text);
      Row(i++, "Spread / Latency", StringFormat("%.1f pts / %.1f ms", spread_pts, latency_ms), m_text);
      Row(i++, "Pass estimate*", pass_est < 0 ? "n/a (<20 trades)" :
          StringFormat("~%.0f%% (estimate, not a prediction)", pass_est * 100.0),
          pass_est < 0 ? m_text : (pass_est > 0.6 ? m_good : m_warn));

      m_rows = i;
      EnsurePanel(m_rows);
      ChartRedraw(m_chart);
     }
  };
//+------------------------------------------------------------------+
